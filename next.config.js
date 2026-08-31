/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'ws' (usado por el driver serverless de Neon) intenta cargar sus
  // bindings nativos opcionales (bufferutil/utf-8-validate) en runtime;
  // si Next los empaqueta con webpack en vez de dejarlos como require()
  // reales, el binding queda roto ("bufferUtil.mask is not a function").
  // '@resvg/resvg-js' (rasteriza SVG->PNG) y 'sharp' (recomprime fotos) usan
  // bindings nativos - deben quedar fuera del bundle de webpack (ficha PDF,
  // Fase 2) igual que 'ws' de arriba. 'satori' (y su dependencia
  // 'harfbuzzjs') cargan un binario hb.wasm por ruta relativa en runtime -
  // si webpack los bundlea, el .wasm termina en un chunk distinto al que
  // harfbuzzjs busca ("ENOENT ... vendor-chunks/hb.wasm"), asi que tambien
  // quedan fuera del bundle.
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate', '@resvg/resvg-js', 'sharp', 'satori', 'harfbuzzjs', 'yoga-layout'],
  // Externalizar los paquetes de arriba evita que webpack los rompa en
  // build, pero traslada la responsabilidad de empaquetarlos a runtime al
  // "file tracing" de Vercel (@vercel/nft), que analiza el codigo de forma
  // estatica para decidir que archivos subir con la funcion serverless.
  // harfbuzzjs (usado por satori) resuelve la ruta de su hb.wasm con
  // concatenacion de strings dentro de un bundle Emscripten minificado en
  // una sola linea (__dirname + "/" + "hb.wasm") - un patron que el tracer
  // no detecta de forma confiable, a diferencia de path.join(__dirname, ..).
  // Sin esto, el .wasm puede faltar en el deploy aunque "next build" local
  // funcione, porque next dev/start nunca corren el tracer. Se agrega
  // tambien, de forma defensiva, el binario nativo de @resvg/resvg-js para
  // Linux (entorno real de las funciones de Vercel).
  outputFileTracingIncludes: {
    '/api/real-estate/listings/[id]/ficha': [
      './node_modules/harfbuzzjs/*.wasm',
      './node_modules/@resvg/resvg-js-linux-x64-gnu/*.node',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
}

module.exports = nextConfig

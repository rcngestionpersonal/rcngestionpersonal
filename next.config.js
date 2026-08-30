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

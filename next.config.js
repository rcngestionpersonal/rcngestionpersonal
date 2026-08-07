/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'ws' (usado por el driver serverless de Neon) intenta cargar sus
  // bindings nativos opcionales (bufferutil/utf-8-validate) en runtime;
  // si Next los empaqueta con webpack en vez de dejarlos como require()
  // reales, el binding queda roto ("bufferUtil.mask is not a function").
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
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

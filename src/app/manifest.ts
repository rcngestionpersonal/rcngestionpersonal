import type { MetadataRoute } from 'next';

// Manifest de la PWA (se sirve en /manifest.webmanifest y Next agrega el
// <link rel="manifest"> solo). Los PNG salen de public/brand con `npm run icons`.
//
// start_url es "/": ahí vive el panel del usuario logueado (no existe
// /dashboard). Sin sesión, el middleware lo manda a /login?next=/.
//
// "any" y "maskable" van en archivos separados, nunca como "any maskable" en
// uno solo: el maskable tiene sangrado completo y se vería como un cuadrado
// sin redondear donde se use como "any"; el "any" tiene esquinas
// transparentes y el sistema las rellenaría al recortarlo como maskable.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identidad estable de la app instalada: si mañana cambia start_url, el
    // navegador la sigue reconociendo como la misma.
    id: '/',
    name: 'Redinmo',
    short_name: 'Redinmo',
    description: 'El hub que conecta inmuebles y pedidos de agentes',
    lang: 'es',
    start_url: '/',
    scope: '/',
    // Ventana normal, con la barra de título estándar del sistema. Sin
    // display_override: nada de window-controls-overlay.
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#7C3AED',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

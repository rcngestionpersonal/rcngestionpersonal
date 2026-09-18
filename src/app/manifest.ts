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
    // Fondo de la ventana mientras carga la app instalada: --bg del tema claro
    // (src/app/globals.css), que es el tema por defecto (defaultTheme="light"
    // en el layout). Si cambia ese token, cambiar también aquí.
    background_color: '#faf9fd',
    theme_color: '#7C3AED',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Capturas para el diálogo de instalación enriquecido: "wide" en
    // escritorio, "narrow" en el celular. Salen del modo simulado
    // (USE_REAL_ESTATE_MOCK=true) con datos de ejemplo, nunca de agentes reales;
    // los puntos y la suscripción activa se ajustaron solo en el navegador de
    // la captura (el modo simulado da 0 puntos y prueba gratuita).
    // "sizes" tiene que coincidir con el tamaño real de la imagen.
    screenshots: [
      {
        src: '/screenshots/panel-escritorio.webp',
        sizes: '1280x800',
        type: 'image/webp',
        form_factor: 'wide',
        label: 'Panel principal de Redinmo en escritorio: tu próxima jugada y el resumen de inmuebles, pedidos y matches',
      },
      {
        src: '/screenshots/panel-movil.webp',
        sizes: '390x844',
        type: 'image/webp',
        form_factor: 'narrow',
        label: 'Panel principal de Redinmo en el celular: tus puntos y los matches pendientes de contactar',
      },
    ],
  };
}

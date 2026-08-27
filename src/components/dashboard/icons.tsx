import type { SVGProps } from 'react';

// Set de iconos de linea (sin emoji) compartido entre el menu (DashboardShell)
// y el contenido de cada modulo - un solo lugar para no repetir SVGs a mano en
// dos archivos (eso es justo lo que causaba la deriva visual que corregimos).
// Mapeo fijo de identidad por modulo, igual en menu y en cualquier tarjeta:
// Gestion=grid, Ranking=podio, Suscripcion=tarjeta, Inmuebles=casa,
// Pedidos=clipboard, Matches=estrella, Mapa de Cierres=circulo, Invitar=avion.

export function IconGrid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconSubscription(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="M3 9.5h18" />
      <path d="M6.5 14.5h4" />
    </svg>
  );
}

export function IconInvite(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m3.5 4.5 17 7-17 7 3.6-7-3.6-7Z" />
      <path d="M7.1 11.5h6.4" />
    </svg>
  );
}

// Estrella de 4 puntas - el motivo "match" (✦) usado en toda la marca, ahora
// tambien la identidad visual fija del modulo Matches en menu y tarjetas.
export function IconStar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2.5c.6 3.6 2 6.4 4.5 7.7 1 .5 2 .9 3 1.1-1 .2-2 .6-3 1.1-2.5 1.3-3.9 4.1-4.5 7.7-.6-3.6-2-6.4-4.5-7.7-1-.5-2-.9-3-1.1 1-.2 2-.6 3-1.1 2.5-1.3 3.9-4.1 4.5-7.7Z" />
    </svg>
  );
}

export function IconHouse(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

export function IconClipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3" />
      <path d="M8 12.5h8M8 16h5" />
    </svg>
  );
}

export function IconHandshake(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20s-7-4.35-9.2-8.6C1.4 8 2.8 4.9 5.9 4.2c1.9-.42 3.7.4 4.9 1.9 1.2-1.5 3-2.32 4.9-1.9 3.1.7 4.5 3.8 3.1 7.2C19 15.65 12 20 12 20z" />
    </svg>
  );
}

export function IconPhoneCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M9.5 18.5h5" />
      <path d="M9 9.5l2 2 4-4.5" />
    </svg>
  );
}

export function IconMapPin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 21s-6.5-5.4-9-9.8C1.2 7.6 3.4 3.8 7.2 3.4c2-.2 3.9.9 4.8 2.6.9-1.7 2.8-2.8 4.8-2.6 3.8.4 6 4.2 4.2 7.8-2.5 4.4-9 9.8-9 9.8Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

export function IconEdit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      <path d="M14.5 5.5l3 3" />
    </svg>
  );
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconTrophy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0Z" />
      <path d="M7 5H4.5A2.5 2.5 0 0 0 5 10" />
      <path d="M17 5h2.5A2.5 2.5 0 0 1 19 10" />
      <path d="M12 13v3" />
      <path d="M8.5 20.5h7l-1-3.5h-5Z" />
    </svg>
  );
}

export function IconTarget(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPodium(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 20h18" />
      <rect x="4" y="13" width="5" height="7" />
      <rect x="9.5" y="8" width="5" height="12" />
      <rect x="15" y="15" width="5" height="5" />
    </svg>
  );
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

// Marca de WhatsApp (glifo relleno, no de linea a proposito): a diferencia del
// resto del set, este icono existe para ser reconocido instantaneamente como
// "abrir WhatsApp" - un icono de linea generico perderia esa asociacion.
export function IconWhatsapp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.36a9.87 9.87 0 0 0 4.62 1.17h.01c5.46 0 9.9-4.45 9.9-9.91S17.5 2 12.04 2Zm0 18.06c-1.5 0-2.98-.4-4.27-1.15l-.31-.18-3.19.8.85-3.1-.2-.32a8.06 8.06 0 0 1-1.24-4.3c0-4.47 3.64-8.1 8.11-8.1a8.06 8.06 0 0 1 8.1 8.1c0 4.47-3.63 8.25-8.85 8.25Zm4.44-6.05c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.71 2.6 4.14 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

export function IconCoins(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v10c0 1.66 2.69 3 6 3s6-1.34 6-3V7" />
      <path d="M3 12c0 1.66 2.69 3 6 3s6-1.34 6-3" />
      <path d="M14 9.3c2.9.3 5 1.5 5 2.9v6.3c0 1.4-2.24 2.6-5 2.9" />
    </svg>
  );
}

// Check de lista - usado por las tarjetas de planes para cada feature incluida.
export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

// Candado - usado por RequiereFeature para el bloqueo de features Pro.
export function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
      <path d="M12 14.5v3" />
    </svg>
  );
}

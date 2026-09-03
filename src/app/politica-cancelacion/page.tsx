import { redirect } from 'next/navigation';

// Esta pagina describia el modelo de renovacion MANUAL (fase de cierre,
// hallazgo 2.2: decia "la suscripcion no se renueva automaticamente", ya
// falso desde que el motor de recurrencias con tarjeta guardada quedo
// activo). Se deja como redirect en vez de borrar la ruta para no romper
// enlaces existentes (esta whitelisteada en middleware.ts, y pagar/page.tsx
// la referenciaba) - /legal/suscripcion es ahora la version vigente y unica,
// para no tener dos textos legales describiendo lo mismo que puedan
// desincronizarse entre si.
export default function PoliticaCancelacionPage() {
  redirect('/legal/suscripcion');
}

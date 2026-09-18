'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { volverSeguro } from '@/lib/navegacion/volver';

// Encabezado de toda pantalla que no es una principal del menú: "← Volver"
// (con texto, no solo una flecha) y el título, siempre visible arriba.
//
// Dos usos:
//   - Una RUTA propia (perfil, legales, guías): se pasa `padre`, la pantalla a
//     la que va si no hay historial dentro de la app. Ver lib/navegacion/volver.
//   - Una subpantalla DENTRO del panel (el formulario de un reporte, una carta
//     abierta): se pasa `onVolver` y `enPanel`, y se pega debajo del
//     encabezado del panel en vez de encima.
type Base = {
  titulo: string;
  etiquetaVolver?: string;
  // Botones del lado derecho (Guardar, Enviar...), si la pantalla los tiene.
  acciones?: ReactNode;
  // Ancho del contenido, para alinear con la pantalla (clase de Tailwind).
  ancho?: string;
};

type Props = Base & ({ padre: string; onVolver?: never; enPanel?: never } | { onVolver: () => void; enPanel?: boolean; padre?: never });

export default function EncabezadoSecundario(props: Props) {
  const router = useRouter();
  const { titulo, etiquetaVolver = 'Volver', acciones } = props;
  const volver = () => (props.onVolver ? props.onVolver() : volverSeguro(router, props.padre ?? '/'));

  const boton = (
    <button
      type="button"
      onClick={volver}
      // 44×44 como mínimo: se toca con el pulgar, sin apuntar.
      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-text transition hover:bg-surface"
    >
      <span aria-hidden="true">←</span>
      {etiquetaVolver}
    </button>
  );

  const contenido = (
    <>
      {boton}
      <p className="min-w-0 flex-1 truncate text-sm font-bold text-text">{titulo}</p>
      {acciones ? <div className="flex shrink-0 items-center gap-2">{acciones}</div> : null}
    </>
  );

  if (props.enPanel) {
    // Debajo del encabezado del panel, que también es fijo: su altura la
    // publica DashboardShell en --alto-encabezado-panel.
    return (
      <div className="sticky z-20" style={{ top: 'calc(var(--alto-encabezado-panel, 0px) + 0.5rem)' }}>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg-alt px-2.5 py-2 shadow-md">{contenido}</div>
      </div>
    );
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-bg"
      // Debajo del notch o de la isla dinámica cuando la app ocupa toda la
      // pantalla. Hoy (sin viewport-fit=cover) vale 0 y no cambia nada.
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className={`mx-auto flex items-center gap-3 px-4 py-2 ${props.ancho ?? 'max-w-3xl'}`}>{contenido}</div>
    </header>
  );
}

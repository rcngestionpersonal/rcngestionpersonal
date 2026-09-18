'use client';

import { useEffect, useRef } from 'react';

// La X de todos los modales, paneles y hojas: 44×44 como mínimo, para
// tocarla con el pulgar sin apuntar.
export default function BotonCerrar({ onCerrar, etiqueta = 'Cerrar', className = '' }: { onCerrar: () => void; etiqueta?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onCerrar}
      aria-label={etiqueta}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-surface-2 hover:text-text ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

// Cierra con la tecla Escape mientras el modal está montado (o `activo`).
// Guarda la última función en una ref para no volver a suscribirse en cada
// render del modal.
export function useCerrarConEscape(onCerrar: () => void, activo = true): void {
  const cerrar = useRef(onCerrar);
  useEffect(() => {
    cerrar.current = onCerrar;
  });
  useEffect(() => {
    if (!activo) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [activo]);
}

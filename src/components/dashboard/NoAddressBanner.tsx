'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Nudge no bloqueante, se muestra UNA vez por agente (persistido en
// localStorage, mismo patron que NoEmailBanner y el nudge de foto del carnet)
// para que los agentes que se registraron antes de que la direccion
// profesional existiera puedan completarla (Fase 7, seccion 8.4). Nunca
// bloquea el acceso, solo invita - y se puede descartar.
export default function NoAddressBanner({ agentId }: { agentId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `redinmo_no_address_nudge_${agentId}`;
    if (!window.localStorage.getItem(key)) {
      setVisible(true);
      window.localStorage.setItem(key, '1');
    }
  }, [agentId]);

  if (!visible) return null;

  return (
    <div className="fade-up mb-6 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-accent-line bg-accent-dim px-4 py-3.5">
      <p className="text-sm font-semibold text-text">
        Completa tu dirección profesional para poder generar cartas de presentación y documentos con tus datos completos.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/agentes/perfil"
          className="rounded-[10px] bg-accent px-4 py-2 text-sm font-bold text-accent-contrast transition-opacity hover:opacity-90"
        >
          Editar perfil
        </Link>
        <button onClick={() => setVisible(false)} className="rounded-[10px] px-3 py-2 text-sm font-semibold text-text-2 transition-colors hover:text-text">
          Ahora no
        </button>
      </div>
    </div>
  );
}

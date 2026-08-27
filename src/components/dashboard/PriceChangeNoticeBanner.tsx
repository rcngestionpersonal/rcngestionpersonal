'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatUsd, type PlanTipo } from '@/config/planes';

type Notice = { id: string; plan: PlanTipo; newTotalCents: number; effectiveAt: string };

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Aviso de cambio de precio (Fase 7, seccion 9.5): se auto-descarta por
// aviso especifico (no por agente) - si mas adelante se programa OTRO
// cambio, el agente vuelve a verlo aunque haya descartado el anterior. Los
// agentes con precio fundador vigente nunca reciben esta notice (el propio
// endpoint /billing/price-schedule/mine ya la omite para ellos).
export default function PriceChangeNoticeBanner({ agentId }: { agentId: string }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/real-estate/billing/price-schedule/mine', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.notice) return;
        const key = `redinmo_price_notice_dismissed_${data.notice.id}`;
        if (typeof window !== 'undefined' && window.localStorage.getItem(key)) return;
        setNotice(data.notice);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (!notice || dismissed) return null;

  function descartar() {
    if (typeof window !== 'undefined' && notice) {
      window.localStorage.setItem(`redinmo_price_notice_dismissed_${notice.id}`, '1');
    }
    setDismissed(true);
  }

  const planNombre = notice.plan === 'PRO' ? 'Pro' : 'Básico';

  return (
    <div className="fade-up mb-6 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line-strong bg-surface-2 px-4 py-3.5">
      <p className="text-sm font-semibold text-text">
        El precio del plan {planNombre} cambiará a ${formatUsd(notice.newTotalCents)} a partir del {fmtFecha(notice.effectiveAt)}.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/agentes/suscripcion/planes"
          className="rounded-[10px] bg-accent px-4 py-2 text-sm font-bold text-accent-contrast transition-opacity hover:opacity-90"
        >
          Ver mi suscripción
        </Link>
        <button onClick={descartar} className="rounded-[10px] px-3 py-2 text-sm font-semibold text-text-2 transition-colors hover:text-text">
          Entendido
        </button>
      </div>
    </div>
  );
}

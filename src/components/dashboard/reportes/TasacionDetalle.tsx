'use client';

import { useEffect, useState } from 'react';
import { ADVERTENCIA_TASACION, esPaleta } from '@/lib/real-estate/reportes/tipos';
import CompartirReporte from './CompartirReporte';
import type { InmuebleReporte, TasacionCompleta } from './tipos-cliente';

// Una tasacion ya enviada: las cifras de ese dia y el mismo PDF que recibio el
// propietario. No se recalcula: para una referencia nueva, se analiza de nuevo.

export default function TasacionDetalle({
  id,
  inmueble,
  tieneCorreo,
  t,
  onVolver,
  onEliminada,
}: {
  id: string;
  inmueble: InmuebleReporte | null;
  tieneCorreo: boolean;
  t: (k: string) => string;
  onVolver: () => void;
  onEliminada: () => void;
}) {
  const [tasacion, setTasacion] = useState<TasacionCompleta | null>(null);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/real-estate/reportes/tasacion/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok) setError(d.error ?? t('reportes.errorCargar'));
        else setTasacion(d.tasacion as TasacionCompleta);
      })
      .catch(() => vivo && setError(t('reportes.errorCargar')));
    return () => {
      vivo = false;
    };
  }, [id, t]);

  async function eliminar() {
    setBorrando(true);
    const r = await fetch(`/api/real-estate/reportes/tasacion/${id}`, { method: 'DELETE' }).catch(() => null);
    setBorrando(false);
    if (r?.ok) onEliminada();
    else setError(t('reportes.errorEliminar'));
  }

  const volver = (
    <button onClick={onVolver} className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 hover:bg-surface-2">
      {t('reportes.volver')}
    </button>
  );

  if (error && !tasacion) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
        {volver}
      </div>
    );
  }
  if (!tasacion) return <p className="text-sm text-text-2">{t('reportes.cargando')}</p>;

  const base = `/api/real-estate/reportes/tasacion/${tasacion.id}`;
  const dinero = (v: number) => `$${Math.round(v).toLocaleString('es-EC')}`;
  const d = tasacion.datos;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand">{t('reportes.tasacion.titulo')}</p>
          <h3 className="truncate text-lg font-bold text-text">{tasacion.titulo}</h3>
          <p className="text-xs text-text-2">
            {tasacion.sector} · {new Date(tasacion.createdAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {volver}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-text-2">{ADVERTENCIA_TASACION}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [d.rango.minimo, t('reportes.tasacion.minimo')],
                [d.rango.central, t('reportes.tasacion.central')],
                [d.rango.maximo, t('reportes.tasacion.maximo')],
              ].map(([v, e]) => (
                <div key={String(e)} className="rounded-xl border border-line px-2 py-2.5">
                  <p className="text-sm font-bold text-text">{dinero(Number(v))}</p>
                  <p className="text-[11px] text-text-2">{e}</p>
                </div>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-text">{d.conclusion}</p>
            <p className="text-[11px] text-text-3">{t('reportes.tasacion.congelada')}</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            {!confirmar ? (
              <button onClick={() => setConfirmar(true)} className="min-h-[44px] text-sm font-semibold text-text-3 hover:text-danger">
                {t('reportes.eliminar')}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-text">{t('reportes.tasacion.eliminarConfirmacion')}</p>
                <div className="flex gap-2">
                  <button onClick={() => void eliminar()} disabled={borrando} className="min-h-[44px] rounded-xl bg-danger px-4 text-sm font-bold text-white disabled:opacity-60">
                    {t('reportes.eliminarSi')}
                  </button>
                  <button onClick={() => setConfirmar(false)} className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2">
                    {t('reportes.cancelar')}
                  </button>
                </div>
              </div>
            )}
            {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <CompartirReporte
            urlArchivo={(formato, paleta, previa) => `${base}/archivo?formato=${formato}&paleta=${paleta}${previa ? '&previa=1' : ''}`}
            urlEnviar={`${base}/enviar`}
            paletaInicial={esPaleta(tasacion.paleta) ? tasacion.paleta : 'clara'}
            documento={tasacion.documento}
            nombreDestinatarioInicial={inmueble?.ownerName}
            tieneCorreo={tieneCorreo}
            correoInicial={tasacion.enviadoA}
            telefonoPropietario={inmueble?.ownerPhone}
            textoWhatsapp={t('reportes.tasacion.textoWhatsapp').replace('{inmueble}', tasacion.titulo)}
            nombreArchivo={`Reporte-Tasacion-${tasacion.id.slice(-6)}`}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

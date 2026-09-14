'use client';

import { useEffect, useState } from 'react';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';
import CompartirReporte from './CompartirReporte';
import type { GestionCompleta, InmuebleReporte } from './tipos-cliente';

// Un reporte de gestion ya emitido: sus cifras quedaron congeladas al emitirse.

export default function GestionDetalle({
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
  const [gestion, setGestion] = useState<GestionCompleta | null>(null);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/real-estate/reportes/gestion/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok) setError(d.error ?? t('reportes.errorCargar'));
        else setGestion(d.gestion as GestionCompleta);
      })
      .catch(() => vivo && setError(t('reportes.errorCargar')));
    return () => {
      vivo = false;
    };
  }, [id, t]);

  async function eliminar() {
    setBorrando(true);
    const r = await fetch(`/api/real-estate/reportes/gestion/${id}`, { method: 'DELETE' }).catch(() => null);
    setBorrando(false);
    if (r?.ok) onEliminada();
    else setError(t('reportes.errorEliminar'));
  }

  const volver = (
    <button onClick={onVolver} className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 hover:bg-surface-2">
      {t('reportes.volver')}
    </button>
  );

  if (error && !gestion) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
        {volver}
      </div>
    );
  }
  if (!gestion) return <p className="text-sm text-text-2">{t('reportes.cargando')}</p>;

  const base = `/api/real-estate/reportes/gestion/${gestion.id}`;
  const d = gestion.datos;
  const rango = `${new Date(gestion.periodoDesde).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} – ${new Date(gestion.periodoHasta).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand">{t('reportes.gestion.titulo')}</p>
          <h3 className="truncate text-lg font-bold text-text">{gestion.inmueble}</h3>
          <p className="text-xs text-text-2">
            {t(`reportes.gestion.periodicidad.${gestion.periodicidad}`)} · {rango}
          </p>
        </div>
        {volver}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [d.visitas.cantidad, t('reportes.gestion.cifra.visitas')],
              [d.interesados.consultas, t('reportes.gestion.cifra.consultas')],
              [d.actividad.visualizaciones, t('reportes.gestion.cifra.vistas')],
              [d.actividad.matches, t('reportes.gestion.cifra.matches')],
            ].map(([v, e]) => (
              <div key={String(e)} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                <p className="text-xl font-bold text-text">{v}</p>
                <p className="text-[11px] leading-tight text-text-2">{e}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">{t('reportes.gestion.difusion')}</p>
              <p className="mt-0.5 text-sm text-text">{gestion.difusion.length > 0 ? gestion.difusion.map((e) => e.nombre).join(' · ') : '—'}</p>
            </div>
            {gestion.observaciones ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">{t('reportes.gestion.observaciones')}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-text">{gestion.observaciones}</p>
              </div>
            ) : null}
            <p className="text-xs text-text-2">
              {t('reportes.gestion.acumulado')
                .replace('{semanas}', String(d.acumulado.semanas))
                .replace('{visitas}', String(d.acumulado.visitas))
                .replace('{consultas}', String(d.acumulado.consultas))}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            {!confirmar ? (
              <button onClick={() => setConfirmar(true)} className="min-h-[44px] text-sm font-semibold text-text-3 hover:text-danger">
                {t('reportes.eliminar')}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-text">{t('reportes.gestion.eliminarConfirmacion')}</p>
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
            paletaInicial={esPaleta(gestion.paleta) ? gestion.paleta : 'clara'}
            tieneCorreo={tieneCorreo}
            correoInicial={gestion.enviadoA}
            telefonoPropietario={inmueble?.ownerPhone}
            textoWhatsapp={t('reportes.gestion.textoWhatsapp').replace('{inmueble}', gestion.inmueble)}
            nombreArchivo={`Reporte-Gestion-${gestion.id.slice(-6)}`}
            t={t}
            onEnviado={(para) => setGestion((g) => (g ? { ...g, enviadoA: para, enviadoAt: new Date().toISOString() } : g))}
          />
        </div>
      </div>
    </div>
  );
}

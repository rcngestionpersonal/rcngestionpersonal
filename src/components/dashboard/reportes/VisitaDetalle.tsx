'use client';

import { useEffect, useState } from 'react';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';
import CompartirReporte from './CompartirReporte';
import type { InmuebleReporte, VisitaCompleta } from './tipos-cliente';

// Un reporte de visita ya guardado: lo que registro el agente, la foto con su
// alcance de consentimiento, y la salida hacia el propietario.

export default function VisitaDetalle({
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
  const [visita, setVisita] = useState<VisitaCompleta | null>(null);
  const [error, setError] = useState('');
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/real-estate/reportes/visitas/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok) setError(d.error ?? t('reportes.errorCargar'));
        else setVisita(d.visita as VisitaCompleta);
      })
      .catch(() => vivo && setError(t('reportes.errorCargar')));
    return () => {
      vivo = false;
    };
  }, [id, t]);

  async function eliminar() {
    setBorrando(true);
    const r = await fetch(`/api/real-estate/reportes/visitas/${id}`, { method: 'DELETE' }).catch(() => null);
    setBorrando(false);
    if (r?.ok) onEliminada();
    else setError(t('reportes.errorEliminar'));
  }

  const volver = (
    <button onClick={onVolver} className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 hover:bg-surface-2">
      {t('reportes.volver')}
    </button>
  );

  if (error && !visita) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
        {volver}
      </div>
    );
  }
  if (!visita) return <p className="text-sm text-text-2">{t('reportes.cargando')}</p>;

  const fecha = new Date(visita.visitadaAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
  const base = `/api/real-estate/reportes/visitas/${visita.id}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand">{t('reportes.visita.titulo')}</p>
          <h3 className="truncate text-lg font-bold text-text">{visita.inmueble}</h3>
          <p className="text-xs text-text-2">{fecha}</p>
        </div>
        {volver}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <Fila etiqueta={t('reportes.visita.visitante')} valor={visita.visitanteNombre} />
            {/* La cedula completa solo la ve el agente. En el documento que
                recibe el propietario sale con los ultimos 4 digitos. */}
            {visita.visitanteCedula ? (
              <Fila etiqueta={t('reportes.visita.cedula')} valor={visita.visitanteCedula} ayuda={t('reportes.visita.cedulaEnDocumento')} />
            ) : null}
            {visita.acompanantes ? <Fila etiqueta={t('reportes.visita.acompanantes')} valor={visita.acompanantes} /> : null}
            {visita.duracionMinutos ? <Fila etiqueta={t('reportes.visita.duracion')} valor={`${visita.duracionMinutos} min`} /> : null}
            <Fila etiqueta={t('reportes.visita.reaccion')} valor={t(`reportes.reaccion.${visita.reaccion}`)} />
            {visita.observaciones ? <Fila etiqueta={t('reportes.visita.observaciones')} valor={visita.observaciones} /> : null}
            {visita.objeciones ? <Fila etiqueta={t('reportes.visita.objeciones')} valor={visita.objeciones} /> : null}
            {visita.proximoPaso ? <Fila etiqueta={t('reportes.visita.proximoPaso')} valor={visita.proximoPaso} /> : null}
          </div>

          {visita.foto ? (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${base}/foto?uso=respaldo`} alt="" className="h-32 w-24 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-bold text-text">{visita.foto.redes ? t('reportes.foto.conRedes') : t('reportes.foto.soloRespaldo')}</p>
                  <p className="text-xs leading-relaxed text-text-2">
                    {visita.foto.redes ? t('reportes.foto.conRedesDetalle') : t('reportes.foto.soloRespaldoDetalle')}
                  </p>
                  {/* Sin el segundo consentimiento no se ofrece la descarga para
                      redes. La ruta tambien la niega. */}
                  {visita.foto.redes ? (
                    <a href={`${base}/foto?uso=redes`} className="inline-flex min-h-[44px] items-center rounded-xl border border-line-strong px-3 text-sm font-semibold text-text hover:bg-surface-2">
                      {t('reportes.foto.descargarRedes')}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-line bg-surface p-4">
            {!confirmarBorrado ? (
              <button onClick={() => setConfirmarBorrado(true)} className="min-h-[44px] text-sm font-semibold text-text-3 hover:text-danger">
                {t('reportes.eliminar')}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-text">{t('reportes.visita.eliminarConfirmacion')}</p>
                <div className="flex gap-2">
                  <button onClick={() => void eliminar()} disabled={borrando} className="min-h-[44px] rounded-xl bg-danger px-4 text-sm font-bold text-white disabled:opacity-60">
                    {t('reportes.eliminarSi')}
                  </button>
                  <button onClick={() => setConfirmarBorrado(false)} className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2">
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
            paletaInicial={esPaleta(visita.paleta) ? visita.paleta : 'clara'}
            tieneCorreo={tieneCorreo}
            correoInicial={visita.enviadoA}
            telefonoPropietario={inmueble?.ownerPhone}
            textoWhatsapp={t('reportes.visita.textoWhatsapp').replace('{inmueble}', visita.inmueble)}
            nombreArchivo={`Reporte-Visita-${visita.id.slice(-6)}`}
            t={t}
            onEnviado={(para) => setVisita((v) => (v ? { ...v, enviadoA: para, enviadoAt: new Date().toISOString() } : v))}
          />
        </div>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor, ayuda }: { etiqueta: string; valor: string; ayuda?: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">{etiqueta}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm text-text">{valor}</p>
      {ayuda ? <p className="mt-0.5 text-[11px] text-text-3">{ayuda}</p> : null}
    </div>
  );
}

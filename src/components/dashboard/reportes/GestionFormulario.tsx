'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CANALES_DIFUSION,
  GESTION_LIMITES,
  PERIODICIDADES,
  type CanalDifusion,
  type EntradaDifusion,
  type Periodicidad,
} from '@/lib/real-estate/reportes/tipos';
import type { BorradorGestion, GestionCompleta, InmuebleReporte } from './tipos-cliente';
import EncabezadoSecundario from '@/components/navegacion/EncabezadoSecundario';
import { useCambiosSinGuardar } from '@/lib/navegacion/cambios-sin-guardar';

// Reporte de gestion (punto 2.4): en menos de dos minutos. Lo automatico ya
// viene calculado y no se toca; la difusion y las observaciones vienen del
// reporte anterior, y el agente solo actualiza lo que cambio.

export default function GestionFormulario({
  inmuebles,
  inmuebleInicial,
  t,
  onCancelar,
  onEmitida,
}: {
  inmuebles: InmuebleReporte[];
  inmuebleInicial?: string | null;
  t: (k: string) => string;
  onCancelar: () => void;
  onEmitida: (g: GestionCompleta) => void;
}) {
  const opciones = useMemo(() => {
    const activos = inmuebles.filter((i) => i.status === 'ACTIVE' || i.status === 'RESERVED');
    return activos.length > 0 ? activos : inmuebles;
  }, [inmuebles]);

  const [listingId, setListingId] = useState(inmuebleInicial ?? opciones[0]?.id ?? '');
  const [periodicidad, setPeriodicidad] = useState<Periodicidad | null>(null);
  const [borrador, setBorrador] = useState<BorradorGestion | null>(null);
  const [difusion, setDifusion] = useState<EntradaDifusion[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [cargando, setCargando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [error, setError] = useState('');

  // La difusión y las observaciones llegan precargadas del borrador: cuenta
  // como cambio lo que el agente edita sobre eso, no lo precargado.
  const hayCambios =
    borrador !== null &&
    (JSON.stringify(difusion) !== JSON.stringify(borrador.difusion) || observaciones !== (borrador.observaciones ?? ''));
  useCambiosSinGuardar(hayCambios, t('nav.cambiosSinGuardar'));

  const preparar = useCallback(
    async (id: string, per: Periodicidad | null, conservarEdicion: boolean) => {
      if (!id) return;
      setCargando(true);
      setError('');
      try {
        const q = new URLSearchParams({ listingId: id, ...(per ? { periodicidad: per } : {}) });
        const r = await fetch(`/api/real-estate/reportes/gestion/preparar?${q}`, { cache: 'no-store' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(d.error ?? t('reportes.errorCargar'));
          return;
        }
        const b = d as BorradorGestion;
        setBorrador(b);
        setPeriodicidad(b.periodicidad);
        // Cambiar de semanal a mensual no borra lo que el agente ya escribio.
        if (!conservarEdicion) {
          setDifusion(b.difusion);
          setObservaciones(b.observaciones ?? '');
        }
      } catch {
        setError(t('reportes.errorCargar'));
      } finally {
        setCargando(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void preparar(listingId, null, false);
  }, [listingId, preparar]);

  function agregarCanal(canal: CanalDifusion) {
    if (difusion.length >= GESTION_LIMITES.difusionMaxima) return;
    const nombre = canal === 'REDINMO' ? 'Redinmo' : '';
    setDifusion((d) => [...d, { canal, nombre, enlace: null }]);
  }

  function editarCanal(i: number, cambio: Partial<EntradaDifusion>) {
    setDifusion((d) => d.map((e, j) => (j === i ? { ...e, ...cambio } : e)));
  }

  const enlaceInvalido = difusion.some((e) => e.enlace && !/^https?:\/\/\S+$/i.test(e.enlace));
  const nombreVacio = difusion.some((e) => !e.nombre.trim());
  const listo = Boolean(borrador) && !cargando && !enlaceInvalido && !nombreVacio;

  async function emitir() {
    if (!listo || !periodicidad) return;
    setEmitiendo(true);
    setError('');
    try {
      const r = await fetch('/api/real-estate/reportes/gestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          periodicidad,
          difusion: difusion.map((e) => ({ ...e, nombre: e.nombre.trim(), enlace: e.enlace?.trim() || null })),
          observaciones: observaciones.trim() || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t('reportes.gestion.errorEmitir'));
        return;
      }
      onEmitida(d.gestion as GestionCompleta);
    } catch {
      setError(t('reportes.gestion.errorEmitir'));
    } finally {
      setEmitiendo(false);
    }
  }

  const campo =
    'min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-base text-text outline-none transition focus:border-brand sm:text-sm';
  const etiqueta = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-text-2';

  if (opciones.length === 0) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-line p-6 text-center">
        <p className="text-sm text-text-2">{t('reportes.sinInmuebles')}</p>
        <button onClick={onCancelar} className="min-h-[44px] rounded-xl border border-line-strong px-4 text-sm font-semibold text-text">
          {t('reportes.volver')}
        </button>
      </div>
    );
  }

  const d = borrador?.datos;

  return (
    <div className="mx-auto max-w-2xl pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-0">
      {/* Hijo directo del contenedor del formulario: así queda fijo mientras se baja. */}
      <EncabezadoSecundario enPanel onVolver={onCancelar} titulo={t('reportes.gestion.nuevo')} etiquetaVolver={t('reportes.volver')} />

      <div className="mt-4 space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <div>
            <label className={etiqueta} htmlFor="gestion-inmueble">
              {t('reportes.gestion.inmueble')}
            </label>
            <select id="gestion-inmueble" value={listingId} onChange={(e) => setListingId(e.target.value)} className={campo}>
              {opciones.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className={etiqueta}>{t('reportes.gestion.periodicidad')}</legend>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-surface p-1">
              {PERIODICIDADES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPeriodicidad(p);
                    void preparar(listingId, p, true);
                  }}
                  aria-pressed={periodicidad === p}
                  className={`min-h-[36px] rounded-lg text-sm font-semibold transition ${periodicidad === p ? 'bg-brand-dim text-brand' : 'text-text-2 hover:text-text'}`}
                >
                  {t(`reportes.gestion.periodicidad.${p}`)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* ---- Lo automatico: se ve, no se edita ---- */}
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-text">{t('reportes.gestion.automatico')}</p>
            {d ? (
              <p className="text-xs text-text-3">
                {new Date(d.periodo.desde).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} –{' '}
                {new Date(d.periodo.hasta).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            ) : null}
          </div>
          {cargando || !d ? (
            <p className="mt-3 text-sm text-text-3">{t('reportes.gestion.calculando')}</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Cifra valor={d.visitas.cantidad} etiqueta={t('reportes.gestion.cifra.visitas')} />
                <Cifra valor={d.interesados.consultas} etiqueta={t('reportes.gestion.cifra.consultas')} />
                <Cifra valor={d.actividad.visualizaciones} etiqueta={t('reportes.gestion.cifra.vistas')} />
                <Cifra valor={d.actividad.matches} etiqueta={t('reportes.gestion.cifra.matches')} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-text-2">
                {t('reportes.gestion.acumulado')
                  .replace('{semanas}', String(d.acumulado.semanas))
                  .replace('{visitas}', String(d.acumulado.visitas))
                  .replace('{consultas}', String(d.acumulado.consultas))}
              </p>
              <p className="mt-1 text-[11px] text-text-3">{d.comparativo ? t('reportes.gestion.conComparativo') : t('reportes.gestion.sinComparativo')}</p>
            </>
          )}
        </div>

        {/* ---- Punto 2.3: al agente, nunca al propietario ---- */}
        {borrador?.senal ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
            <p className="text-sm font-bold text-text">{t('reportes.gestion.senal.titulo')}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-2">
              {t('reportes.gestion.senal.detalle')
                .replace('{propia}', borrador.senal.consultasPorSemana.toFixed(1))
                .replace('{sector}', borrador.senal.promedioSector.toFixed(1))
                .replace('{similares}', String(borrador.senal.similares))}
            </p>
            <p className="mt-1 text-[11px] text-text-3">{t('reportes.gestion.senal.privado')}</p>
          </div>
        ) : null}

        {/* ---- Difusion ---- */}
        <div>
          <p className={etiqueta}>{t('reportes.gestion.difusion')}</p>
          <div className="space-y-2">
            {difusion.map((e, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">{t(`reportes.canal.${e.canal}`)}</span>
                  <button
                    type="button"
                    onClick={() => setDifusion((dd) => dd.filter((_, j) => j !== i))}
                    className="min-h-[36px] rounded-lg px-2 text-xs font-semibold text-text-3 hover:text-danger"
                  >
                    {t('reportes.gestion.quitar')}
                  </button>
                </div>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <input
                    value={e.nombre}
                    maxLength={GESTION_LIMITES.nombreCanal}
                    placeholder={t(`reportes.canal.placeholder.${e.canal}`)}
                    onChange={(ev) => editarCanal(i, { nombre: ev.target.value })}
                    aria-label={t('reportes.gestion.nombreCanal')}
                    className={campo}
                  />
                  <input
                    value={e.enlace ?? ''}
                    type="url"
                    inputMode="url"
                    maxLength={GESTION_LIMITES.enlace}
                    placeholder={t('reportes.gestion.enlacePlaceholder')}
                    onChange={(ev) => editarCanal(i, { enlace: ev.target.value || null })}
                    aria-label={t('reportes.gestion.enlace')}
                    aria-invalid={Boolean(e.enlace && !/^https?:\/\/\S+$/i.test(e.enlace))}
                    className={`${campo} ${e.enlace && !/^https?:\/\/\S+$/i.test(e.enlace) ? 'border-danger' : ''}`}
                  />
                </div>
              </div>
            ))}
          </div>
          {difusion.length < GESTION_LIMITES.difusionMaxima ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {CANALES_DIFUSION.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => agregarCanal(c)}
                  className="min-h-[40px] rounded-full border border-line-strong px-3 text-xs font-semibold text-text-2 hover:bg-surface-2"
                >
                  + {t(`reportes.canal.${c}`)}
                </button>
              ))}
            </div>
          ) : null}
          {enlaceInvalido ? <p className="mt-2 text-xs text-danger">{t('reportes.gestion.enlaceInvalido')}</p> : null}
        </div>

        {/* ---- Observaciones ---- */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className={etiqueta} htmlFor="gestion-observaciones">
              {t('reportes.gestion.observaciones')}
            </label>
            <span className="text-[11px] text-text-3">
              {observaciones.length}/{GESTION_LIMITES.observaciones}
            </span>
          </div>
          <textarea
            id="gestion-observaciones"
            rows={5}
            maxLength={GESTION_LIMITES.observaciones}
            value={observaciones}
            placeholder={t('reportes.gestion.observacionesPlaceholder')}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-base leading-relaxed text-text outline-none transition focus:border-brand sm:text-sm"
          />
          {borrador?.anterior ? <p className="mt-1 text-[11px] text-text-3">{t('reportes.gestion.precargado')}</p> : null}
        </div>

        {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
        <button
          onClick={() => void emitir()}
          disabled={!listo || emitiendo}
          className="gradient-btn min-h-[52px] w-full rounded-xl text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
        >
          {emitiendo ? t('reportes.gestion.emitiendo') : t('reportes.gestion.emitir')}
        </button>
      </div>
    </div>
  );
}

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <p className="text-xl font-bold text-text">{valor}</p>
      <p className="text-[11px] leading-tight text-text-2">{etiqueta}</p>
    </div>
  );
}

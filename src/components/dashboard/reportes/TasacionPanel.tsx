'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { OPERATION_TYPE_LABELS, PROPERTY_TYPE_LABELS } from '@/lib/i18n/dictionary';
import { ANTIGUEDAD_OPTIONS, CLOSED_DEAL_PROPERTY_TYPES } from '@/lib/real-estate/closed-deals-config';
import { QUITO_ZONES } from '@/lib/real-estate/quito-zones';
import type { DatosTasacion, ResultadoTasacion } from '@/lib/real-estate/reportes/tasacion-datos';
import { ADVERTENCIA_TASACION } from '@/lib/real-estate/reportes/tipos';
import CompartirReporte from './CompartirReporte';
import type { DocumentoEnviado, InmuebleReporte, TasacionResumen } from './tipos-cliente';
import EncabezadoSecundario from '@/components/navegacion/EncabezadoSecundario';
import { useCambiosSinGuardar } from '@/lib/navegacion/cambios-sin-guardar';

// Reporte de tasacion (punto 1). ESTADO: en construccion. La pantalla funciona
// completa, pero con el volumen actual del Mapa de Cierres casi siempre va a
// mostrar el aviso de muestra insuficiente: esa respuesta la decide el
// servidor, no esta pantalla.

type Origen = 'inventario' | 'manual';

// Datos del inmueble cuando no está en el inventario y se escriben a mano.
const MANUAL_INICIAL = { tipo: 'APARTMENT', operacion: 'SALE', zona: 'CENTRO_NORTE', metraje: '', antiguedad: '', dormitorios: '', banos: '', parqueaderos: '' };

export default function TasacionPanel({
  inmuebles,
  inmuebleInicial,
  tieneCorreo,
  t,
  onVolver,
  onEnviada,
  enviadas = [],
  onAbrirEnviada,
}: {
  inmuebles: InmuebleReporte[];
  inmuebleInicial?: string | null;
  tieneCorreo: boolean;
  t: (k: string) => string;
  onVolver: () => void;
  onEnviada?: () => void;
  enviadas?: TasacionResumen[];
  onAbrirEnviada?: (id: string) => void;
}) {
  const { lang } = useLanguage();
  const [origen, setOrigen] = useState<Origen>(inmuebles.length > 0 ? 'inventario' : 'manual');
  const [listingId, setListingId] = useState(inmuebleInicial ?? inmuebles[0]?.id ?? '');
  const [manual, setManual] = useState(MANUAL_INICIAL);
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoTasacion | null>(null);
  const [telefono, setTelefono] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');
  // Tras el primer envio la tasacion queda guardada: desde ahi se descarga y se
  // reenvia la guardada, no una recalculada.
  const [guardada, setGuardada] = useState<{ id: string; documento: DocumentoEnviado } | null>(null);

  // Lo escrito a mano sobre el inmueble se pierde al volver (el análisis se
  // puede repetir; lo escrito, no), salvo que ya se haya guardado la tasación.
  const hayCambios = origen === 'manual' && guardada === null && JSON.stringify(manual) !== JSON.stringify(MANUAL_INICIAL);
  useCambiosSinGuardar(hayCambios, t('nav.cambiosSinGuardar'));

  const parametros = useMemo<Record<string, string>>(() => {
    if (origen === 'inventario') return listingId ? { listingId } : {};
    return Object.fromEntries(Object.entries(manual).filter(([, v]) => v !== ''));
  }, [origen, listingId, manual]);

  async function analizar() {
    setAnalizando(true);
    setError('');
    setResultado(null);
    setGuardada(null);
    try {
      const q = new URLSearchParams(parametros);
      const r = await fetch(`/api/real-estate/reportes/tasacion?${q}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t('reportes.tasacion.error'));
        return;
      }
      setResultado(d.resultado as ResultadoTasacion);
      setTelefono(d.telefonoPropietario ?? null);
      setConsulta(parametros);
    } catch {
      setError(t('reportes.tasacion.error'));
    } finally {
      setAnalizando(false);
    }
  }

  const campo =
    'min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-base text-text outline-none transition focus:border-brand sm:text-sm';
  const etiqueta = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-text-2';
  const listoManual = Number(manual.metraje) > 0;
  const listo = origen === 'inventario' ? Boolean(listingId) : listoManual;

  return (
    <div className="space-y-5">
      <EncabezadoSecundario enPanel onVolver={onVolver} titulo={t('reportes.tasacion.titulo')} etiquetaVolver={t('reportes.volver')} />
      <h3 className="text-lg font-bold text-text">{t('reportes.tasacion.encabezado')}</h3>

      <p className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-text-2">{t('reportes.tasacion.enConstruccion')}</p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-surface p-1">
            {(['inventario', 'manual'] as const).map((o) => (
              <button
                key={o}
                onClick={() => {
                  setOrigen(o);
                  setResultado(null);
                }}
                disabled={o === 'inventario' && inmuebles.length === 0}
                aria-pressed={origen === o}
                className={`min-h-[40px] rounded-lg text-sm font-semibold transition disabled:opacity-40 ${origen === o ? 'bg-brand-dim text-brand' : 'text-text-2 hover:text-text'}`}
              >
                {t(`reportes.tasacion.origen.${o}`)}
              </button>
            ))}
          </div>

          {origen === 'inventario' ? (
            <div>
              <label className={etiqueta} htmlFor="tasacion-inmueble">
                {t('reportes.gestion.inmueble')}
              </label>
              <select id="tasacion-inmueble" value={listingId} onChange={(e) => { setListingId(e.target.value); setResultado(null); }} className={campo}>
                {inmuebles.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta={t('reportes.tasacion.tipo')} clase={etiqueta}>
                <select value={manual.tipo} onChange={(e) => setManual({ ...manual, tipo: e.target.value })} className={campo}>
                  {CLOSED_DEAL_PROPERTY_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {PROPERTY_TYPE_LABELS[lang][p]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta={t('reportes.tasacion.operacion')} clase={etiqueta}>
                <select value={manual.operacion} onChange={(e) => setManual({ ...manual, operacion: e.target.value })} className={campo}>
                  {(['SALE', 'RENT'] as const).map((o) => (
                    <option key={o} value={o}>
                      {OPERATION_TYPE_LABELS[lang][o]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta={t('reportes.tasacion.sector')} clase={etiqueta}>
                <select value={manual.zona} onChange={(e) => setManual({ ...manual, zona: e.target.value })} className={campo}>
                  {QUITO_ZONES.map((z) => (
                    <option key={z.key} value={z.key}>
                      {lang === 'es' ? z.labelEs : z.labelEn}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta={t('reportes.tasacion.metraje')} clase={etiqueta}>
                <input type="number" inputMode="decimal" min={1} value={manual.metraje} onChange={(e) => setManual({ ...manual, metraje: e.target.value })} className={campo} />
              </Campo>
              <Campo etiqueta={t('reportes.tasacion.antiguedad')} clase={etiqueta}>
                <select value={manual.antiguedad} onChange={(e) => setManual({ ...manual, antiguedad: e.target.value })} className={campo}>
                  <option value="">—</option>
                  {ANTIGUEDAD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {lang === 'es' ? o.labelEs : o.labelEn}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="grid grid-cols-3 gap-2">
                {(['dormitorios', 'banos', 'parqueaderos'] as const).map((k) => (
                  <Campo key={k} etiqueta={t(`reportes.tasacion.${k}`)} clase={etiqueta}>
                    <input type="number" inputMode="numeric" min={0} value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} className={campo} />
                  </Campo>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => void analizar()} disabled={!listo || analizando} className="gradient-btn min-h-[48px] w-full rounded-xl text-sm font-bold text-grad-contrast disabled:opacity-50">
            {analizando ? t('reportes.tasacion.analizando') : t('reportes.tasacion.analizar')}
          </button>

          {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

          {/* Punto 1.2: el mensaje sale del servidor, palabra por palabra. */}
          {resultado && !resultado.disponible ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold leading-relaxed text-text">{resultado.mensaje}</p>
              <p className="mt-2 text-xs text-text-2">{t('reportes.tasacion.muestraActual').replace('{cierres}', String(resultado.cierres))}</p>
            </div>
          ) : null}

          {resultado?.disponible ? <Resumen datos={resultado.datos} t={t} /> : null}

          {/* Las enviadas, incluidas las de inmuebles fuera del inventario, que
              no tienen expediente donde aparecer. */}
          {enviadas.length > 0 ? (
            <div>
              <p className="text-sm font-bold text-text">{t('reportes.tasacion.enviadas')}</p>
              <ul className="mt-2 space-y-2">
                {enviadas.slice(0, 10).map((x) => (
                  <li key={x.id}>
                    <button
                      onClick={() => onAbrirEnviada?.(x.id)}
                      className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-text">{x.titulo}</span>
                        <span className="block text-xs text-text-2">
                          {x.sector} · {new Date(x.createdAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                      <span aria-hidden className="text-text-3">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          {resultado?.disponible && consulta ? (
            <CompartirReporte
              key={guardada?.id ?? 'nueva'}
              urlArchivo={(formato, paleta, previa) =>
                guardada
                  ? `/api/real-estate/reportes/tasacion/${guardada.id}/archivo?formato=${formato}&paleta=${paleta}${previa ? '&previa=1' : ''}`
                  : `/api/real-estate/reportes/tasacion/archivo?${new URLSearchParams({ ...consulta, formato, paleta, ...(previa ? { previa: '1' } : {}) })}`
              }
              urlEnviar={guardada ? `/api/real-estate/reportes/tasacion/${guardada.id}/enviar` : '/api/real-estate/reportes/tasacion/enviar'}
              cuerpoEnvio={guardada ? undefined : consulta}
              documento={guardada?.documento ?? null}
              paletaInicial="clara"
              tieneCorreo={tieneCorreo}
              telefonoPropietario={telefono}
              textoWhatsapp={t('reportes.tasacion.textoWhatsapp').replace('{inmueble}', resultado.datos.inmueble.titulo)}
              nombreArchivo="Reporte-Tasacion"
              t={t}
              onEnviado={(_para, respuesta) => {
                if (respuesta.tasacionId && !guardada) setGuardada({ id: respuesta.tasacionId, documento: respuesta.documento });
                onEnviada?.();
              }}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-line p-5 text-xs leading-relaxed text-text-3">{ADVERTENCIA_TASACION}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({ etiqueta, clase, children }: { etiqueta: string; clase: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={clase}>{etiqueta}</span>
      {children}
    </label>
  );
}

function Resumen({ datos, t }: { datos: DatosTasacion; t: (k: string) => string }) {
  const dinero = (v: number) => `$${Math.round(v).toLocaleString('es-EC')}`;
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      {/* La advertencia tambien en pantalla: el agente la ve antes de entregar. */}
      <p className="rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-text-2">{ADVERTENCIA_TASACION}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-line px-2 py-2.5">
          <p className="text-sm font-bold text-text">{dinero(datos.rango.minimo)}</p>
          <p className="text-[11px] text-text-2">{t('reportes.tasacion.minimo')}</p>
        </div>
        <div className="rounded-xl border border-accent-line bg-accent-dim px-2 py-2.5">
          <p className="text-sm font-bold text-text">{dinero(datos.rango.central)}</p>
          <p className="text-[11px] text-text-2">{t('reportes.tasacion.central')}</p>
        </div>
        <div className="rounded-xl border border-line px-2 py-2.5">
          <p className="text-sm font-bold text-text">{dinero(datos.rango.maximo)}</p>
          <p className="text-[11px] text-text-2">{t('reportes.tasacion.maximo')}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-text">{datos.conclusion}</p>
    </div>
  );
}

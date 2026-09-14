'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { AccesoInput } from '@/lib/real-estate/access';
import RequiereFeature from '../RequiereFeature';
import { ModuleHeader } from '../CardKit';
import { IconReport } from '../icons';
import VisitaFormulario from '../reportes/VisitaFormulario';
import VisitaDetalle from '../reportes/VisitaDetalle';
import type { DatosPantallaReportes, InmuebleReporte } from '../reportes/tipos-cliente';

// Modulo "Reportes" (Fase 9). Pestaña propia al nivel de los modulos de
// trabajo; en Basico se ve la entrada y aterriza en el bloqueo elegante.

type Vista =
  | { modo: 'inicio' }
  | { modo: 'visita-nueva'; listingId?: string | null }
  | { modo: 'visita'; id: string }
  | { modo: 'expediente'; listingId: string };

export default function ReportesTab({ suscripcion }: { suscripcion: AccesoInput | null }) {
  const { t } = useLanguage();
  return (
    <div className="min-w-0">
      <ModuleHeader icon={<IconReport className="h-[17px] w-[17px]" strokeWidth={1.8} />} title={t('reportes.title')} subtitle={t('reportes.subtitle')} />
      {suscripcion ? (
        <RequiereFeature suscripcion={suscripcion} feature="reportes_clientes">
          <Panel t={t} />
        </RequiereFeature>
      ) : (
        <p className="text-sm text-text-2">{t('reportes.cargando')}</p>
      )}
    </div>
  );
}

function Panel({ t }: { t: (k: string) => string }) {
  const [datos, setDatos] = useState<DatosPantallaReportes | null>(null);
  const [vista, setVista] = useState<Vista>({ modo: 'inicio' });
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/real-estate/reportes', { cache: 'no-store' });
      if (!r.ok) {
        setError(t('reportes.errorCargar'));
        return;
      }
      setDatos((await r.json()) as DatosPantallaReportes);
      setError('');
    } catch {
      setError(t('reportes.errorCargar'));
    }
  }, [t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Al cambiar de vista se vuelve arriba: en el celular, abrir un reporte desde
  // el final de la lista dejaba la pantalla a mitad del formulario.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [vista]);

  const inmueblePorId = useMemo(() => new Map((datos?.inmuebles ?? []).map((i) => [i.id, i])), [datos]);

  if (error) return <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>;
  if (!datos) return <p className="text-sm text-text-2">{t('reportes.cargando')}</p>;

  const volverAlInicio = () => {
    void cargar();
    setVista({ modo: 'inicio' });
  };

  if (vista.modo === 'visita-nueva') {
    return (
      <VisitaFormulario
        inmuebles={datos.inmuebles}
        inmuebleInicial={vista.listingId}
        t={t}
        onCancelar={() => setVista({ modo: 'inicio' })}
        onGuardada={(v) => {
          void cargar();
          setVista({ modo: 'visita', id: v.id });
        }}
      />
    );
  }

  if (vista.modo === 'visita') {
    const resumen = datos.visitas.find((v) => v.id === vista.id);
    return (
      <VisitaDetalle
        id={vista.id}
        inmueble={resumen ? inmueblePorId.get(resumen.listingId) ?? null : null}
        tieneCorreo={datos.tieneCorreo}
        t={t}
        onVolver={volverAlInicio}
        onEliminada={volverAlInicio}
      />
    );
  }

  if (vista.modo === 'expediente') {
    const inmueble = inmueblePorId.get(vista.listingId);
    return inmueble ? (
      <Expediente
        inmueble={inmueble}
        datos={datos}
        t={t}
        onVolver={() => setVista({ modo: 'inicio' })}
        onAbrirVisita={(id) => setVista({ modo: 'visita', id })}
        onNuevaVisita={() => setVista({ modo: 'visita-nueva', listingId: inmueble.id })}
      />
    ) : null;
  }

  return (
    <div className="space-y-6">
      {/* ---- Los reportes ---- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <TarjetaReporte
          titulo={t('reportes.visita.titulo')}
          detalle={t('reportes.visita.detalle')}
          accion={t('reportes.visita.crear')}
          principal
          onClick={() => setVista({ modo: 'visita-nueva' })}
        />
      </div>

      {/* ---- Expediente por inmueble (punto 2.5 y 3.4) ---- */}
      <div>
        <h3 className="text-sm font-bold text-text">{t('reportes.expediente.titulo')}</h3>
        <p className="mt-0.5 text-xs text-text-2">{t('reportes.expediente.detalle')}</p>
        {datos.inmuebles.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-text-2">{t('reportes.sinInmuebles')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {datos.inmuebles.map((i) => {
              const visitas = datos.visitas.filter((v) => v.listingId === i.id).length;
              const gestiones = datos.gestiones.filter((g) => g.listingId === i.id).length;
              return (
                <li key={i.id}>
                  <button
                    onClick={() => setVista({ modo: 'expediente', listingId: i.id })}
                    className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:bg-surface-2"
                  >
                    {i.coverPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.coverPhotoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="h-12 w-12 shrink-0 rounded-lg bg-surface-2" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-text">{i.title}</span>
                      <span className="mt-0.5 block text-xs text-text-2">
                        {t('reportes.expediente.conteo').replace('{visitas}', String(visitas)).replace('{gestiones}', String(gestiones))}
                      </span>
                    </span>
                    <span aria-hidden className="text-text-3">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function TarjetaReporte({
  titulo,
  detalle,
  accion,
  principal,
  onClick,
}: {
  titulo: string;
  detalle: string;
  accion: string;
  principal?: boolean;
  onClick: () => void;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border p-4 ${principal ? 'border-brand-line bg-brand-dim' : 'border-line bg-surface'}`}>
      <p className="text-sm font-bold text-text">{titulo}</p>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-text-2">{detalle}</p>
      <button
        onClick={onClick}
        className={`mt-3 min-h-[48px] w-full rounded-xl text-sm font-bold transition ${
          principal ? 'gradient-btn text-grad-contrast' : 'border border-line-strong text-text hover:bg-surface-2'
        }`}
      >
        {accion}
      </button>
    </div>
  );
}

function Expediente({
  inmueble,
  datos,
  t,
  onVolver,
  onAbrirVisita,
  onNuevaVisita,
}: {
  inmueble: InmuebleReporte;
  datos: DatosPantallaReportes;
  t: (k: string) => string;
  onVolver: () => void;
  onAbrirVisita: (id: string) => void;
  onNuevaVisita: () => void;
}) {
  // Linea de tiempo de la gestion del inmueble: visitas y reportes de gestion
  // juntos, del mas reciente al mas antiguo.
  const eventos = [
    ...datos.visitas
      .filter((v) => v.listingId === inmueble.id)
      .map((v) => ({ tipo: 'visita' as const, id: v.id, fecha: v.visitadaAt, titulo: v.visitanteNombre, detalle: t(`reportes.reaccion.${v.reaccion}`), enviado: Boolean(v.enviadoAt) })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand">{t('reportes.expediente.titulo')}</p>
          <h3 className="truncate text-lg font-bold text-text">{inmueble.title}</h3>
        </div>
        <button onClick={onVolver} className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 hover:bg-surface-2">
          {t('reportes.volver')}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button onClick={onNuevaVisita} className="gradient-btn min-h-[48px] rounded-xl text-sm font-bold text-grad-contrast">
          {t('reportes.visita.crear')}
        </button>
      </div>

      {eventos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-text-2">{t('reportes.expediente.vacio')}</p>
      ) : (
        <ul className="space-y-2">
          {eventos.map((e) => (
            <li key={`${e.tipo}-${e.id}`}>
              <button
                onClick={() => onAbrirVisita(e.id)}
                className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:bg-surface-2"
              >
                <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase text-text-2">{t(`reportes.expediente.tipo.${e.tipo}`)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">{e.titulo}</span>
                  <span className="block text-xs text-text-2">
                    {new Date(e.fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })} · {e.detalle}
                  </span>
                </span>
                {e.enviado ? <span className="shrink-0 text-[11px] font-semibold text-accent">{t('reportes.enviado')}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

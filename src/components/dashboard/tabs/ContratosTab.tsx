'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { AccesoInput } from '@/lib/real-estate/access';
import RequiereFeature from '../RequiereFeature';
import { ModuleHeader } from '../CardKit';
import { IconContract } from '../icons';
import ContratoFormulario from '../contratos/ContratoFormulario';
import ContratoSeguimiento from '../contratos/ContratoSeguimiento';
import type { ContratoResumen, DatosPantallaContratos } from '../contratos/tipos-cliente';
import { CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// Modulo "Contratos" (punto 4.1). Pestaña propia, feature Pro con bloqueo
// elegante en Basico.

type Vista = { modo: 'lista' } | { modo: 'nuevo' } | { modo: 'editar'; id: string } | { modo: 'seguimiento'; id: string };

export default function ContratosTab({ suscripcion }: { suscripcion: AccesoInput | null }) {
  const { t } = useLanguage();
  return (
    <div className="min-w-0">
      <ModuleHeader
        icon={<IconContract className="h-[17px] w-[17px]" strokeWidth={1.8} />}
        title={t('contratos.title')}
        subtitle={t('contratos.subtitle')}
      />
      {suscripcion ? (
        <RequiereFeature suscripcion={suscripcion} feature="contratos">
          <Panel t={t} />
        </RequiereFeature>
      ) : (
        <p className="text-sm text-text-2">{t('contratos.cargando')}</p>
      )}
    </div>
  );
}

const ETIQUETA_ESTADO: Record<string, string> = {
  BORRADOR: 'contratos.estado.BORRADOR',
  PENDIENTE_FIRMA: 'contratos.estado.PENDIENTE_FIRMA',
  FIRMADO: 'contratos.estado.FIRMADO',
  RECHAZADO: 'contratos.estado.RECHAZADO',
  ANULADO: 'contratos.estado.ANULADO',
};

function Panel({ t }: { t: (k: string) => string }) {
  const [datos, setDatos] = useState<DatosPantallaContratos | null>(null);
  const [vista, setVista] = useState<Vista>({ modo: 'lista' });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/real-estate/contratos', { cache: 'no-store' });
      if (!r.ok) {
        setError(t('contratos.error.cargar'));
        return;
      }
      setDatos((await r.json()) as DatosPantallaContratos);
    } catch {
      setError(t('contratos.error.cargar'));
    } finally {
      setCargando(false);
    }
  }, [t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function eliminar(id: string) {
    await fetch(`/api/real-estate/contratos/${id}`, { method: 'DELETE' });
    void cargar();
  }

  if (cargando) return <p className="text-sm text-text-2">{t('contratos.cargando')}</p>;
  if (error) return <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>;
  if (!datos) return null;

  if (vista.modo === 'nuevo' || vista.modo === 'editar') {
    return (
      <ContratoFormulario
        t={t}
        listings={datos.listings}
        plantilla={datos.plantilla}
        contratoId={vista.modo === 'editar' ? vista.id : null}
        onCancelar={() => {
          void cargar();
          setVista({ modo: 'lista' });
        }}
        onEnviado={(id) => {
          void cargar();
          setVista({ modo: 'seguimiento', id });
        }}
      />
    );
  }

  if (vista.modo === 'seguimiento') {
    return (
      <ContratoSeguimiento
        t={t}
        contratoId={vista.id}
        onVolver={() => {
          void cargar();
          setVista({ modo: 'lista' });
        }}
      />
    );
  }

  const faltaPerfil = !datos.agente.tieneCedula || !datos.agente.tieneDireccion;

  return (
    <div className="space-y-5">
      {/* La plantilla todavia no pasa revision legal: se dice en el modulo, no
          solo en el PDF (punto 5.4). */}
      {!datos.plantilla.revisada ? (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-amber-700 dark:text-amber-200">
          {datos.plantilla.aviso}
        </p>
      ) : null}

      {faltaPerfil ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">
          {t('contratos.faltaPerfil')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-2">
          {t('contratos.plantillaVersion').replace('{version}', datos.plantilla.version)}
        </p>
        <button
          onClick={() => setVista({ modo: 'nuevo' })}
          className="gradient-btn min-h-[44px] rounded-xl px-5 text-sm font-bold text-grad-contrast"
        >
          {t('contratos.nuevo')}
        </button>
      </div>

      {datos.contratos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-text-2">
          {t('contratos.sinContratos')}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {datos.contratos.map((c) => (
            <Fila key={c.id} contrato={c} t={t} onAbrir={setVista} onEliminar={eliminar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Fila({
  contrato,
  t,
  onAbrir,
  onEliminar,
}: {
  contrato: ContratoResumen;
  t: (k: string) => string;
  onAbrir: (v: Vista) => void;
  onEliminar: (id: string) => void;
}) {
  const definicion = CONTRATO_DEFINICION[contrato.tipo as ContratoTipo];
  const firmados = contrato.firmantes.filter((f) => f.estado === 'FIRMADO').length;
  const total = contrato.firmantes.length;

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text">{definicion.titulo}</p>
          <p className="mt-0.5 text-xs text-text-2">
            {contrato.firmantes.map((f) => f.nombre).join(' · ') || t('contratos.sinPartes')}
          </p>
          <p className="mt-0.5 text-[11px] text-text-3">
            {new Date(contrato.createdAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
            {total > 0 ? ` · ${firmados}/${total} ${t('contratos.firmados')}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            contrato.estado === 'FIRMADO'
              ? 'border-accent-line bg-accent-dim text-accent'
              : contrato.estado === 'PENDIENTE_FIRMA'
                ? 'border-brand-line bg-brand-dim text-brand'
                : 'border-line bg-surface-2 text-text-2'
          }`}
        >
          {t(ETIQUETA_ESTADO[contrato.estado] ?? 'contratos.estado.BORRADOR')}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {contrato.estado === 'BORRADOR' ? (
          <>
            <button
              onClick={() => onAbrir({ modo: 'editar', id: contrato.id })}
              className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
            >
              {t('contratos.continuar')}
            </button>
            <button
              onClick={() => onEliminar(contrato.id)}
              className="min-h-[40px] rounded-lg border border-line px-3 text-xs font-semibold text-text-3 transition hover:text-danger"
            >
              {t('contratos.eliminar')}
            </button>
          </>
        ) : (
          <button
            onClick={() => onAbrir({ modo: 'seguimiento', id: contrato.id })}
            className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
          >
            {t('contratos.verSeguimiento')}
          </button>
        )}
        <a
          href={`/api/real-estate/contratos/${contrato.id}/archivo`}
          className="flex min-h-[40px] items-center rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
        >
          {t('contratos.descargarPdf')}
        </a>
      </div>
    </li>
  );
}

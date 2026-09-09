'use client';

import { useCallback, useEffect, useState } from 'react';
import { CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';
import type { ContratoCompleto } from './tipos-cliente';

// Seguimiento del proceso de firma (punto 3.7): en qué punto está cada parte,
// con la fecha de cada evento, y las dos acciones que el agente necesita:
// reenviar a quien no firmó y anular el proceso.

const PASOS = ['ENVIADO', 'ABIERTO', 'FIRMADO'] as const;

export default function ContratoSeguimiento({
  t,
  contratoId,
  onVolver,
}: {
  t: (k: string) => string;
  contratoId: string;
  onVolver: () => void;
}) {
  const [contrato, setContrato] = useState<ContratoCompleto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [anularAbierto, setAnularAbierto] = useState(false);
  const [nota, setNota] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}`, { cache: 'no-store' });
      if (!r.ok) {
        setError(t('contratos.error.cargar'));
        return;
      }
      const d = await r.json();
      setContrato(d.contrato as ContratoCompleto);
    } finally {
      setCargando(false);
    }
  }, [contratoId, t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function reenviar(firmanteId: string) {
    setAccion(firmanteId);
    setError('');
    setAviso('');
    try {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}/reenviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmanteId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t('contratos.error.reenviar'));
        return;
      }
      setAviso(t('contratos.reenviado'));
      void cargar();
    } finally {
      setAccion(null);
    }
  }

  async function anular() {
    setAccion('anular');
    setError('');
    try {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota: nota.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t('contratos.error.anular'));
        return;
      }
      setAnularAbierto(false);
      void cargar();
    } finally {
      setAccion(null);
    }
  }

  if (cargando) return <p className="text-sm text-text-2">{t('contratos.cargando')}</p>;
  if (!contrato) return <p className="text-sm text-danger">{error || t('contratos.error.cargar')}</p>;

  const definicion = CONTRATO_DEFINICION[contrato.tipo as ContratoTipo];
  const enCurso = contrato.estado === 'PENDIENTE_FIRMA';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-text">{definicion.titulo}</h3>
          <p className="mt-0.5 text-xs text-text-2">
            {t('contratos.identificador')} <span className="font-semibold tracking-[0.06em]">{contrato.codigoVerificacion}</span>
          </p>
        </div>
        <button
          onClick={onVolver}
          className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {t('contratos.volver')}
        </button>
      </div>

      {contrato.estado === 'FIRMADO' ? (
        <p className="rounded-2xl border border-accent-line bg-accent-dim px-4 py-3 text-sm leading-relaxed text-accent">
          {t('contratos.selladoAviso')}
        </p>
      ) : null}
      {contrato.estado === 'ANULADO' ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text-2">
          {t('contratos.anuladoAviso')} {contrato.anuladoNota ? `“${contrato.anuladoNota}”` : ''}
        </p>
      ) : null}
      {contrato.estado === 'RECHAZADO' ? (
        <p className="rounded-2xl border border-danger bg-danger-dim px-4 py-3 text-sm leading-relaxed text-danger">
          {t('contratos.rechazadoAviso')}
        </p>
      ) : null}

      <ul className="space-y-3">
        {contrato.firmantes.map((f) => {
          const alcanzado = (paso: string) =>
            paso === 'ENVIADO'
              ? Boolean(f.enviadoAt)
              : paso === 'ABIERTO'
                ? Boolean(f.abiertoAt)
                : Boolean(f.firmadoAt);
          const rechazado = f.estado === 'RECHAZADO';
          const vencido = !f.firmadoAt && new Date(f.expiraAt).getTime() < Date.now();

          return (
            <li key={f.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text">{f.nombre}</p>
                  <p className="text-xs text-text-2">
                    {f.rolEtiqueta ?? f.rol} · {f.correo}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    rechazado
                      ? 'border-danger text-danger'
                      : f.estado === 'FIRMADO'
                        ? 'border-accent-line bg-accent-dim text-accent'
                        : 'border-line bg-surface-2 text-text-2'
                  }`}
                >
                  {rechazado
                    ? t('contratos.firmante.RECHAZADO')
                    : t(`contratos.firmante.${f.estado}`)}
                </span>
              </div>

              {rechazado ? (
                <p className="mt-2 rounded-xl border border-danger bg-danger-dim px-3 py-2 text-xs leading-relaxed text-danger">
                  {t('contratos.motivoRechazo')} {f.motivoRechazo}
                </p>
              ) : (
                <ol className="mt-3 space-y-1.5">
                  {PASOS.map((paso) => {
                    const fecha = paso === 'ENVIADO' ? f.enviadoAt : paso === 'ABIERTO' ? f.abiertoAt : f.firmadoAt;
                    return (
                      <li key={paso} className="flex items-center justify-between gap-3 text-xs">
                        <span className={alcanzado(paso) ? 'font-semibold text-text' : 'text-text-3'}>
                          {alcanzado(paso) ? '●' : '○'} {t(`contratos.paso.${paso}`)}
                        </span>
                        <span className="text-text-3">
                          {fecha
                            ? new Date(fecha).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              {enCurso && !f.firmadoAt && !rechazado ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void reenviar(f.id)}
                    disabled={accion === f.id}
                    className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2 disabled:opacity-50"
                  >
                    {accion === f.id ? t('contratos.reenviando') : t('contratos.reenviar')}
                  </button>
                  {vencido ? <span className="text-[11px] text-text-3">{t('contratos.enlaceVencido')}</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {aviso ? <p className="rounded-xl border border-accent-line bg-accent-dim px-3.5 py-2.5 text-sm text-accent">{aviso}</p> : null}
      {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/real-estate/contratos/${contratoId}/archivo`}
          className="flex min-h-[44px] items-center rounded-xl border border-line-strong px-5 text-sm font-semibold text-text transition hover:bg-surface-2"
        >
          {t('contratos.descargarPdf')}
        </a>
        <a
          href={`/c/${contrato.codigoVerificacion}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[44px] items-center rounded-xl border border-line px-5 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {t('contratos.verVerificacion')}
        </a>
        {contrato.estado !== 'ANULADO' && contrato.estado !== 'FIRMADO' ? (
          <button
            onClick={() => setAnularAbierto((v) => !v)}
            className="min-h-[44px] rounded-xl border border-line px-5 text-sm font-semibold text-text-3 transition hover:text-danger"
          >
            {t('contratos.anular')}
          </button>
        ) : null}
      </div>

      {anularAbierto ? (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
              {t('contratos.anular.motivo')}
            </span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-sm text-text outline-none focus:border-brand"
            />
          </label>
          <p className="mt-2 text-xs leading-relaxed text-text-3">{t('contratos.anular.detalle')}</p>
          <button
            onClick={() => void anular()}
            disabled={nota.trim().length < 3 || accion === 'anular'}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-danger px-5 text-sm font-bold text-danger transition disabled:opacity-45"
          >
            {t('contratos.anular.confirmar')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

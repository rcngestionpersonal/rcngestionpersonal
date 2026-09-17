'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CambiosEntreVersiones } from '@/lib/real-estate/contratos/clausulas';
import type { ContratoCompleto, ParteResumen, VersionResumen } from './tipos-cliente';

// El recorrido de la negociación: cada versión que salió, qué cambió respecto
// de la anterior, quién la aprobó y cuándo, y qué pidió quien no la aprobó. Es
// lo que el agente lleva a la notaría para mostrar qué se acordó.
//
// Y las acciones que necesita en el camino: editar y enviar la versión
// siguiente, reenviar un enlace a quien no decidió, descargar cualquier versión
// y anular.

const fecha = (valor: string | null) =>
  valor ? new Date(valor).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function ContratoSeguimiento({
  t,
  contratoId,
  onVolver,
  onEditar,
}: {
  t: (k: string) => string;
  contratoId: string;
  onVolver: () => void;
  onEditar: (paso: 'datos' | 'revisar') => void;
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

  async function reenviar(parteId: string) {
    setAccion(parteId);
    setError('');
    setAviso('');
    try {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}/reenviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parteId }),
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

  const n = String(contrato.versionActual);
  const cambiosPendientes = hayCambios(contrato.cambiosSinEnviar);
  const legado = contrato.deFirma;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-text">{contrato.tipoEtiqueta}</h3>
          <p className="mt-0.5 text-xs text-text-2">
            {t('contratos.identificador')} <span className="font-semibold tracking-[0.06em]">{contrato.codigoVerificacion}</span>
            {' · '}
            {t(`contratos.estado.${contrato.estado}`)}
          </p>
        </div>
        <button
          onClick={onVolver}
          className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {t('contratos.volver')}
        </button>
      </div>

      {legado ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">{t('contratos.aviso.deFirma')}</p>
      ) : null}
      {!legado && (contrato.estado === 'APROBADO' || contrato.estado === 'EN_APROBACION' || contrato.estado === 'RECHAZADO') ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-[13px] leading-relaxed ${
            contrato.estado === 'APROBADO'
              ? 'border-accent-line bg-accent-dim text-accent'
              : contrato.estado === 'RECHAZADO'
                ? 'border-danger bg-danger-dim text-danger'
                : 'border-brand-line bg-brand-dim text-brand'
          }`}
        >
          {t(`contratos.aviso.${contrato.estado}`).replace('{n}', n)}
        </p>
      ) : null}
      {contrato.estado === 'ANULADO' ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text-2">
          {t('contratos.anuladoAviso')} {contrato.anuladoNota ? `“${contrato.anuladoNota}”` : ''}
        </p>
      ) : null}

      {contrato.editable && cambiosPendientes ? (
        <div className="rounded-2xl border border-brand-line bg-surface p-4">
          <p className="text-[13px] font-semibold text-text">{t('contratos.aviso.cambiosSinEnviar').replace('{n}', n)}</p>
          {contrato.cambiosSinEnviar ? <ListaCambios t={t} cambios={contrato.cambiosSinEnviar} /> : null}
          <button
            onClick={() => onEditar('revisar')}
            className="gradient-btn mt-3 min-h-[44px] w-full rounded-xl px-5 text-sm font-bold text-grad-contrast sm:w-auto"
          >
            {t('contratos.revisarYEnviar')}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {contrato.editable ? (
          <button
            onClick={() => onEditar('datos')}
            className="min-h-[44px] rounded-xl border border-line-strong px-5 text-sm font-semibold text-text transition hover:bg-surface-2"
          >
            {t('contratos.editarDocumento')}
          </button>
        ) : null}
        <a
          href={`/api/real-estate/contratos/${contratoId}/archivo`}
          className="flex min-h-[44px] items-center rounded-xl border border-line-strong px-5 text-sm font-semibold text-text transition hover:bg-surface-2"
        >
          {t('contratos.descargarPdf')}
        </a>
        {contrato.versionActual > 0 || legado ? (
          <a
            href={`/c/${contrato.codigoVerificacion}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[44px] items-center rounded-xl border border-line px-5 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
          >
            {t('contratos.verVerificacion')}
          </a>
        ) : null}
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
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('contratos.anular.motivo')}</span>
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

      {aviso ? <p className="rounded-xl border border-accent-line bg-accent-dim px-3.5 py-2.5 text-sm text-accent">{aviso}</p> : null}
      {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      {legado ? (
        <ul className="space-y-3">
          {contrato.partes.map((f) => (
            <li key={f.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="truncate text-sm font-bold text-text">{f.nombre}</p>
              <p className="text-xs text-text-2">
                {f.rolEtiqueta ?? f.rol} · {f.correo}
              </p>
              <p className="mt-2 text-xs text-text-3">
                {f.firmadoAt ? `${t('contratos.parte.FIRMADO')} · ${fecha(f.firmadoAt)}` : t('contratos.parte.SIN_DECISION')}
              </p>
            </li>
          ))}
        </ul>
      ) : contrato.versiones.length > 0 ? (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('contratos.recorrido')}</h4>
          <ol className="space-y-3">
            {contrato.versiones.map((v) => (
              <TarjetaVersion
                key={v.numero}
                t={t}
                version={v}
                vigente={v.numero === contrato.versionActual}
                contratoId={contratoId}
                enCurso={contrato.estado === 'EN_APROBACION'}
                accion={accion}
                onReenviar={(id) => void reenviar(id)}
              />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function hayCambios(c: CambiosEntreVersiones | null): boolean {
  return Boolean(c && (c.modificadas.length > 0 || c.agregadas.length > 0 || c.retiradas.length > 0 || c.otros));
}

function ListaCambios({ t, cambios }: { t: (k: string) => string; cambios: CambiosEntreVersiones }) {
  return (
    <ul className="mt-1.5 space-y-0.5 text-[12.5px] leading-relaxed text-text-2">
      {cambios.modificadas.map((c) => (
        <li key={`m-${c}`}>
          {t('contratos.revisar.modificada')} {c}
        </li>
      ))}
      {cambios.agregadas.map((c) => (
        <li key={`a-${c}`}>
          {t('contratos.revisar.agregada')} {c}
        </li>
      ))}
      {cambios.retiradas.map((c) => (
        <li key={`r-${c}`}>
          {t('contratos.revisar.retirada')} {c}
        </li>
      ))}
      {cambios.otros ? <li>{t('contratos.revisar.otros')}</li> : null}
    </ul>
  );
}

function TarjetaVersion({
  t,
  version: v,
  vigente,
  contratoId,
  enCurso,
  accion,
  onReenviar,
}: {
  t: (k: string) => string;
  version: VersionResumen;
  vigente: boolean;
  contratoId: string;
  enCurso: boolean;
  accion: string | null;
  onReenviar: (parteId: string) => void;
}) {
  const tono =
    v.estado === 'APROBADA'
      ? 'border-accent-line bg-accent-dim text-accent'
      : v.estado === 'RECHAZADA'
        ? 'border-danger text-danger'
        : v.estado === 'EN_APROBACION'
          ? 'border-brand-line bg-brand-dim text-brand'
          : 'border-line bg-surface-2 text-text-3';

  return (
    <li className={`rounded-2xl border bg-surface p-4 ${vigente ? 'border-line-strong' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-text">{t('contratos.version').replace('{n}', String(v.numero))}</p>
          <p className="text-xs text-text-3">{t('contratos.enviadaEl').replace('{fecha}', fecha(v.enviadaAt))}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tono}`}>{t(`contratos.version.${v.estado}`)}</span>
      </div>

      {v.cambios && hayCambios(v.cambios) ? (
        <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2">
          <p className="text-[12px] font-semibold text-text-2">{t('contratos.cambiosDesde').replace('{n}', String(v.numero - 1))}</p>
          <ListaCambios t={t} cambios={v.cambios} />
        </div>
      ) : null}

      <ul className="mt-3 space-y-2.5">
        {v.partes.map((p) => (
          <Parte
            key={p.id}
            t={t}
            parte={p}
            versionEnRevision={v.estado === 'EN_APROBACION'}
            puedeReenviar={vigente && enCurso && (p.estado === 'ENVIADO' || p.estado === 'ABIERTO')}
            reenviando={accion === p.id}
            onReenviar={() => onReenviar(p.id)}
          />
        ))}
      </ul>

      <a
        href={`/api/real-estate/contratos/${contratoId}/archivo?version=${v.numero}`}
        className="mt-3 inline-flex min-h-[40px] items-center rounded-lg border border-line px-3 text-xs font-semibold text-text-2 transition hover:bg-surface-2"
      >
        {t('contratos.pdfVersion')}
      </a>
    </li>
  );
}

function Parte({
  t,
  parte: p,
  versionEnRevision,
  puedeReenviar,
  reenviando,
  onReenviar,
}: {
  t: (k: string) => string;
  parte: ParteResumen;
  versionEnRevision: boolean;
  puedeReenviar: boolean;
  reenviando: boolean;
  onReenviar: () => void;
}) {
  const vencido = (p.estado === 'ENVIADO' || p.estado === 'ABIERTO') && new Date(p.expiraAt).getTime() < Date.now();
  const decision =
    p.estado === 'APROBADO' || p.estado === 'RECHAZADO'
      ? t(`contratos.parte.${p.estado}`)
      : versionEnRevision
        ? t(`contratos.parte.${p.estado}`)
        : t('contratos.parte.SIN_DECISION');

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text">{p.nombreParte ?? p.nombre}</p>
          <p className="truncate text-xs text-text-2">
            {p.rolEtiqueta ?? p.rol}
            {p.nombreParte && p.nombreParte !== p.nombre ? ` · p. ${p.nombre}` : ''} · {p.correo}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-bold ${
            p.estado === 'APROBADO' ? 'text-accent' : p.estado === 'RECHAZADO' ? 'text-danger' : 'text-text-3'
          }`}
        >
          {decision}
        </span>
      </div>

      <ol className="mt-2 space-y-1">
        {[
          ['ENVIADO', p.enviadoAt],
          ['ABIERTO', p.abiertoAt],
          ...(p.estado === 'RECHAZADO' ? [] : [['APROBADO', p.aprobadoAt]]),
        ].map(([paso, cuando]) => (
          <li key={paso} className="flex items-center justify-between gap-3 text-[11.5px]">
            <span className={cuando ? 'font-semibold text-text' : 'text-text-3'}>
              {cuando ? '●' : '○'} {t(`contratos.paso.${paso}`)}
            </span>
            <span className="text-text-3">{fecha(cuando)}</span>
          </li>
        ))}
      </ol>

      {p.estado === 'RECHAZADO' ? (
        <p className="mt-2 rounded-lg border border-danger bg-danger-dim px-3 py-2 text-xs leading-relaxed text-danger">
          {t('contratos.motivoRechazo')} {p.motivoRechazo} · {fecha(p.rechazadoAt)}
        </p>
      ) : null}

      {puedeReenviar ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={onReenviar}
            disabled={reenviando}
            className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2 disabled:opacity-50"
          >
            {reenviando ? t('contratos.reenviando') : t('contratos.reenviar')}
          </button>
          {vencido ? <span className="text-[11px] text-text-3">{t('contratos.enlaceVencido')}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

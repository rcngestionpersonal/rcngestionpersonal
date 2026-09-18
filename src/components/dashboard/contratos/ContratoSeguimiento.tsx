'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CambiosEntreVersiones } from '@/lib/real-estate/contratos/clausulas';
import type { ContratoCompleto, EventoResumen, ParteResumen, VersionResumen } from './tipos-cliente';
import EncabezadoSecundario from '@/components/navegacion/EncabezadoSecundario';
import BotonCerrar, { useCerrarConEscape } from '@/components/navegacion/BotonCerrar';
import Superpuesto from '@/components/navegacion/Superpuesto';
import { tCantidad } from '@/lib/i18n/plural';

// El recorrido de la negociación, etapa por etapa: primero revisa el cliente
// del agente y, cuando aprueba y el agente lo decide, la contraparte.
//
// Arriba, dónde está el contrato ("1. Vendedor → 2. Comprador → Listo para
// notaría") y lo que toca hacer ahora. Debajo, cada versión con quién decidió
// qué, los enlaces para compartir por WhatsApp, y el historial completo.

const fecha = (valor: string | null) =>
  valor ? new Date(valor).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }) : '—';

export function textoVigencia(t: (k: string) => string, horas: number): string {
  return horas % 24 === 0 && horas > 72
    ? t('contratos.vigencia.dias').replace('{n}', String(horas / 24))
    : t('contratos.vigencia.horas').replace('{n}', String(horas));
}

// Rellena los {marcadores} y deja la oración con mayúscula inicial: la etapa
// ("vendedor") puede quedar al principio.
export function reemplazar(texto: string, valores: Record<string, string | number | null | undefined>): string {
  const lleno = Object.entries(valores).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v ?? '')), texto);
  return lleno.charAt(0).toUpperCase() + lleno.slice(1);
}

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
  const [enviarContraparte, setEnviarContraparte] = useState(false);
  const [vigencia, setVigencia] = useState<number | null>(null);
  const [porCorreo, setPorCorreo] = useState(false);

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

  async function llamar(ruta: string, cuerpo: Record<string, unknown>, clave: string): Promise<Record<string, unknown> | null> {
    setAccion(clave);
    setError('');
    setAviso('');
    try {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t('contratos.error.reenviar'));
        return null;
      }
      return d;
    } catch {
      setError(t('contratos.error.reenviar'));
      return null;
    } finally {
      setAccion(null);
    }
  }

  async function regenerar(parteId: string) {
    const d = await llamar('/reenviar', { parteId, accion: 'regenerar' }, `regenerar-${parteId}`);
    if (d) {
      setAviso(t('contratos.regenerado'));
      await cargar();
    }
  }

  async function porCorreoA(parteId: string) {
    const d = await llamar('/reenviar', { parteId, accion: 'correo' }, `correo-${parteId}`);
    if (d) setAviso(t('contratos.correoEnviado'));
  }

  function compartirWhatsApp(parte: ParteResumen) {
    if (!parte.enlace) return;
    window.open(parte.enlace.whatsapp, '_blank', 'noopener,noreferrer');
    // Queda en el historial que el agente lo compartió. No bloquea.
    void fetch(`/api/real-estate/contratos/${contratoId}/reenviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parteId: parte.id, accion: 'whatsapp' }),
    }).then(() => cargar());
  }

  async function copiar(parte: ParteResumen) {
    if (!parte.enlace) return;
    try {
      await navigator.clipboard.writeText(parte.enlace.mensaje);
      setAviso(t('contratos.compartir.copiado'));
    } catch {
      setError(parte.enlace.url);
    }
  }

  async function confirmarEnvioContraparte() {
    if (!contrato) return;
    const d = await llamar(
      '/enviar',
      { destino: 'CONTRAPARTE', simultaneo: false, correccionMenor: false, porCorreo, vigenciaHoras: vigencia ?? contrato.vigenciaHoras },
      'enviar-contraparte',
    );
    if (d) {
      setEnviarContraparte(false);
      setAviso(t('contratos.enviado'));
      await cargar();
    }
  }

  async function anular() {
    const d = await llamar('', { nota: nota.trim() }, 'anular');
    if (d) {
      setAnularAbierto(false);
      await cargar();
    }
  }

  // Fijo arriba y también mientras carga o si falla: nunca sin salida.
  const encabezado = (titulo: string) => (
    <EncabezadoSecundario enPanel onVolver={onVolver} titulo={titulo} etiquetaVolver={t('contratos.volver')} />
  );
  if (cargando)
    return (
      <div className="space-y-5">
        {encabezado(t('contratos.title'))}
        <p className="text-sm text-text-2">{t('contratos.cargando')}</p>
      </div>
    );
  if (!contrato)
    return (
      <div className="space-y-5">
        {encabezado(t('contratos.title'))}
        <p className="text-sm text-danger">{error || t('contratos.error.cargar')}</p>
      </div>
    );

  const n = contrato.versionActual;
  const legado = contrato.deFirma;
  const vigente = contrato.versiones.find((v) => v.numero === n) ?? null;
  const principal = contrato.etiquetas.PRINCIPAL;
  const contraparte = contrato.etiquetas.CONTRAPARTE;
  const valores = {
    n,
    principal: principal?.toLowerCase() ?? t('contratos.tuCliente'),
    contraparte: contraparte?.toLowerCase() ?? t('contratos.laContraparte'),
  };
  // "Enviar a Juan Pérez": por nombre si el servidor lo conoce; si no, el lado.
  const aContraparte = contrato.destinos?.CONTRAPARTE || valores.contraparte;
  const cambiosPendientes = hayCambios(contrato.cambiosSinEnviar);
  const rechazo = vigente?.partes.find((p) => p.estado === 'RECHAZADO') ?? null;
  const pendientesVigentes = vigente?.partes.filter((p) => p.estado === 'ENVIADO' || p.estado === 'ABIERTO') ?? [];

  const tono =
    contrato.estado === 'APROBADO_FINAL'
      ? 'border-accent-line bg-accent-dim text-accent'
      : contrato.estado.startsWith('CAMBIOS_SOLICITADOS') || contrato.estado === 'VENCIDO'
        ? 'border-danger bg-danger-dim text-danger'
        : contrato.estado === 'APROBADO_PRINCIPAL'
          ? 'border-accent-line bg-accent-dim text-accent'
          : 'border-brand-line bg-brand-dim text-brand';

  const clavesAviso: Record<string, string> = {
    BORRADOR: 'contratos.aviso.BORRADOR',
    EN_REVISION_PRINCIPAL: 'contratos.aviso.EN_REVISION_PRINCIPAL',
    APROBADO_PRINCIPAL: 'contratos.aviso.APROBADO_PRINCIPAL',
    EN_REVISION_CONTRAPARTE: principal ? 'contratos.aviso.EN_REVISION_CONTRAPARTE' : 'contratos.aviso.EN_REVISION_CONTRAPARTE.sinPrincipal',
    CAMBIOS_SOLICITADOS_PRINCIPAL: 'contratos.aviso.CAMBIOS_SOLICITADOS_PRINCIPAL',
    CAMBIOS_SOLICITADOS_CONTRAPARTE: 'contratos.aviso.CAMBIOS_SOLICITADOS_CONTRAPARTE',
    VENCIDO: 'contratos.aviso.VENCIDO',
    APROBADO_FINAL: contraparte && principal ? 'contratos.aviso.APROBADO_FINAL' : 'contratos.aviso.APROBADO_FINAL.unaEtapa',
  };

  return (
    <div className="space-y-5">
      {encabezado(contrato.tipoEtiqueta)}
      <p className="text-xs text-text-2">
        {t('contratos.identificador')} <span className="font-semibold tracking-[0.06em]">{contrato.codigoVerificacion}</span>
        {' · '}
        {legado ? t('contratos.filaDeFirma') : t(`contratos.estado.${contrato.estado}`)}
      </p>

      {/* Dónde está el contrato. */}
      {!legado && contrato.indicador.length > 0 && contrato.estado !== 'ANULADO' ? (
        <ol aria-label={t('contratos.indicador')} className="flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-2xl border border-line bg-surface p-3">
          {contrato.indicador.map((paso, i) => (
            <li key={paso.clave} className="flex items-center gap-1.5">
              <span
                className={`flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${
                  paso.situacion === 'cambios_pedidos'
                    ? 'border-danger bg-danger-dim text-danger'
                    : paso.estado === 'hecho'
                      ? 'border-accent-line bg-accent-dim text-accent'
                      : paso.estado === 'actual'
                        ? 'border-brand-line bg-brand-dim text-brand'
                        : 'border-line text-text-3'
                }`}
                aria-current={paso.estado === 'actual' ? 'step' : undefined}
              >
                {paso.clave === 'NOTARIA'
                  ? `${paso.estado === 'hecho' ? '✓ ' : ''}${paso.etiqueta}`
                  : paso.situacion
                    ? `${i + 1}. ${paso.etiqueta}: ${t(`contratos.situacion.${paso.situacion}`)}`
                    : `${paso.estado === 'hecho' ? '✓' : `${i + 1}.`} ${paso.etiqueta}`}
              </span>
              {i < contrato.indicador.length - 1 ? <span className="text-text-3" aria-hidden="true">→</span> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {legado ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">{t('contratos.aviso.deFirma')}</p>
      ) : null}

      {!legado && contrato.estado !== 'ANULADO' && clavesAviso[contrato.estado] ? (
        <div className={`rounded-2xl border px-4 py-3 ${tono}`}>
          <p className="text-[13.5px] leading-relaxed">{reemplazar(t(clavesAviso[contrato.estado]), valores)}</p>
          {rechazo?.motivoRechazo ? (
            <p className="mt-2 rounded-xl bg-surface px-3 py-2 text-[13px] leading-relaxed text-text">
              <span className="font-semibold">{rechazo.nombreParte ?? rechazo.nombre}:</span> “{rechazo.motivoRechazo}”
            </p>
          ) : null}

          {/* Lo que toca hacer ahora. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {contrato.estado === 'APROBADO_PRINCIPAL' && contrato.editable && !cambiosPendientes ? (
              <button
                onClick={() => {
                  setEnviarContraparte(true);
                  setVigencia(contrato.vigenciaHoras);
                  setPorCorreo(false);
                }}
                className="gradient-btn min-h-[48px] w-full rounded-xl px-5 text-sm font-bold text-grad-contrast sm:w-auto"
              >
                {reemplazar(t('contratos.enviarA'), { etapa: aContraparte })}
              </button>
            ) : null}
            {(contrato.estado === 'CAMBIOS_SOLICITADOS_PRINCIPAL' || contrato.estado === 'CAMBIOS_SOLICITADOS_CONTRAPARTE' || contrato.estado === 'BORRADOR') &&
            contrato.editable ? (
              <button
                onClick={() => onEditar(contrato.estado === 'BORRADOR' ? 'revisar' : 'datos')}
                className="gradient-btn min-h-[48px] w-full rounded-xl px-5 text-sm font-bold text-grad-contrast sm:w-auto"
              >
                {contrato.estado === 'BORRADOR' ? t('contratos.revisarYEnviar') : t('contratos.editarDocumento')}
              </button>
            ) : null}
            {contrato.estado === 'APROBADO_FINAL' && vigente ? (
              <a
                href={`/api/real-estate/contratos/${contratoId}/archivo?version=${vigente.numero}`}
                className="gradient-btn flex min-h-[48px] w-full items-center justify-center rounded-xl px-5 text-sm font-bold text-grad-contrast sm:w-auto"
              >
                {t('contratos.pdfFinal')}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {contrato.estado === 'ANULADO' ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text-2">
          {t('contratos.anuladoAviso')} {contrato.anuladoNota ? `“${contrato.anuladoNota}”` : ''}
        </p>
      ) : null}

      {aviso ? <p className="rounded-xl border border-accent-line bg-accent-dim px-3.5 py-2.5 text-sm text-accent">{aviso}</p> : null}
      {error ? <p className="break-all rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      {/* Quienes aún no deciden la versión vigente: el enlace a mano. */}
      {!legado && pendientesVigentes.length > 0 && vigente?.estado === 'EN_APROBACION' ? (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('contratos.compartir.titulo')}</p>
          <ul className="mt-2 space-y-2.5">
            {pendientesVigentes.map((p) => (
              <EnlacePendiente
                key={p.id}
                t={t}
                parte={p}
                etiquetaEtapa={p.etapa ? contrato.etiquetas[p.etapa] : null}
                ocupado={accion}
                onWhatsApp={() => compartirWhatsApp(p)}
                onCorreo={() => void porCorreoA(p.id)}
                onCopiar={() => void copiar(p)}
                onRegenerar={() => void regenerar(p.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {contrato.editable && cambiosPendientes && n > 0 ? (
        <div className="rounded-2xl border border-brand-line bg-surface p-4">
          <p className="text-[13px] font-semibold text-text">{t('contratos.aviso.cambiosSinEnviar').replace('{n}', String(n))}</p>
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
        {n > 0 || legado ? (
          <a
            href={`/c/${contrato.codigoVerificacion}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[44px] items-center rounded-xl border border-line px-5 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
          >
            {t('contratos.verVerificacion')}
          </a>
        ) : null}
        {contrato.estado !== 'ANULADO' && !legado ? (
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
              <TarjetaVersion key={v.numero} t={t} version={v} vigente={v.numero === n} contratoId={contratoId} />
            ))}
          </ol>
        </section>
      ) : null}

      {!legado && contrato.eventos.length > 0 ? <Historial t={t} eventos={contrato.eventos} etiquetas={contrato.etiquetas} /> : null}

      {enviarContraparte ? (
        <Dialogo onCerrar={() => setEnviarContraparte(false)}>
          <h4 className="text-base font-bold text-text">{reemplazar(t('contratos.enviarA'), { etapa: aContraparte })}</h4>
          <p className="mt-1 text-[13px] leading-relaxed text-text-2">{reemplazar(t('contratos.enviarContraparte.detalle'), valores)}</p>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('contratos.vigencia')}</span>
            <select
              value={vigencia ?? contrato.vigenciaHoras}
              onChange={(e) => setVigencia(Number(e.target.value))}
              className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-text"
            >
              {contrato.vigencias.map((h) => (
                <option key={h} value={h}>
                  {textoVigencia(t, h)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 flex cursor-pointer items-start gap-3 py-1">
            <input type="checkbox" checked={porCorreo} onChange={(e) => setPorCorreo(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="text-[13.5px] leading-relaxed text-text-2">{t('contratos.porCorreo')}</span>
          </label>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              onClick={() => void confirmarEnvioContraparte()}
              disabled={accion === 'enviar-contraparte'}
              className="gradient-btn min-h-[48px] rounded-xl px-6 text-sm font-bold text-grad-contrast disabled:opacity-50 sm:min-w-[180px]"
            >
              {accion === 'enviar-contraparte' ? t('contratos.enviando') : t('contratos.confirmar.enviar')}
            </button>
            <button
              onClick={() => setEnviarContraparte(false)}
              className="min-h-[48px] rounded-xl border border-line px-6 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
            >
              {t('common.cancelar')}
            </button>
          </div>
        </Dialogo>
      ) : null}
    </div>
  );
}

export function Dialogo({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  useCerrarConEscape(onCerrar);
  return (
    <Superpuesto>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" onClick={onCerrar}>
        <div
          className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bg-alt px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3 sm:rounded-2xl sm:pb-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="-mr-2 flex justify-end">
            <BotonCerrar onCerrar={onCerrar} />
          </div>
          {children}
        </div>
      </div>
    </Superpuesto>
  );
}

function EnlacePendiente({
  t,
  parte: p,
  etiquetaEtapa,
  ocupado,
  onWhatsApp,
  onCorreo,
  onCopiar,
  onRegenerar,
}: {
  t: (k: string) => string;
  parte: ParteResumen;
  etiquetaEtapa: string | null;
  ocupado: string | null;
  onWhatsApp: () => void;
  onCorreo: () => void;
  onCopiar: () => void;
  onRegenerar: () => void;
}) {
  const vencido = new Date(p.expiraAt).getTime() < Date.now();
  const intentos = p.intentosFallidos ?? 0;
  const boton = 'min-h-[44px] rounded-xl border px-3 text-[13px] font-semibold transition disabled:opacity-50';
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-text">{p.nombreParte ?? p.nombre}</p>
          <p className="truncate text-xs text-text-2">
            {p.rolEtiqueta ?? p.rol}
            {etiquetaEtapa ? ` · ${etiquetaEtapa}` : ''}
            {p.nombreParte && p.nombreParte !== p.nombre ? ` · p. ${p.nombre}` : ''}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold ${vencido || p.bloqueado ? 'text-danger' : 'text-text-3'}`}>
          {p.bloqueado
            ? t('contratos.enlaceBloqueado').replace('{n}', String(intentos))
            : vencido
              ? t('contratos.enlaceVencido')
              : `${t('contratos.parte.' + p.estado)} · ${t('contratos.venceEl').replace('{fecha}', fecha(p.expiraAt))}`}
        </span>
      </div>
      {!p.bloqueado && intentos > 0 ? (
        <p className="mt-1 text-xs font-semibold text-danger">{tCantidad(t, 'contratos.intentosFallidos', intentos)}</p>
      ) : null}
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {!vencido && !p.bloqueado && p.enlace ? (
          <>
            <button onClick={onWhatsApp} className={`${boton} col-span-2 border-accent-line bg-accent-dim text-accent sm:col-span-1`}>
              {t('contratos.compartir.whatsapp')}
            </button>
            <button onClick={onCopiar} className={`${boton} border-line text-text-2 hover:bg-surface-2`}>
              {t('contratos.compartir.copiar')}
            </button>
            {p.correo ? (
              <button onClick={onCorreo} disabled={ocupado === `correo-${p.id}`} className={`${boton} border-line text-text-2 hover:bg-surface-2`}>
                {t('contratos.compartir.correo')}
              </button>
            ) : null}
          </>
        ) : null}
        {p.puedeRegenerar ? (
          <button
            onClick={onRegenerar}
            disabled={ocupado === `regenerar-${p.id}`}
            className={`${boton} ${vencido || !p.enlace ? 'col-span-2 border-brand-line bg-brand-dim text-brand sm:col-span-1' : 'border-line text-text-3 hover:bg-surface-2'}`}
          >
            {ocupado === `regenerar-${p.id}` ? t('contratos.regenerando') : t('contratos.regenerar')}
          </button>
        ) : null}
      </div>
    </li>
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

function TarjetaVersion({ t, version: v, vigente, contratoId }: { t: (k: string) => string; version: VersionResumen; vigente: boolean; contratoId: string }) {
  const tono =
    v.estado === 'APROBADA'
      ? 'border-accent-line bg-accent-dim text-accent'
      : v.estado === 'RECHAZADA'
        ? 'border-danger text-danger'
        : v.estado === 'EN_APROBACION'
          ? 'border-brand-line bg-brand-dim text-brand'
          : 'border-line bg-surface-2 text-text-3';

  const etapas = (['PRINCIPAL', 'CONTRAPARTE'] as const).filter((e) => v.etiquetas[e]);

  return (
    <li className={`rounded-2xl border bg-surface p-4 ${vigente ? 'border-line-strong' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-text">{t('contratos.version').replace('{n}', String(v.numero))}</p>
          <p className="text-xs text-text-3">{t('contratos.enviadaEl').replace('{fecha}', fecha(v.enviadaAt))}</p>
          {v.simultanea ? <p className="text-xs font-semibold text-danger">{t('contratos.version.simultanea')}</p> : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tono}`}>{t(`contratos.version.${v.estado}`)}</span>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{v.resultado}</p>

      {v.cambios && hayCambios(v.cambios) ? (
        <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2">
          <p className="text-[12px] font-semibold text-text-2">{t('contratos.cambiosDesde').replace('{n}', String(v.numero - 1))}</p>
          <ListaCambios t={t} cambios={v.cambios} />
        </div>
      ) : null}

      {etapas.map((etapa, i) => {
        const partes = v.partes.filter((p) => (p.etapa ?? 'PRINCIPAL') === etapa);
        return (
          <div key={etapa} className="mt-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-3">
              {i + 1}. {v.etiquetas[etapa]}
            </p>
            {etapa === 'PRINCIPAL' && v.principalHeredadaDe !== null ? (
              <p className="mt-1 text-[12.5px] text-text-2">{t('contratos.version.heredada').replace('{n}', String(v.principalHeredadaDe))}</p>
            ) : partes.length === 0 ? (
              <p className="mt-1 text-[12.5px] text-text-3">{t('contratos.version.sinEnviar')}</p>
            ) : (
              <ul className="mt-1.5 space-y-2">
                {partes.map((p) => (
                  <Parte key={p.id} t={t} parte={p} versionEnRevision={v.estado === 'EN_APROBACION'} />
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <a
        href={`/api/real-estate/contratos/${contratoId}/archivo?version=${v.numero}`}
        className="mt-3 inline-flex min-h-[40px] items-center rounded-lg border border-line px-3 text-xs font-semibold text-text-2 transition hover:bg-surface-2"
      >
        {v.estado === 'APROBADA' ? t('contratos.pdfFinal') : t('contratos.pdfVersion')}
      </a>
    </li>
  );
}

function Parte({ t, parte: p, versionEnRevision }: { t: (k: string) => string; parte: ParteResumen; versionEnRevision: boolean }) {
  const decision =
    p.estado === 'APROBADO' || p.estado === 'RECHAZADO' || versionEnRevision ? t(`contratos.parte.${p.estado}`) : t('contratos.parte.SIN_DECISION');
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text">{p.nombreParte ?? p.nombre}</p>
          <p className="truncate text-xs text-text-2">
            {p.rolEtiqueta ?? p.rol}
            {p.nombreParte && p.nombreParte !== p.nombre ? ` · p. ${p.nombre}` : ''}
            {p.correo ? ` · ${p.correo}` : ''}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-bold ${p.estado === 'APROBADO' ? 'text-accent' : p.estado === 'RECHAZADO' ? 'text-danger' : 'text-text-3'}`}>
          {decision}
        </span>
      </div>
      <ol className="mt-2 space-y-1">
        {[
          ['ENVIADO', p.enviadoAt],
          ['ABIERTO', p.abiertoAt],
          ...(p.estado === 'RECHAZADO' ? [['RECHAZADO', p.rechazadoAt]] : [['APROBADO', p.aprobadoAt]]),
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
          {t('contratos.motivoRechazo')} {p.motivoRechazo}
        </p>
      ) : null}
    </li>
  );
}

function Historial({ t, eventos, etiquetas }: { t: (k: string) => string; eventos: EventoResumen[]; etiquetas: ContratoCompleto['etiquetas'] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <section>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('contratos.historial')}</h4>
      <ol className="relative space-y-0 border-l border-line pl-4">
        {eventos.map((e) => {
          const titulo = reemplazar(t(`contratos.evento.${e.tipo}`), {
            n: e.versionNumero ?? '',
            nombre: e.nombre ?? e.rolEtiqueta ?? '',
            etapa: (e.etapa && etiquetas[e.etapa] ? etiquetas[e.etapa]! : e.etapa === 'CONTRAPARTE' ? t('contratos.laContraparte') : t('contratos.tuCliente')).toLowerCase(),
          });
          const tecnico = e.ip || e.navegador || e.huella;
          return (
            <li key={e.id} className="relative pb-3">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-line-strong bg-surface" aria-hidden="true" />
              <p className="text-[13px] font-semibold leading-snug text-text">
                {titulo}
                {e.canal ? <span className="font-normal text-text-2"> · {t(`contratos.evento.canal.${e.canal}`)}</span> : null}
              </p>
              <p className="text-[11.5px] text-text-3">
                {e.fechaEcuador ?? fecha(e.fecha)}
                {e.actor === 'AGENTE' ? ` · ${t('contratos.actor.AGENTE')}` : e.actor === 'SISTEMA' ? ` · ${t('contratos.actor.SISTEMA')}` : ''}
              </p>
              {e.comentario ? <p className="mt-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-text-2">“{e.comentario}”</p> : null}
              {e.campos && e.campos.length > 0 ? <p className="mt-1 text-[12px] text-text-2">{e.campos.join(' · ')}</p> : null}
              {e.nota && e.tipo !== 'APROBACION' ? <p className="mt-1 text-[12px] leading-relaxed text-text-2">{e.nota}</p> : null}
              {tecnico ? (
                <button onClick={() => setAbierto(abierto === e.id ? null : e.id)} className="mt-0.5 min-h-[32px] text-[11.5px] font-semibold text-text-3 underline-offset-2 hover:underline">
                  {abierto === e.id ? t('contratos.historial.ocultar') : t('contratos.historial.detalle')}
                </button>
              ) : null}
              {abierto === e.id ? (
                <dl className="mt-1 space-y-0.5 break-all text-[11px] text-text-3">
                  {e.ip ? <div>IP: {e.ip}</div> : null}
                  {e.navegador ? <div>{e.navegador}</div> : null}
                  {e.huella ? <div>SHA-256: {e.huella}</div> : null}
                </dl>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

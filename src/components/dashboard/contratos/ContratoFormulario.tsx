'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CONTRATO_DEFINICION,
  CONTRATO_MENU,
  ENLACE_EXPLICAR_CLIENTE,
  ENLACE_EXPLICAR_CLIENTE_ETIQUETA,
  ENLACE_REVISION_ABOGADO,
  ENLACE_REVISION_ABOGADO_ETIQUETA,
  camposFaltantes,
  type CampoDefinicion,
  type ContratoTipo,
} from '@/lib/real-estate/contratos/tipos';
import type { ContratoCompleto, ListingOpcion, PlantillaVigente } from './tipos-cliente';

// El formulario que el agente completa frente al cliente.
//
// PRINCIPIO (punto 1.1): está en el celular, con alguien esperando. Un solo
// desplazamiento, secciones cortas, todo lo que el sistema ya sabe viene
// puesto y lo que admite un valor razonable viene con él.

const campoClase =
  'min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand';

export default function ContratoFormulario({
  t,
  listings,
  plantilla,
  contratoId,
  onCancelar,
  onEnviado,
}: {
  t: (k: string) => string;
  listings: ListingOpcion[];
  plantilla: { aviso: string; versiones: PlantillaVigente[] };
  contratoId: string | null;
  onCancelar: () => void;
  onEnviado: (id: string) => void;
}) {
  const [tipo, setTipo] = useState<ContratoTipo | null>(null);
  const [listingId, setListingId] = useState<string | null>(listings[0]?.id ?? null);
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [id, setId] = useState<string | null>(contratoId);
  const [cargando, setCargando] = useState(Boolean(contratoId));
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga de un borrador existente.
  useEffect(() => {
    if (!contratoId) return;
    void (async () => {
      try {
        const r = await fetch(`/api/real-estate/contratos/${contratoId}`, { cache: 'no-store' });
        if (!r.ok) {
          setError(t('contratos.error.cargar'));
          return;
        }
        const d = await r.json();
        const c = d.contrato as ContratoCompleto;
        setTipo(c.tipo);
        setListingId(c.listingId);
        setDatos(c.datos);
      } finally {
        setCargando(false);
      }
    })();
  }, [contratoId, t]);

  // Valores por defecto al elegir el tipo (punto 1.4).
  function elegirTipo(nuevo: ContratoTipo) {
    setTipo(nuevo);
    const iniciales: Record<string, string> = {};
    for (const seccion of CONTRATO_DEFINICION[nuevo].secciones) {
      for (const campo of seccion.campos) {
        if (campo.porDefecto !== undefined) iniciales[campo.clave] = campo.porDefecto;
      }
    }
    setDatos(iniciales);
  }

  const guardar = useCallback(
    async (siguientes: Record<string, string>, tipoActual: ContratoTipo, listing: string | null, idActual: string | null) => {
      setGuardando(true);
      try {
        if (!idActual) {
          const r = await fetch('/api/real-estate/contratos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: tipoActual, listingId: listing, datos: siguientes }),
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok) setId(d.contrato.id);
          return d.contrato?.id ?? null;
        }
        const r = await fetch(`/api/real-estate/contratos/${idActual}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datos: siguientes, listingId: listing }),
        });
        await r.json().catch(() => ({}));
        return idActual;
      } finally {
        setGuardando(false);
      }
    },
    [],
  );

  function editar(clave: string, valor: string) {
    const siguientes = { ...datos, [clave]: valor };
    setDatos(siguientes);
    if (!tipo) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void guardar(siguientes, tipo, listingId, id), 900);
  }

  const pendientes = useMemo(() => (tipo ? camposFaltantes(tipo, datos) : []), [tipo, datos]);

  async function enviarAFirma() {
    if (!tipo) return;
    setEnviando(true);
    setError('');
    try {
      const idFinal = (await guardar(datos, tipo, listingId, id)) ?? id;
      if (!idFinal) {
        setError(t('contratos.error.guardar'));
        return;
      }
      const r = await fetch(`/api/real-estate/contratos/${idFinal}/enviar`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.faltantes?.length ? `${d.error} ${d.faltantes.join(', ')}` : (d.error ?? t('contratos.error.enviar')));
        return;
      }
      onEnviado(idFinal);
    } catch {
      setError(t('contratos.error.enviar'));
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <p className="text-sm text-text-2">{t('contratos.cargando')}</p>;

  // ---- Paso 0: qué documento ----------------------------------------------
  if (!tipo) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-bold text-text">{t('contratos.elegirTipo')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONTRATO_MENU.map((entrada) => {
            const definicion = CONTRATO_DEFINICION[entrada.tipo];
            return (
              <button
                key={entrada.tipo}
                onClick={() => elegirTipo(entrada.tipo)}
                className="min-h-[44px] rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-line-strong"
              >
                <p className="text-sm font-bold text-text">{definicion.titulo}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-2">{definicion.descripcion}</p>
                {definicion.ayuda ? (
                  <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-text-2">
                    {definicion.ayuda}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
        {/* Nota discreta bajo el selector: informa, no advierte. Las plantillas
            se basan en formatos de uso comun, asi que un banner de alerta
            permanente diria algo que ya no es cierto. */}
        <p className="text-[11.5px] leading-relaxed text-text-3">{plantilla.aviso}</p>
        <button
          onClick={onCancelar}
          className="min-h-[44px] rounded-xl border border-line px-6 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {t('common.cancelar')}
        </button>
      </div>
    );
  }

  const definicion = CONTRATO_DEFINICION[tipo];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-text">{definicion.titulo}</h3>
          <p className="text-xs text-text-2">
            {guardando ? t('contratos.guardando') : t('contratos.guardadoSolo')}
          </p>
        </div>
        <button
          onClick={onCancelar}
          className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {t('contratos.volver')}
        </button>
      </div>


      {/* Advertencia propia del tipo: el arrendamiento la lleva por el 5.7. */}
      {definicion.ayuda ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">
          {definicion.ayuda}
        </p>
      ) : null}

      {/* Inmueble: se elige del inventario y sus datos entran solos (punto 1.2) */}
      {definicion.requiereInmueble ? (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('contratos.inmueble')}</p>
          {listings.length === 0 ? (
            <p className="mt-2 text-sm text-text-2">{t('contratos.sinInmuebles')}</p>
          ) : (
            <select
              value={listingId ?? ''}
              onChange={(e) => {
                setListingId(e.target.value || null);
                if (tipo) void guardar(datos, tipo, e.target.value || null, id);
              }}
              aria-label={t('contratos.inmueble')}
              className={`${campoClase} mt-2`}
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} — {[l.zone, l.city].filter(Boolean).join(', ')}
                </option>
              ))}
            </select>
          )}
        </section>
      ) : null}

      {definicion.secciones.map((seccion) => (
        <section key={seccion.clave} className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{seccion.titulo}</p>
          {seccion.descripcion ? <p className="mt-1 text-xs text-text-3">{seccion.descripcion}</p> : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {seccion.campos.map((campo) => (
              <Campo key={campo.clave} campo={campo} valor={datos[campo.clave] ?? ''} onChange={editar} />
            ))}
          </div>
        </section>
      ))}

      {pendientes.length > 0 ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">
          {t('contratos.faltanCampos')} {pendientes.join(', ')}.
        </p>
      ) : null}

      {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button
          onClick={() => setConfirmar(true)}
          disabled={pendientes.length > 0 || enviando}
          className="gradient-btn min-h-[48px] rounded-xl px-6 text-sm font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[200px]"
        >
          {t('contratos.enviarFirma')}
        </button>
        {id ? (
          <a
            href={`/api/real-estate/contratos/${id}/archivo?previa=1`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[48px] items-center justify-center rounded-xl border border-line px-6 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
          >
            {t('contratos.vistaPrevia')}
          </a>
        ) : null}
      </div>

      {/* Dos enlaces con públicos distintos: uno orienta sobre cuándo conviene
          un abogado, el otro le da al agente el guion para presentar el
          documento con seguridad en vez de disculparse por él. */}
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] leading-relaxed text-text-3">
        <a href={ENLACE_EXPLICAR_CLIENTE} className="font-semibold text-accent hover:underline">
          {ENLACE_EXPLICAR_CLIENTE_ETIQUETA}
        </a>
        <a href={ENLACE_REVISION_ABOGADO} className="font-semibold text-accent hover:underline">
          {ENLACE_REVISION_ABOGADO_ETIQUETA}
        </a>
      </p>

      {/* Confirmación explícita: quién va a recibir el documento (punto 3.2b) */}
      {confirmar ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmar(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bg-alt p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-bold text-text">{t('contratos.confirmar.titulo')}</h4>
            <p className="mt-1 text-xs leading-relaxed text-text-2">{t('contratos.confirmar.detalle')}</p>
            <ul className="mt-4 space-y-2">
              {definicion.secciones
                .flatMap((s) => s.campos)
                .filter((c) => c.rolFirmante && c.tipo === 'correo')
                .map((c) => {
                  const rol = c.rolFirmante as string;
                  return (
                    <li key={rol} className="rounded-xl border border-line bg-surface p-3">
                      <p className="text-sm font-semibold text-text">{datos[`${rol}_nombre`] || '—'}</p>
                      <p className="text-xs text-text-2">{datos[`${rol}_correo`] || '—'}</p>
                      <p className="text-[11px] text-text-3">
                        {t('contratos.confirmar.cedula')} ••••{(datos[`${rol}_cedula`] ?? '').replace(/\D/g, '').slice(-4)}
                      </p>
                    </li>
                  );
                })}
            </ul>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                onClick={() => void enviarAFirma()}
                disabled={enviando}
                className="gradient-btn min-h-[44px] rounded-xl px-6 text-sm font-bold text-grad-contrast disabled:opacity-50 sm:min-w-[160px]"
              >
                {enviando ? t('contratos.enviando') : t('contratos.confirmar.enviar')}
              </button>
              <button
                onClick={() => setConfirmar(false)}
                className="min-h-[44px] rounded-xl border border-line px-6 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
              >
                {t('common.cancelar')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Campo({
  campo,
  valor,
  onChange,
}: {
  campo: CampoDefinicion;
  valor: string;
  onChange: (clave: string, valor: string) => void;
}) {
  const etiqueta = (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
      {campo.etiqueta}
      {campo.obligatorio ? <span className="text-danger"> *</span> : null}
    </span>
  );

  const ayuda = campo.ayuda ? <span className="mt-1 block text-[11px] leading-relaxed text-text-3">{campo.ayuda}</span> : null;

  if (campo.tipo === 'opcion') {
    return (
      <label className="block">
        {etiqueta}
        <select value={valor} onChange={(e) => onChange(campo.clave, e.target.value)} className={campoClase}>
          <option value="">—</option>
          {campo.opciones?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        {ayuda}
      </label>
    );
  }

  // Las decisiones que el agente tiene que ENTENDER, no solo responder: todas
  // las alternativas visibles a la vez, cada una con su consecuencia práctica
  // al lado. Un desplegable escondería justo lo que hay que leer.
  if (campo.tipo === 'opcionExplicada') {
    return (
      <div className="sm:col-span-2">
        {etiqueta}
        <div className="flex flex-col gap-2">
          {campo.opciones?.map((o) => {
            const activo = valor === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => onChange(campo.clave, o.valor)}
                className={`rounded-xl border p-3.5 text-left transition ${
                  activo ? 'border-brand-line bg-brand-dim' : 'border-line hover:bg-surface-2'
                }`}
              >
                <span className={`block text-sm font-bold ${activo ? 'text-brand' : 'text-text'}`}>{o.etiqueta}</span>
                {o.consecuencia ? (
                  <span className="mt-1 block text-[12px] leading-relaxed text-text-2">{o.consecuencia}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {ayuda}
      </div>
    );
  }

  if (campo.tipo === 'multiple') {
    const marcados = valor.split(',').filter(Boolean);
    return (
      <div className="sm:col-span-2">
        {etiqueta}
        <div className="flex flex-wrap gap-2">
          {campo.opciones?.map((o) => {
            const activo = marcados.includes(o.valor);
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  onChange(
                    campo.clave,
                    (activo ? marcados.filter((m) => m !== o.valor) : [...marcados, o.valor]).join(','),
                  )
                }
                className={`min-h-[44px] rounded-xl border px-3.5 text-sm font-semibold transition ${
                  activo ? 'border-brand-line bg-brand-dim text-brand' : 'border-line text-text-2 hover:bg-surface-2'
                }`}
              >
                {o.etiqueta}
              </button>
            );
          })}
        </div>
        {ayuda}
      </div>
    );
  }

  if (campo.tipo === 'area') {
    return (
      <label className="block sm:col-span-2">
        {etiqueta}
        <textarea
          value={valor}
          onChange={(e) => onChange(campo.clave, e.target.value)}
          rows={3}
          className={`${campoClase} py-3`}
        />
        {ayuda}
      </label>
    );
  }

  const tipoHtml =
    campo.tipo === 'correo' ? 'email' : campo.tipo === 'fecha' ? 'date' : campo.tipo === 'telefono' ? 'tel' : campo.tipo === 'numero' || campo.tipo === 'dinero' || campo.tipo === 'porcentaje' ? 'number' : 'text';

  return (
    <label className="block">
      {etiqueta}
      <input
        type={tipoHtml}
        inputMode={campo.tipo === 'cedula' ? 'numeric' : undefined}
        value={valor}
        onChange={(e) => onChange(campo.clave, e.target.value)}
        className={campoClase}
      />
      {ayuda}
    </label>
  );
}

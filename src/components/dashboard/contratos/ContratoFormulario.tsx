'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CONTRATO_DEFINICION,
  CONTRATO_MENU,
  ENLACE_EXPLICAR_CLIENTE,
  ENLACE_EXPLICAR_CLIENTE_ETIQUETA,
  ENLACE_REVISION_ABOGADO,
  ENLACE_REVISION_ABOGADO_ETIQUETA,
  PARTES_POR_TIPO,
  campoVisible,
  camposFaltantes,
  identidadParte,
  type CampoDefinicion,
  type ContratoTipo,
} from '@/lib/real-estate/contratos/tipos';
import type { CambiosEntreVersiones } from '@/lib/real-estate/contratos/clausulas';
import ContratoClausulas from './ContratoClausulas';
import VistaDocumento from './VistaDocumento';
import type { ContratoCompleto, DocumentoTrabajo, ListingOpcion, PlantillaVigente } from './tipos-cliente';

// El documento en tres niveles, cada uno más fino que el anterior:
//
//   1. DATOS       lo que el sistema ya sabe viene puesto (agente, inmueble,
//                  propietario del inventario); el resto, un formulario corto.
//   2. CLÁUSULAS   cada cláusula editable por separado, opcionales, agregadas.
//   3. REVISAR     qué cambia respecto de la versión anterior, quién la recibe,
//                  y el envío para aprobación. Aquí también el Word.
//
// PRINCIPIO: el agente está en el celular, con alguien esperando. Una columna,
// secciones cortas, botones grandes, y nada que obligue a hacer zoom.

const campoClase =
  'min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand';

type Paso = 'datos' | 'clausulas' | 'revisar';

// Lo que el inventario sabe y el formulario pide. Solo llena lo vacío: nunca
// pisa lo que el agente ya escribió.
function autocompletar(tipo: ContratoTipo, datos: Record<string, string>, listing: ListingOpcion | undefined): Record<string, string> {
  if (!listing) return datos;
  const claves = new Set(CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos.map((c) => c.clave)));
  const precio = listing.price ? String(listing.price) : null;
  const sugeridos: Record<string, string | null | undefined> = {
    // Corretaje: el dueño es el propietario que consigna.
    propietario_nombre: listing.ownerName,
    propietario_telefono: listing.ownerPhone,
    propiedadDireccion: listing.address,
    propiedadCiudad: listing.city,
    precio: listing.operationType !== 'RENT' ? precio : null,
    // Reserva de compraventa: el dueño es la parte vendedora.
    vendedor_nombre: listing.ownerName,
    vendedor_telefono: listing.ownerPhone,
    precioTotal: listing.operationType !== 'RENT' ? precio : null,
    // Arrendamientos: el dueño es el arrendador.
    arrendador_nombre: listing.ownerName,
    arrendador_telefono: listing.ownerPhone,
    inmuebleDireccion: listing.address,
    inmuebleCiudad: listing.city,
    canon: listing.operationType !== 'SALE' ? precio : null,
  };
  const salida = { ...datos };
  for (const [clave, valor] of Object.entries(sugeridos)) {
    if (claves.has(clave) && valor && !(salida[clave] ?? '').trim()) salida[clave] = valor;
  }
  return salida;
}

export default function ContratoFormulario({
  t,
  listings,
  empresaAgente,
  plantilla,
  contratoId,
  pasoInicial = 'datos',
  onCancelar,
  onEnviado,
}: {
  t: (k: string) => string;
  listings: ListingOpcion[];
  empresaAgente: string | null;
  plantilla: { aviso: string; versiones: PlantillaVigente[] };
  contratoId: string | null;
  pasoInicial?: Paso;
  onCancelar: () => void;
  onEnviado: (id: string) => void;
}) {
  const [tipo, setTipo] = useState<ContratoTipo | null>(null);
  const [listingId, setListingId] = useState<string | null>(listings[0]?.id ?? null);
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [id, setId] = useState<string | null>(contratoId);
  const [paso, setPaso] = useState<Paso>(pasoInicial);
  const [versionActual, setVersionActual] = useState(0);
  const [autocompletado, setAutocompletado] = useState(false);
  const [cargando, setCargando] = useState(Boolean(contratoId));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El id vive también en una ref: el guardado diferido corre con la versión
  // de la función de cuando se programó, y tiene que ver el id recién creado.
  const idRef = useRef<string | null>(contratoId);
  // Mientras se crea el borrador, los guardados siguientes esperan a que exista
  // en vez de crear otro.
  const creando = useRef<Promise<string | null> | null>(null);

  // Carga de un contrato existente.
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
        setVersionActual(c.versionActual);
      } finally {
        setCargando(false);
      }
    })();
  }, [contratoId, t]);

  // Valores por defecto al elegir el tipo, más lo que ya sabe el inventario.
  function elegirTipo(nuevo: ContratoTipo) {
    setTipo(nuevo);
    const iniciales: Record<string, string> = {};
    for (const seccion of CONTRATO_DEFINICION[nuevo].secciones) {
      for (const campo of seccion.campos) {
        if (campo.porDefecto !== undefined) iniciales[campo.clave] = campo.porDefecto;
      }
    }
    const listing = listings.find((l) => l.id === listingId);
    const completos = autocompletar(nuevo, iniciales, listing);
    setAutocompletado(Object.keys(completos).length > Object.keys(iniciales).length);
    setDatos(completos);
  }

  const guardar = useCallback(
    async (siguientes: Record<string, string>, tipoActual: ContratoTipo, listing: string | null): Promise<string | null> => {
      setGuardando(true);
      try {
        if (!idRef.current && creando.current) await creando.current;
        if (!idRef.current) {
          creando.current = (async () => {
            const r = await fetch('/api/real-estate/contratos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tipo: tipoActual, listingId: listing, datos: siguientes }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
              setError(d.error ?? t('contratos.error.guardar'));
              return null;
            }
            idRef.current = d.contrato.id as string;
            setId(idRef.current);
            return idRef.current;
          })();
          try {
            return await creando.current;
          } finally {
            creando.current = null;
          }
        }
        const idActual = idRef.current;
        const r = await fetch(`/api/real-estate/contratos/${idActual}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datos: siguientes, listingId: listing }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setError(d.error ?? t('contratos.error.guardar'));
          return null;
        }
        return idActual;
      } finally {
        setGuardando(false);
      }
    },
    [t],
  );

  function editar(clave: string, valor: string) {
    let siguientes = { ...datos, [clave]: valor };
    // Si comparece por su empresa, la razón social del perfil entra sola.
    if (clave === 'corredor_tipoPersona' && valor === 'JURIDICA' && empresaAgente && !(siguientes.corredor_razonSocial ?? '').trim()) {
      siguientes = { ...siguientes, corredor_razonSocial: empresaAgente };
    }
    setDatos(siguientes);
    if (!tipo) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void guardar(siguientes, tipo, listingId);
    }, 900);
  }

  // Antes de cambiar de paso se guarda lo que esté pendiente: las cláusulas y
  // la revisión se arman en el servidor con los datos guardados.
  async function guardarAhora(): Promise<string | null> {
    if (!tipo) return null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    return guardar(datos, tipo, listingId);
  }

  async function irA(siguiente: Paso) {
    setError('');
    if (siguiente !== 'datos') {
      const guardado = await guardarAhora();
      if (!guardado) return;
    }
    setPaso(siguiente);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const pendientes = useMemo(() => (tipo ? camposFaltantes(tipo, datos) : []), [tipo, datos]);

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
                <p className="mt-1 text-[13px] leading-relaxed text-text-2">{definicion.descripcion}</p>
              </button>
            );
          })}
        </div>
        <p className="text-[12px] leading-relaxed text-text-3">{plantilla.aviso}</p>
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
  const pasos: Paso[] = ['datos', 'clausulas', 'revisar'];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-text">{definicion.titulo}</h3>
          <p className="text-xs text-text-2">
            {versionActual > 0 ? `${t('contratos.version').replace('{n}', String(versionActual))} · ` : ''}
            {guardando ? t('contratos.guardando') : t('contratos.guardadoSolo')}
          </p>
        </div>
        <button
          onClick={async () => {
            await guardarAhora();
            onCancelar();
          }}
          className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {t('contratos.volver')}
        </button>
      </div>

      {/* Los tres niveles, siempre a la vista. */}
      <nav className="grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-surface p-1.5" aria-label="Pasos">
        {pasos.map((p, i) => (
          <button
            key={p}
            onClick={() => void irA(p)}
            aria-current={paso === p ? 'step' : undefined}
            className={`min-h-[44px] rounded-xl px-2 text-[12.5px] font-bold leading-tight transition sm:text-sm ${
              paso === p ? 'bg-brand-dim text-brand' : 'text-text-2 hover:bg-surface-2'
            }`}
          >
            <span className="mr-1 opacity-70">{i + 1}.</span>
            {t(`contratos.paso.${p}`)}
          </button>
        ))}
      </nav>

      {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      {paso === 'datos' ? (
        <>
          {autocompletado ? (
            <p className="rounded-2xl border border-accent-line bg-accent-dim px-4 py-3 text-[13px] leading-relaxed text-accent">
              {t('contratos.autocompletado')}
            </p>
          ) : null}

          {definicion.ayuda ? (
            <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">{definicion.ayuda}</p>
          ) : null}

          {definicion.requiereInmueble ? (
            <section className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('contratos.inmueble')}</p>
              {listings.length === 0 ? (
                <p className="mt-2 text-sm text-text-2">{t('contratos.sinInmuebles')}</p>
              ) : (
                <select
                  value={listingId ?? ''}
                  onChange={(e) => {
                    const nuevo = e.target.value || null;
                    setListingId(nuevo);
                    const completos = autocompletar(tipo, datos, listings.find((l) => l.id === nuevo));
                    setDatos(completos);
                    void guardar(completos, tipo, nuevo);
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

          {definicion.secciones.map((seccion) => {
            const visibles = seccion.campos.filter((c) => campoVisible(tipo, c, datos));
            if (visibles.length === 0) return null;
            return (
              <section key={seccion.clave} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{seccion.titulo}</p>
                {seccion.descripcion ? <p className="mt-1 text-xs leading-relaxed text-text-3">{seccion.descripcion}</p> : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {visibles.map((campo) => (
                    <Campo key={campo.clave} campo={campo} valor={datos[campo.clave] ?? ''} onChange={editar} />
                  ))}
                </div>
              </section>
            );
          })}

          {pendientes.length > 0 ? (
            <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">
              {t('contratos.faltanCampos')} {pendientes.join(', ')}.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              onClick={() => void irA('clausulas')}
              className="gradient-btn min-h-[48px] rounded-xl px-6 text-sm font-bold text-grad-contrast sm:min-w-[200px]"
            >
              {t('contratos.siguiente')}: {t('contratos.paso.clausulas')}
            </button>
          </div>
        </>
      ) : null}

      {paso === 'clausulas' && id ? (
        <>
          <ContratoClausulas t={t} contratoId={id} />
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              onClick={() => void irA('revisar')}
              className="gradient-btn min-h-[48px] rounded-xl px-6 text-sm font-bold text-grad-contrast sm:min-w-[200px]"
            >
              {t('contratos.siguiente')}: {t('contratos.paso.revisar')}
            </button>
          </div>
        </>
      ) : null}

      {paso === 'revisar' && id ? (
        <Revisar t={t} tipo={tipo} contratoId={id} datos={datos} onIrADatos={() => void irA('datos')} onEnviado={onEnviado} />
      ) : null}

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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nivel 3: revisar y enviar
// ---------------------------------------------------------------------------

function ListaCambios({ t, cambios }: { t: (k: string) => string; cambios: CambiosEntreVersiones }) {
  return (
    <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-text-2">
      {cambios.modificadas.map((c) => (
        <li key={`m-${c}`}>
          <span className="font-semibold text-text">{t('contratos.revisar.modificada')}</span> {c}
        </li>
      ))}
      {cambios.agregadas.map((c) => (
        <li key={`a-${c}`}>
          <span className="font-semibold text-text">{t('contratos.revisar.agregada')}</span> {c}
        </li>
      ))}
      {cambios.retiradas.map((c) => (
        <li key={`r-${c}`}>
          <span className="font-semibold text-text">{t('contratos.revisar.retirada')}</span> {c}
        </li>
      ))}
      {cambios.otros ? <li>{t('contratos.revisar.otros')}</li> : null}
    </ul>
  );
}

export function hayCambios(c: CambiosEntreVersiones | null): boolean {
  return Boolean(c && (c.modificadas.length > 0 || c.agregadas.length > 0 || c.retiradas.length > 0 || c.otros));
}

function Revisar({
  t,
  tipo,
  contratoId,
  datos,
  onIrADatos,
  onEnviado,
}: {
  t: (k: string) => string;
  tipo: ContratoTipo;
  contratoId: string;
  datos: Record<string, string>;
  onIrADatos: () => void;
  onEnviado: (id: string) => void;
}) {
  const [doc, setDoc] = useState<DocumentoTrabajo | null>(null);
  const [error, setError] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [avisoWord, setAvisoWord] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}/documento`, { cache: 'no-store' });
      if (!r.ok) {
        setError(t('contratos.error.documento'));
        return;
      }
      setDoc((await r.json()) as DocumentoTrabajo);
    })();
  }, [contratoId, t]);

  // Quiénes reciben la versión: las partes que no son el agente, con quien
  // aprueba por cada una.
  const destinatarios = PARTES_POR_TIPO[tipo]
    .filter((p) => !p.esAgente)
    .map((p) => ({ definicion: p, identidad: identidadParte(tipo, datos, p.rol) }));

  async function enviar() {
    setEnviando(true);
    setError('');
    try {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}/enviar`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.faltantes?.length ? `${d.error} ${d.faltantes.join(', ')}` : (d.error ?? t('contratos.error.enviar')));
        setConfirmar(false);
        return;
      }
      onEnviado(contratoId);
    } catch {
      setError(t('contratos.error.enviar'));
    } finally {
      setEnviando(false);
    }
  }

  if (!doc) {
    return error ? (
      <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
    ) : (
      <p className="text-sm text-text-2">{t('contratos.cargando')}</p>
    );
  }

  const siguiente = doc.versionActual + 1;
  const cambios = doc.cambiosSinEnviar;
  const sinCambiosDesdeUltima = doc.versionActual > 0 && !hayCambios(cambios);
  const puedeEnviar = doc.editable && doc.faltantes.length === 0 && !sinCambiosDesdeUltima && !enviando;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-surface p-4">
        {doc.versionActual === 0 ? (
          <p className="text-[13.5px] leading-relaxed text-text-2">{t('contratos.revisar.sinEnviar')}</p>
        ) : hayCambios(cambios) && cambios ? (
          <>
            <p className="text-[13.5px] font-semibold text-text">{t('contratos.revisar.cambios').replace('{n}', String(siguiente))}</p>
            <ListaCambios t={t} cambios={cambios} />
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-text-2">{t('contratos.revisar.sinCambios').replace('{n}', String(doc.versionActual))}</p>
        )}
      </section>

      {doc.faltantes.length > 0 ? (
        <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
          <p className="text-[13px] leading-relaxed text-text-2">
            {t('contratos.faltanCampos')} {doc.faltantes.join(', ')}.
          </p>
          <button onClick={onIrADatos} className="mt-2 min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text">
            {t('contratos.completarDatos')}
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">
          {t('contratos.revisar.quienes').replace('{n}', String(siguiente))}
        </p>
        <ul className="mt-2 space-y-2">
          {destinatarios.map(({ definicion, identidad }) => (
            <li key={definicion.rol} className="rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-sm font-semibold text-text">
                {identidad.aprobador.nombre || '—'}{' '}
                <span className="font-normal text-text-3">· {definicion.etiqueta.toLowerCase()}</span>
              </p>
              {identidad.juridica ? (
                <p className="text-xs text-text-2">{t('contratos.revisar.porCompania').replace('{compania}', identidad.nombre || '—')}</p>
              ) : null}
              <p className="text-xs text-text-2">{identidad.correo || '—'}</p>
              <p className="text-[11px] text-text-3">
                {t('contratos.confirmar.cedula')} ••••{identidad.aprobador.cedula.replace(/\D/g, '').slice(-4)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <button
          onClick={() => setLeyendo((v) => !v)}
          aria-expanded={leyendo}
          className="min-h-[44px] w-full rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {leyendo ? t('contratos.revisar.ocultar') : t('contratos.revisar.leer')}
        </button>
        {leyendo ? (
          <div className="mt-4">
            <VistaDocumento bloques={doc.bloques} ciudad={doc.ciudad} fechaLarga={doc.fechaLarga} />
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <button
          onClick={() => setConfirmar(true)}
          disabled={!puedeEnviar}
          className="gradient-btn min-h-[52px] rounded-xl px-6 text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
        >
          {doc.versionActual === 0 ? t('contratos.enviarAprobacion') : t('contratos.enviarVersion').replace('{n}', String(siguiente))}
        </button>
        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href={`/api/real-estate/contratos/${contratoId}/archivo?trabajo=1&previa=1`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[44px] items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
          >
            {t('contratos.vistaPrevia')}
          </a>
          <button
            onClick={() => setAvisoWord(true)}
            className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
          >
            {t('contratos.word')}
          </button>
        </div>
      </div>

      {avisoWord ? (
        <Dialogo onCerrar={() => setAvisoWord(false)}>
          <h4 className="text-base font-bold text-text">{t('contratos.word')}</h4>
          <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[14px] leading-relaxed text-text">
            {doc.avisoWord}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <a
              href={`/api/real-estate/contratos/${contratoId}/word`}
              onClick={() => setAvisoWord(false)}
              className="gradient-btn flex min-h-[44px] items-center justify-center rounded-xl px-6 text-sm font-bold text-grad-contrast sm:min-w-[180px]"
            >
              {t('contratos.word.descargar')}
            </a>
            <button
              onClick={() => setAvisoWord(false)}
              className="min-h-[44px] rounded-xl border border-line px-6 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
            >
              {t('common.cancelar')}
            </button>
          </div>
        </Dialogo>
      ) : null}

      {confirmar ? (
        <Dialogo onCerrar={() => setConfirmar(false)}>
          <h4 className="text-base font-bold text-text">{t('contratos.confirmar.titulo')}</h4>
          <p className="mt-1 text-[13px] leading-relaxed text-text-2">
            {t('contratos.confirmar.detalle').replace('{n}', String(siguiente))}
          </p>
          <ul className="mt-4 space-y-2">
            {destinatarios.map(({ definicion, identidad }) => (
              <li key={definicion.rol} className="rounded-xl border border-line bg-surface p-3">
                <p className="text-sm font-semibold text-text">{identidad.aprobador.nombre || '—'}</p>
                <p className="text-xs text-text-2">{identidad.correo || '—'}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              onClick={() => void enviar()}
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
        </Dialogo>
      ) : null}
    </div>
  );
}

function Dialogo({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onCerrar}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bg-alt p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nivel 1: un campo del formulario
// ---------------------------------------------------------------------------

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

  const ayuda = campo.ayuda ? <span className="mt-1 block text-[11.5px] leading-relaxed text-text-3">{campo.ayuda}</span> : null;

  // Pocas opciones: botones a la vista en vez de un desplegable. En el celular
  // es un toque en vez de tres.
  if (campo.tipo === 'opcion' && (campo.opciones?.length ?? 0) <= 3) {
    const actual = valor || campo.porDefecto || '';
    return (
      <div className={campo.clave.endsWith('_tipoPersona') ? 'sm:col-span-2' : ''}>
        {etiqueta}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${campo.opciones?.length ?? 1}, minmax(0, 1fr))` }}>
          {campo.opciones?.map((o) => {
            const activo = actual === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => onChange(campo.clave, o.valor)}
                className={`min-h-[44px] rounded-xl border px-2 text-[13px] font-semibold leading-tight transition ${
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
                {o.consecuencia ? <span className="mt-1 block text-[12.5px] leading-relaxed text-text-2">{o.consecuencia}</span> : null}
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
                  onChange(campo.clave, (activo ? marcados.filter((m) => m !== o.valor) : [...marcados, o.valor]).join(','))
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
        <textarea value={valor} onChange={(e) => onChange(campo.clave, e.target.value)} rows={3} className={`${campoClase} py-3`} />
        {ayuda}
      </label>
    );
  }

  const tipoHtml =
    campo.tipo === 'correo'
      ? 'email'
      : campo.tipo === 'fecha'
        ? 'date'
        : campo.tipo === 'telefono'
          ? 'tel'
          : campo.tipo === 'numero' || campo.tipo === 'dinero' || campo.tipo === 'porcentaje'
            ? 'number'
            : 'text';

  return (
    <label className="block">
      {etiqueta}
      <input
        type={tipoHtml}
        inputMode={campo.tipo === 'cedula' ? 'numeric' : campo.tipo === 'dinero' || campo.tipo === 'porcentaje' ? 'decimal' : undefined}
        value={valor}
        onChange={(e) => onChange(campo.clave, e.target.value)}
        className={campoClase}
      />
      {ayuda}
    </label>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CONTRATO_DEFINICION,
  CONTRATO_MENU,
  ENLACE_EXPLICAR_CLIENTE,
  ENLACE_EXPLICAR_CLIENTE_ETIQUETA,
  ENLACE_REVISION_ABOGADO,
  ENLACE_REVISION_ABOGADO_ETIQUETA,
  campoVisible,
  camposFaltantes,
  centroPorDefecto,
  ciudadDeJurisdiccion,
  ladosDelTipo,
  type CampoDefinicion,
  type ContratoTipo,
  type Etapa,
} from '@/lib/real-estate/contratos/tipos';
import type { CambiosEntreVersiones } from '@/lib/real-estate/contratos/clausulas';
import { propertyTypeLabelEs } from '@/lib/real-estate/labels';
import ContratoClausulas from './ContratoClausulas';
import { Dialogo, reemplazar as rellenar, textoVigencia } from './ContratoSeguimiento';
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

// Lo que el inventario sabe del inmueble, redactado para que el agente lo
// complete: es un punto de partida, no la descripción final.
export function descripcionDesdeInmueble(l: ListingOpcion, tipoLegible: string): string {
  const ubicacion = [l.address, l.zone, l.city].filter(Boolean).join(', ');
  const rasgos = [
    l.areaM2 ? `${l.areaM2} m² de área` : null,
    l.bedrooms ? `${l.bedrooms} ${l.bedrooms === 1 ? 'dormitorio' : 'dormitorios'}` : null,
    l.bathrooms ? `${l.bathrooms} ${l.bathrooms === 1 ? 'baño' : 'baños'}` : null,
    l.parkingSpaces ? `${l.parkingSpaces} ${l.parkingSpaces === 1 ? 'parqueadero' : 'parqueaderos'}` : null,
  ].filter(Boolean);
  // Un punto de partida, no el texto final: el título del anuncio es de venta y
  // no entra. El agente completa lo que falte (pisos, bodega, estado).
  const inicio = tipoLegible.trim();
  return [
    `${inicio.charAt(0).toUpperCase()}${inicio.slice(1)}${ubicacion ? ` en ${ubicacion}` : ''}.`,
    rasgos.length > 0 ? `Cuenta con ${rasgos.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
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
  // A quién representa el agente: su cliente revisa primero.
  const [representa, setRepresenta] = useState<string | null>(null);
  const representaRef = useRef<string | null>(null);
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
        setRepresenta(c.representa);
        representaRef.current = c.representa;
        setVersionActual(c.versionActual);
      } finally {
        setCargando(false);
      }
    })();
  }, [contratoId, t]);

  // Valores por defecto al elegir el tipo, más lo que ya sabe el inventario.
  function elegirTipo(nuevo: ContratoTipo) {
    setTipo(nuevo);
    const porDefecto = ladosDelTipo(nuevo)?.porDefecto ?? null;
    setRepresenta(porDefecto);
    representaRef.current = porDefecto;
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
              body: JSON.stringify({ tipo: tipoActual, listingId: listing, datos: siguientes, ...(representaRef.current ? { representa: representaRef.current } : {}) }),
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
          body: JSON.stringify({ datos: siguientes, listingId: listing, ...(representaRef.current ? { representa: representaRef.current } : {}) }),
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
    // El centro de mediación sigue a la ciudad elegida hasta que el agente
    // escriba uno propio: ahí deja de tocarse.
    if (clave === 'jurisdiccionCiudad' || clave === 'jurisdiccionCiudadOtra' || clave === 'propiedadCiudad') {
      const escrito = (datos.centroMediacion ?? '').trim();
      if (!escrito || escrito === centroPorDefecto(ciudadDeJurisdiccion(datos))) {
        siguientes = { ...siguientes, centroMediacion: centroPorDefecto(ciudadDeJurisdiccion(siguientes)) };
      }
    }
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

          {(ladosDelTipo(tipo)?.lados.length ?? 0) > 1 ? (
            <section className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('contratos.representa.titulo')}</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {ladosDelTipo(tipo)?.lados.map((l) => {
                  const activo = (representa ?? ladosDelTipo(tipo)?.porDefecto) === l.clave;
                  return (
                    <button
                      key={l.clave}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => {
                        setRepresenta(l.clave);
                        representaRef.current = l.clave;
                        void guardar(datos, tipo, listingId);
                      }}
                      className={`min-h-[44px] rounded-xl border px-2 text-[13px] font-semibold transition ${
                        activo ? 'border-brand-line bg-brand-dim text-brand' : 'border-line text-text-2 hover:bg-surface-2'
                      }`}
                    >
                      {l.etiqueta}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-text-3">{t('contratos.representa.ayuda')}</p>
            </section>
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
                    <Campo
                      key={campo.clave}
                      campo={campo}
                      valor={datos[campo.clave] ?? ''}
                      onChange={editar}
                      listings={campo.desdeInmueble ? listings : []}
                    />
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
        <Revisar t={t} contratoId={id} onIrADatos={() => void irA('datos')} onEnviado={onEnviado} />
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
  contratoId,
  onIrADatos,
  onEnviado,
}: {
  t: (k: string) => string;
  contratoId: string;
  onIrADatos: () => void;
  onEnviado: (id: string) => void;
}) {
  const [doc, setDoc] = useState<DocumentoTrabajo | null>(null);
  const [error, setError] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [confirmar, setConfirmar] = useState<{ destino: Etapa; correccionMenor: boolean } | null>(null);
  const [avisoWord, setAvisoWord] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vigencia, setVigencia] = useState<number | null>(null);
  const [porCorreo, setPorCorreo] = useState(true);
  const [simultaneo, setSimultaneo] = useState(false);

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

  async function enviar() {
    if (!doc || !confirmar) return;
    setEnviando(true);
    setError('');
    try {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destino: confirmar.destino,
          correccionMenor: confirmar.correccionMenor,
          simultaneo: confirmar.destino === 'PRINCIPAL' && simultaneo,
          porCorreo,
          vigenciaHoras: vigencia ?? doc.envio.vigenciaHoras,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.faltantes?.length ? `${d.error} ${d.faltantes.join(', ')}` : (d.error ?? t('contratos.error.enviar')));
        setConfirmar(null);
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

  const { envio } = doc;
  const siguiente = doc.versionActual + 1;
  const cambios = doc.cambiosSinEnviar;
  const principal = envio.etiquetas.PRINCIPAL;
  const contraparte = envio.etiquetas.CONTRAPARTE;
  const valores = {
    principal: principal?.toLowerCase() ?? t('contratos.tuCliente'),
    contraparte: contraparte?.toLowerCase() ?? t('contratos.laContraparte'),
    n: envio.vigente?.numero ?? doc.versionActual,
  };
  const reemplazar = (texto: string, extra: Record<string, string | number> = {}) => rellenar(texto, { ...valores, ...extra });

  const completo = doc.editable && doc.faltantes.length === 0;
  const primera = envio.primera;
  const enRevisionSinCambios = !envio.hayCambios && envio.vigente?.estado === 'EN_APROBACION' && !envio.puedeEnviarContraparte;
  const destinatariosDe = (etapa: Etapa) => envio.destinatarios[etapa];
  const hayCorreo = (etapa: Etapa) => destinatariosDe(etapa).some((d) => d.correo);

  return (
    <div className="space-y-4">
      {doc.avisoSinRevisar ? (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-text">{doc.avisoSinRevisar}</p>
      ) : null}

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

      {/* El orden de revisión, con nombres. */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('contratos.revisar.flujo.titulo')}</p>
        {(['PRINCIPAL', 'CONTRAPARTE'] as Etapa[])
          .filter((e) => envio.etiquetas[e])
          .map((e, i, lista) => (
            <div key={e} className="mt-3">
              <p className="text-[13px] font-semibold text-text">
                {i + 1}. {envio.etiquetas[e]}
                <span className="font-normal text-text-3">
                  {' '}
                  · {i === 0 ? t('contratos.revisar.flujo.primero') : t('contratos.revisar.flujo.despues')}
                </span>
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {destinatariosDe(e).map((d) => (
                  <li key={d.rol} className="rounded-xl border border-line bg-surface-2 px-3 py-2">
                    <p className="text-sm font-semibold text-text">
                      {d.nombre || '—'} <span className="font-normal text-text-3">· {d.rolEtiqueta.toLowerCase()}</span>
                    </p>
                    {d.compania ? <p className="text-xs text-text-2">{t('contratos.revisar.porCompania').replace('{compania}', d.compania)}</p> : null}
                    <p className="text-xs text-text-2">
                      {[d.telefono, d.correo].filter(Boolean).join(' · ') || '—'}
                      {d.cedulaUlt4 ? ` · ${t('contratos.confirmar.cedula')} ••••${d.cedulaUlt4}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
              {i < lista.length - 1 ? <p className="mt-2 text-center text-text-3" aria-hidden="true">↓</p> : null}
            </div>
          ))}
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

      {/* Qué envío corresponde ahora. */}
      <div className="flex flex-col gap-2">
        {envio.puedeEnviarContraparte ? (
          <>
            <p className="rounded-2xl border border-accent-line bg-accent-dim px-4 py-3 text-[13px] leading-relaxed text-accent">
              {reemplazar(t('contratos.revisar.contraparteLista'))}
            </p>
            <button
              onClick={() => setConfirmar({ destino: 'CONTRAPARTE', correccionMenor: false })}
              disabled={!completo}
              className="gradient-btn min-h-[52px] rounded-xl px-6 text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reemplazar(t('contratos.enviarA'), { etapa: valores.contraparte })}
            </button>
          </>
        ) : envio.correccionMenorPosible ? (
          <>
            <div className="rounded-2xl border border-brand-line bg-brand-dim px-4 py-3">
              <p className="text-[13.5px] font-semibold text-brand">{reemplazar(t('contratos.revisar.correccion.titulo'))}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-2">{reemplazar(t('contratos.revisar.correccion.detalle'))}</p>
            </div>
            <button
              onClick={() => setConfirmar({ destino: 'CONTRAPARTE', correccionMenor: true })}
              disabled={!completo}
              className="gradient-btn min-h-[52px] rounded-xl px-6 text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reemplazar(t('contratos.revisar.correccion.boton'))}
            </button>
            <button
              onClick={() => setConfirmar({ destino: 'PRINCIPAL', correccionMenor: false })}
              disabled={!completo}
              className="min-h-[48px] rounded-xl border border-line-strong px-6 text-sm font-semibold text-text transition hover:bg-surface-2 disabled:opacity-50"
            >
              {reemplazar(t('contratos.revisar.correccion.alternativa'))}
            </button>
          </>
        ) : enRevisionSinCambios ? (
          <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">{reemplazar(t('contratos.revisar.enRevision'))}</p>
        ) : primera ? (
          <>
            {doc.versionActual > 0 && primera === 'PRINCIPAL' && contraparte ? (
              <p className="text-[12.5px] leading-relaxed text-text-3">{reemplazar(t('contratos.revisar.vuelvePrincipal'))}</p>
            ) : null}
            <button
              onClick={() => setConfirmar({ destino: primera, correccionMenor: false })}
              disabled={!completo || (!envio.hayCambios && envio.vigente?.estado === 'APROBADA')}
              className="gradient-btn min-h-[52px] rounded-xl px-6 text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reemplazar(t('contratos.enviarA'), { etapa: (envio.etiquetas[primera] ?? '').toLowerCase() })}
            </button>
          </>
        ) : null}

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
          <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[14px] leading-relaxed text-text">{doc.avisoWord}</p>
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
        <Dialogo onCerrar={() => setConfirmar(null)}>
          <h4 className="text-base font-bold text-text">
            {reemplazar(t('contratos.enviarA'), { etapa: (envio.etiquetas[confirmar.destino] ?? '').toLowerCase() })}
          </h4>
          <p className="mt-1 text-[13px] leading-relaxed text-text-2">
            {t('contratos.confirmar.detalle').replace('{n}', String(confirmar.destino === 'CONTRAPARTE' && !confirmar.correccionMenor ? valores.n : siguiente))}
          </p>
          <ul className="mt-3 space-y-2">
            {[...destinatariosDe(confirmar.destino), ...(confirmar.destino === 'PRINCIPAL' && simultaneo ? destinatariosDe('CONTRAPARTE') : [])].map((d) => (
              <li key={d.rol} className="rounded-xl border border-line bg-surface p-3">
                <p className="text-sm font-semibold text-text">
                  {d.nombre || '—'} <span className="font-normal text-text-3">· {d.rolEtiqueta.toLowerCase()}</span>
                </p>
                <p className="text-xs text-text-2">{[d.telefono, d.correo].filter(Boolean).join(' · ') || '—'}</p>
              </li>
            ))}
          </ul>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('contratos.vigencia')}</span>
            <select
              value={vigencia ?? envio.vigenciaHoras}
              onChange={(e) => setVigencia(Number(e.target.value))}
              className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-text"
            >
              {envio.vigencias.map((h) => (
                <option key={h} value={h}>
                  {textoVigencia(t, h)}
                </option>
              ))}
            </select>
          </label>
          {hayCorreo(confirmar.destino) ? (
            <label className="mt-3 flex cursor-pointer items-start gap-3 py-1">
              <input type="checkbox" checked={porCorreo} onChange={(e) => setPorCorreo(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="text-[13.5px] leading-relaxed text-text-2">{t('contratos.porCorreo')}</span>
            </label>
          ) : null}

          {/* Opción avanzada, apagada por defecto. */}
          {confirmar.destino === 'PRINCIPAL' && contraparte && !confirmar.correccionMenor ? (
            <details className="mt-3 rounded-xl border border-line px-3 py-2">
              <summary className="min-h-[36px] cursor-pointer py-2 text-[13px] font-semibold text-text-2">{t('contratos.revisar.avanzado')}</summary>
              <label className="mt-1 flex cursor-pointer items-start gap-3 py-1">
                <input type="checkbox" checked={simultaneo} onChange={(e) => setSimultaneo(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-[13.5px] leading-relaxed text-text">{reemplazar(t('contratos.revisar.simultaneo'))}</span>
              </label>
              <p className={`mt-1 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${simultaneo ? 'border border-danger bg-danger-dim text-danger' : 'text-text-3'}`}>
                {t('contratos.revisar.simultaneo.aviso')}
              </p>
            </details>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              onClick={() => void enviar()}
              disabled={enviando}
              className="gradient-btn min-h-[48px] rounded-xl px-6 text-sm font-bold text-grad-contrast disabled:opacity-50 sm:min-w-[160px]"
            >
              {enviando ? t('contratos.enviando') : t('contratos.confirmar.enviar')}
            </button>
            <button
              onClick={() => setConfirmar(null)}
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

// Prellena una descripción con los datos de un inmueble del inventario. Queda
// editable: el agente la completa con lo que solo él sabe.
function TraerDelInmueble({ listings, onElegir }: { listings: ListingOpcion[]; onElegir: (texto: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
      >
        Traer datos del inmueble
      </button>
      {abierto ? (
        <ul className="mt-2 space-y-1.5">
          {listings.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  onElegir(descripcionDesdeInmueble(l, propertyTypeLabelEs(l.propertyType)));
                  setAbierto(false);
                }}
                className="min-h-[44px] w-full rounded-xl border border-line px-3 py-2 text-left text-[13px] text-text-2 transition hover:bg-surface-2"
              >
                <span className="font-semibold text-text">{l.title}</span> · {[l.zone, l.city].filter(Boolean).join(', ')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
  listings = [],
}: {
  campo: CampoDefinicion;
  valor: string;
  onChange: (clave: string, valor: string) => void;
  listings?: ListingOpcion[];
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
    const largo = valor.trim().length;
    const corto = Boolean(campo.minimo && largo > 0 && largo < campo.minimo);
    return (
      <div className="sm:col-span-2">
        <label className="block">
          {etiqueta}
          <textarea
            value={valor}
            onChange={(e) => onChange(campo.clave, e.target.value)}
            rows={campo.minimo ? 7 : 3}
            className={`${campoClase} py-3`}
          />
        </label>
        {campo.minimo ? (
          <p className={`mt-1 text-[11.5px] ${corto ? 'text-danger' : 'text-text-3'}`}>
            {largo} caracteres{largo < campo.minimo ? ` · mínimo ${campo.minimo}` : ''}
          </p>
        ) : null}
        {listings.length > 0 ? <TraerDelInmueble listings={listings} onElegir={(texto) => onChange(campo.clave, texto)} /> : null}
        {ayuda}
      </div>
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

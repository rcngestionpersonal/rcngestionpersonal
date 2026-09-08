'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';

// Inventario publico del mini-sitio (punto 2.2). Cliente porque los filtros y
// el detalle se resuelven sin recargar; los datos llegan ya cargados desde el
// server component, asi que el HTML inicial (el que ve el buscador y la vista
// previa de WhatsApp) sale completo del servidor.

export type FotoMiniSitio = { url: string; miniaturaUrl: string | null };

export type InmuebleMiniSitio = {
  id: string;
  titulo: string;
  tipo: string;
  tipoLabel: string;
  operacionLabel: string;
  precio: number;
  moneda: string;
  sector: string | null;
  areaM2: number | null;
  dormitorios: number | null;
  banos: number | null;
  parqueaderos: number | null;
  fotos: FotoMiniSitio[];
};

const RANGOS = [
  { clave: 'todos', label: 'Todos los precios', min: 0, max: Infinity },
  { clave: 'hasta100', label: 'Hasta $100.000', min: 0, max: 100_000 },
  { clave: '100a200', label: '$100.000 - $200.000', min: 100_000, max: 200_000 },
  { clave: '200a350', label: '$200.000 - $350.000', min: 200_000, max: 350_000 },
  { clave: 'desde350', label: 'Desde $350.000', min: 350_000, max: Infinity },
] as const;

function precioFormateado(valor: number, moneda: string): string {
  return `${moneda === 'USD' ? '$' : `${moneda} `}${valor.toLocaleString('es-EC', { maximumFractionDigits: 0 })}`;
}

// m2 / dormitorios / baños como chips y no como texto corrido (punto 1.4):
// son datos que se comparan de un vistazo entre tarjetas, y en linea corrida
// hay que leerlos enteros para encontrar el que interesa.
function DatosClave({ inmueble, conParqueaderos }: { inmueble: InmuebleMiniSitio; conParqueaderos?: boolean }) {
  const datos = [
    inmueble.areaM2 ? `${inmueble.areaM2} m²` : null,
    inmueble.dormitorios ? `${inmueble.dormitorios} dorm.` : null,
    inmueble.banos ? `${inmueble.banos} baños` : null,
    conParqueaderos && inmueble.parqueaderos ? `${inmueble.parqueaderos} parq.` : null,
  ].filter(Boolean) as string[];

  if (datos.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {datos.map((dato) => (
        <li
          key={dato}
          className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: 'var(--ms-suave)', borderColor: 'var(--ms-borde)', color: 'var(--ms-acento)' }}
        >
          {dato}
        </li>
      ))}
    </ul>
  );
}

export default function InventarioMiniSitio({
  inmuebles,
  slug,
  telefono,
  nombreAgente,
}: {
  inmuebles: InmuebleMiniSitio[];
  slug: string;
  telefono: string;
  nombreAgente: string;
}) {
  const [tipo, setTipo] = useState('todos');
  const [rango, setRango] = useState<(typeof RANGOS)[number]['clave']>('todos');
  const [abierto, setAbierto] = useState<InmuebleMiniSitio | null>(null);
  const [foto, setFoto] = useState(0);

  const tipos = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const i of inmuebles) vistos.set(i.tipo, i.tipoLabel);
    return [...vistos.entries()];
  }, [inmuebles]);

  const filtrados = useMemo(() => {
    const r = RANGOS.find((x) => x.clave === rango) ?? RANGOS[0];
    return inmuebles.filter((i) => (tipo === 'todos' || i.tipo === tipo) && i.precio >= r.min && i.precio <= r.max);
  }, [inmuebles, tipo, rango]);

  function abrirDetalle(inmueble: InmuebleMiniSitio) {
    setAbierto(inmueble);
    setFoto(0);
    // Visita al detalle: alimenta "inmueble mas visto" (punto 6.1). Si falla,
    // no se le dice nada al visitante: es una metrica, no su problema.
    void fetch(`/api/real-estate/mini-sitio/${slug}/visita`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: inmueble.id }),
    }).catch(() => {});
  }

  const whatsappDe = (inmueble: InmuebleMiniSitio) =>
    `https://wa.me/${telefono}?text=${encodeURIComponent(
      `Hola ${nombreAgente.split(/\s+/)[0]} 👋 Vi "${inmueble.titulo}" en tu sitio de Redinmo.io y quiero más información.`,
    )}`;

  return (
    <section className="px-4 py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-extrabold tracking-[-0.01em] sm:text-3xl">Inmuebles disponibles</h2>
        <p className="mt-2 text-center text-sm text-text-2">
          {inmuebles.length === 1 ? '1 inmueble activo' : `${inmuebles.length} inmuebles activos`}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            aria-label="Filtrar por tipo de inmueble"
            className="min-h-[44px] rounded-xl border bg-surface px-3 text-sm font-semibold text-text"
            style={{ borderColor: 'var(--ms-borde)' }}
          >
            <option value="todos">Todos los tipos</option>
            {tipos.map(([clave, label]) => (
              <option key={clave} value={clave}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={rango}
            onChange={(e) => setRango(e.target.value as typeof rango)}
            aria-label="Filtrar por rango de precio"
            className="min-h-[44px] rounded-xl border bg-surface px-3 text-sm font-semibold text-text"
            style={{ borderColor: 'var(--ms-borde)' }}
          >
            {RANGOS.map((r) => (
              <option key={r.clave} value={r.clave}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {filtrados.length === 0 ? (
          <p className="mt-8 text-center text-sm text-text-2">No hay inmuebles que coincidan con ese filtro.</p>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((inmueble) => (
              <button
                key={inmueble.id}
                onClick={() => abrirDetalle(inmueble)}
                className="ms-tarjeta group overflow-hidden rounded-2xl border border-line bg-surface text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ outlineColor: 'var(--ms-acento)' }}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                  {inmueble.fotos[0] ? (
                    <Image
                      src={inmueble.fotos[0].miniaturaUrl ?? inmueble.fotos[0].url}
                      alt={inmueble.titulo}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-150 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-text-3">Sin foto</div>
                  )}
                  {/* Chip de operacion SOBRE la foto (punto 1.4): es el primer
                      dato que separa "esto se vende" de "esto se arrienda". */}
                  <span
                    className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm"
                    style={{ background: 'var(--ms-acento)', color: 'var(--ms-contraste)' }}
                  >
                    {inmueble.operacionLabel}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-lg font-extrabold leading-none" style={{ color: 'var(--ms-acento)' }}>
                    {precioFormateado(inmueble.precio, inmueble.moneda)}
                  </p>
                  <p className="mt-2 line-clamp-1 text-sm font-bold text-text">{inmueble.titulo}</p>
                  <p className="mt-0.5 text-xs text-text-2">
                    {inmueble.tipoLabel}
                    {inmueble.sector ? ` · ${inmueble.sector}` : ''}
                  </p>
                  <DatosClave inmueble={inmueble} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={abierto.titulo}
          onClick={() => setAbierto(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-bg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] w-full bg-surface-2">
              {abierto.fotos[foto] ? (
                <Image src={abierto.fotos[foto].url} alt={abierto.titulo} fill sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-3">Sin foto</div>
              )}

              {abierto.fotos.length > 1 ? (
                <>
                  <button
                    onClick={() => setFoto((f) => (f - 1 + abierto.fotos.length) % abierto.fotos.length)}
                    aria-label="Foto anterior"
                    className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-lg text-white"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setFoto((f) => (f + 1) % abierto.fotos.length)}
                    aria-label="Foto siguiente"
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-lg text-white"
                  >
                    ›
                  </button>
                  <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white">
                    {foto + 1} / {abierto.fotos.length}
                  </p>
                </>
              ) : null}

              <button
                onClick={() => setAbierto(null)}
                aria-label="Cerrar"
                className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <p className="text-2xl font-extrabold" style={{ color: 'var(--ms-acento)' }}>
                {precioFormateado(abierto.precio, abierto.moneda)}
              </p>
              <h3 className="mt-1 text-base font-bold text-text">{abierto.titulo}</h3>
              <p className="mt-1 text-sm text-text-2">
                {abierto.tipoLabel} · {abierto.operacionLabel}
                {abierto.sector ? ` · ${abierto.sector}` : ''}
              </p>
              <DatosClave inmueble={abierto} conParqueaderos />

              <div className="mt-5 flex flex-col gap-2.5">
                {telefono ? (
                  <a
                    href={whatsappDe(abierto)}
                    target="_blank"
                    rel="noreferrer"
                    className="ms-boton flex min-h-[48px] w-full items-center justify-center rounded-xl px-6 text-sm font-bold"
                  >
                    Consultar por este inmueble
                  </a>
                ) : null}
                {/* La ficha sale con la marca del agente dueño del sitio, no de
                    quien descarga (ver el comentario de la ruta). */}
                <a
                  href={`/a/${slug}/ficha/${abierto.id}?format=pdf`}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl border px-6 text-sm font-semibold transition hover:bg-surface-2"
                  style={{ borderColor: 'var(--ms-borde)', color: 'var(--ms-acento)' }}
                >
                  Descargar ficha (PDF)
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

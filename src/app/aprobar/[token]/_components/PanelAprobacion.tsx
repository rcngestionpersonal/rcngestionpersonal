'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BloqueFinal, MarcaCambio, TramoDiff } from '@/lib/real-estate/contratos/clausulas';
import { AVISO_APROBACION, AVISO_PAGINA_APROBACION, DECLARACION_APROBACION } from '@/lib/real-estate/contratos/tipos';

// La pantalla donde una parte revisa una versión y decide. Móvil primero: el
// documento ocupa la pantalla y las dos decisiones quedan fijas abajo.
//
// Tres reglas la definen:
//   1. La advertencia de que aprobar NO es firmar se ve con el mismo peso que
//      el resto del texto: arriba, y otra vez en el paso de aprobar, antes de
//      la casilla de conformidad.
//   2. Ni aprobar ni pedir cambios se habilitan hasta que la persona desplazó
//      el documento hasta el final: es lo que permite afirmar en la constancia
//      que tuvo el texto completo a la vista.
//   3. Si ya había revisado una versión anterior, ve resaltado qué cambió.

type Comparacion = {
  base: number;
  decision: 'aprobo' | 'pidio_cambios';
  bloques: MarcaCambio[];
  filas: Record<number, Record<string, TramoDiff[] | 'agregada'>>;
  retiradas: string[];
};

type Resultado =
  | { estado: 'APROBADO'; final: boolean; etapaCompleta: boolean }
  | { estado: 'RECHAZADO' };

type Etapa = 'PRINCIPAL' | 'CONTRAPARTE';

export default function PanelAprobacion({
  token,
  nombreDocumento,
  numero,
  codigo,
  ciudad,
  fechaLarga,
  bloques,
  comparacion,
  avisos,
  parte,
  etapa,
  partes,
  remitente,
  venceEl,
  urlPdf,
}: {
  token: string;
  nombreDocumento: string;
  numero: number;
  codigo: string;
  ciudad: string;
  fechaLarga: string;
  bloques: BloqueFinal[];
  comparacion: Comparacion | null;
  avisos: string[];
  parte: { nombre: string; rol: string; enNombreDe: string | null };
  etapa: { actual: Etapa; principal: string | null; contraparte: string | null };
  partes: Array<{ nombre: string; rol: string; estado: string; esUsted: boolean }>;
  remitente: { nombre: string; empresa: string | null; photoUrl: string | null };
  venceEl: string;
  urlPdf: string;
}) {
  const [llegoAlFinal, setLlegoAlFinal] = useState(false);
  const [paso, setPaso] = useState<'aprobar' | 'cambios' | null>(null);
  const [declara, setDeclara] = useState(false);
  const [digitos, setDigitos] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const centinela = useRef<HTMLDivElement | null>(null);

  // Se marca "leído" cuando el final del documento entra en pantalla o ya quedó
  // atrás. Lo segundo importa: un deslizamiento rápido en el celular puede
  // saltar de arriba abajo sin que el final llegue a pintarse en ningún cuadro.
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo) return;
    const comprobar = () => {
      if (nodo.getBoundingClientRect().top <= window.innerHeight) setLlegoAlFinal(true);
    };
    const observer = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setLlegoAlFinal(true);
    });
    observer.observe(nodo);
    window.addEventListener('scroll', comprobar, { passive: true });
    window.addEventListener('resize', comprobar);
    comprobar();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', comprobar);
      window.removeEventListener('resize', comprobar);
    };
  }, []);

  const enviar = useCallback(
    async (cuerpo: Record<string, unknown>) => {
      setEnviando(true);
      setError('');
      try {
        const r = await fetch(`/api/aprobacion/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...cuerpo, zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(d.error ?? 'No se pudo completar la operación. Intente de nuevo.');
          return null;
        }
        return d as { estado: string; final?: boolean; etapaCompleta?: boolean };
      } catch {
        setError('No se pudo completar la operación. Revise su conexión.');
        return null;
      } finally {
        setEnviando(false);
      }
    },
    [token],
  );

  async function aprobar() {
    const d = await enviar({ accion: 'aprobar', ultimos4: digitos, leyoCompleto: llegoAlFinal, declaracion: declara });
    if (d) setResultado({ estado: 'APROBADO', final: Boolean(d.final), etapaCompleta: Boolean(d.etapaCompleta) });
  }

  async function pedirCambios() {
    const d = await enviar({ accion: 'rechazar', ultimos4: digitos, leyoCompleto: llegoAlFinal, motivo: motivo.trim() });
    if (d) setResultado({ estado: 'RECHAZADO' });
  }

  if (resultado) {
    const otraEtapa = etapa.actual === 'PRINCIPAL' ? etapa.contraparte : null;
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-text">
        <div className="w-full max-w-md text-center">
          <h1 className="text-xl font-bold">
            {resultado.estado === 'APROBADO' ? `Aprobó la versión ${numero}` : 'Pedido de cambios enviado'}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-2">
            {resultado.estado === 'RECHAZADO'
              ? `Registramos lo que indicó y avisamos a ${remitente.nombre}. Cuando la versión nueva esté lista, se la hará llegar.`
              : resultado.final
                ? 'Todas las partes aprobaron esta versión. Es el texto acordado para llevar a la firma.'
                : !resultado.etapaCompleta
                  ? 'Su aprobación quedó registrada. Faltan las demás personas que revisan con usted.'
                  : otraEtapa
                    ? `Su aprobación quedó registrada. ${remitente.nombre} decidirá cuándo enviarla a ${otraEtapa.toLowerCase()}.`
                    : 'Su aprobación quedó registrada.'}
          </p>
          {resultado.estado === 'APROBADO' ? (
            <>
              <p className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-[15px] leading-relaxed text-text">
                {AVISO_APROBACION}
              </p>
              <a
                href={urlPdf}
                className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-line-strong px-5 text-[15px] font-semibold text-text transition hover:bg-surface-2"
              >
                Descargar esta versión en PDF
              </a>
            </>
          ) : null}
          <p className="mt-4 text-xs text-text-3">
            Identificador: <span className="font-semibold text-text-2">{codigo}</span>
          </p>
        </div>
      </main>
    );
  }

  const identidadOk = /^\d{4}$/.test(digitos);
  const puedeAprobar = llegoAlFinal && declara && identidadOk && !enviando;
  const puedePedirCambios = llegoAlFinal && identidadOk && motivo.trim().length >= 3 && !enviando;
  const modificadas = comparacion
    ? bloques
        .map((b, i) => ({ b, m: comparacion.bloques[i] }))
        .filter(({ b, m }) => b.tipo === 'clausula' && m && m.estado !== 'igual')
        .map(({ b, m }) => ({ titulo: b.tipo === 'clausula' ? b.encabezado : '', nueva: m.estado === 'agregado' }))
    : [];
  const otrosCambios = comparacion ? bloques.some((b, i) => b.tipo !== 'clausula' && comparacion.bloques[i]?.estado !== 'igual') : false;

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto w-full max-w-3xl px-4 pb-40 pt-6 sm:px-6 sm:pt-8">
        <header className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-3">Revisión de borrador</p>
          <h1 className="mt-1.5 text-lg font-extrabold leading-tight sm:text-2xl">{nombreDocumento}</h1>
          <p className="mt-1 text-sm font-semibold text-text-2">Versión {numero}</p>
          <div className="mt-3 flex items-center gap-3">
            {remitente.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={remitente.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-text-2">
                {remitente.nombre.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">Le envía {remitente.nombre}</p>
              {remitente.empresa ? <p className="text-xs text-text-2">{remitente.empresa}</p> : null}
            </div>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-text-2">
            Usted revisa como <span className="font-semibold text-text">{parte.rol.toLowerCase()}</span>: {parte.nombre}
            {parte.enNombreDe ? `, por ${parte.enNombreDe}` : ''}. Este enlace es personal y está disponible hasta el {venceEl}.
          </p>
          {etapa.principal && etapa.contraparte ? (
            <p className="mt-2 text-[13px] leading-relaxed text-text-3">
              Orden de revisión: 1. {etapa.principal} → 2. {etapa.contraparte}.
            </p>
          ) : null}
        </header>

        {/* La advertencia, con el mismo cuerpo de letra que el documento. */}
        <p role="note" className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[15px] leading-relaxed text-text">
          {AVISO_APROBACION}
        </p>

        {comparacion && (modificadas.length > 0 || comparacion.retiradas.length > 0 || otrosCambios) ? (
          <section className="mt-3 rounded-2xl border border-brand-line bg-brand-dim p-4">
            <h2 className="text-[15px] font-bold text-text">
              Cambios frente a la versión {comparacion.base}
              {comparacion.decision === 'aprobo' ? ', que usted aprobó' : ', en la que usted pidió cambios'}
            </h2>
            <ul className="mt-2 space-y-1 text-[14px] leading-relaxed text-text-2">
              {modificadas.map((c) => (
                <li key={c.titulo}>
                  <span className="font-semibold text-text">{c.nueva ? 'Nueva:' : 'Modificada:'}</span> {c.titulo}
                </li>
              ))}
              {comparacion.retiradas.map((t) => (
                <li key={`r-${t}`}>
                  <span className="font-semibold text-text">Retirada:</span> {t}
                </li>
              ))}
              {otrosCambios ? <li>Cambios en los datos de las partes o del inmueble</li> : null}
            </ul>
            <p className="mt-2 text-[13px] leading-relaxed text-text-3">
              En el documento, lo agregado aparece <ins className="rounded bg-emerald-500/20 px-0.5 no-underline">resaltado</ins> y lo quitado,{' '}
              <del className="text-danger">tachado</del>.
            </p>
          </section>
        ) : null}

        {/* El documento completo, no un resumen. */}
        <article lang="es" className="mt-3 rounded-2xl border border-line bg-surface p-4 sm:p-7">
          {bloques.map((b, i) => (
            <Bloque key={i} bloque={b} marca={comparacion?.bloques[i] ?? null} filas={comparacion?.filas[i] ?? null} ciudad={ciudad} fechaLarga={fechaLarga} />
          ))}
          {/* Centinela: cuando esto entra en pantalla, la persona llegó al final. */}
          <div ref={centinela} className="h-px w-full" aria-hidden="true" />
        </article>

        <a
          href={urlPdf}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-line px-5 text-[15px] font-semibold text-text-2 transition hover:bg-surface-2"
        >
          Descargar esta versión en PDF
        </a>

        {partes.length > 1 ? (
          <section className="mt-3 rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-sm font-bold">Quiénes revisan con usted</h2>
            <p className="mt-0.5 text-[13px] text-text-3">Todas estas personas tienen que aprobar esta versión.</p>
            <ul className="mt-2 space-y-1.5">
              {partes.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-text">{p.nombre}</span>
                    <span className="text-text-3"> · {p.esUsted ? 'usted' : p.rol.toLowerCase()}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${p.estado === 'APROBADO' ? 'text-accent' : 'text-text-3'}`}>
                    {p.estado === 'APROBADO' ? '✓ Aprobó' : 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-4 text-[14px] leading-relaxed text-text-2">{AVISO_PAGINA_APROBACION}</p>
        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-text-3">
          Documento {codigo} · Si usted no es el destinatario, contacte con quien se lo envió.
        </p>
      </div>

      {/* Decisiones fijas abajo. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          {!llegoAlFinal ? (
            <p className="mb-2 text-center text-[13px] text-text-2">Desplace el documento hasta el final para poder decidir.</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setPaso('cambios');
                setError('');
              }}
              disabled={!llegoAlFinal}
              className="min-h-[52px] rounded-xl border border-line-strong bg-surface text-[15px] font-semibold text-text transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              Solicitar cambios
            </button>
            <button
              onClick={() => {
                setPaso('aprobar');
                setError('');
              }}
              disabled={!llegoAlFinal}
              className="gradient-btn min-h-[52px] rounded-xl text-[15px] font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-45"
            >
              Aprobar
            </button>
          </div>
        </div>
      </div>

      {paso ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" onClick={() => setPaso(null)}>
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg-alt p-5 pb-[max(env(safe-area-inset-bottom),20px)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text">{paso === 'aprobar' ? `Aprobar la versión ${numero}` : 'Solicitar cambios'}</h2>

            {paso === 'aprobar' ? (
              <>
                {avisos.map((a) => (
                  <p key={a} className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[14.5px] leading-relaxed text-text">
                    {a}
                  </p>
                ))}
                {/* Antes de la casilla, con el mismo peso: es aquí donde se decide. */}
                <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[15px] font-semibold leading-relaxed text-text">
                  {AVISO_APROBACION}
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={declara}
                    onChange={(e) => setDeclara(e.target.checked)}
                    className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="text-[15px] leading-relaxed text-text">{DECLARACION_APROBACION}</span>
                </label>
              </>
            ) : (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-[13px] font-semibold text-text-2">¿Qué necesita cambiar? (obligatorio)</span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Por ejemplo: el plazo de la cláusula cuarta debería ser de 12 meses."
                  className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-[15px] text-text outline-none focus:border-brand"
                />
              </label>
            )}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-semibold text-text-2">Últimos 4 dígitos de su cédula</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={digitos}
                onChange={(e) => setDigitos(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="min-h-[52px] w-full max-w-[200px] rounded-xl border border-line-strong bg-surface-2 px-4 text-xl tracking-[0.4em] text-text outline-none focus:border-brand"
                aria-label="Últimos 4 dígitos de su cédula"
              />
              <span className="mt-1.5 block text-[13px] leading-relaxed text-text-3">Confirman que es usted quien decide.</span>
            </label>

            {error ? <p className="mt-3 rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

            <div className="mt-4 flex flex-col gap-2">
              {paso === 'aprobar' ? (
                <button
                  onClick={() => void aprobar()}
                  disabled={!puedeAprobar}
                  className="gradient-btn min-h-[52px] rounded-xl text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {enviando ? 'Registrando…' : 'Apruebo esta versión'}
                </button>
              ) : (
                <button
                  onClick={() => void pedirCambios()}
                  disabled={!puedePedirCambios}
                  className="min-h-[52px] rounded-xl border border-danger text-base font-bold text-danger transition disabled:opacity-45"
                >
                  {enviando ? 'Enviando…' : 'Enviar mi pedido de cambios'}
                </button>
              )}
              <button onClick={() => setPaso(null)} className="min-h-[48px] rounded-xl text-[15px] font-semibold text-text-3">
                Volver al documento
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Tramos({ tramos }: { tramos: TramoDiff[] }) {
  return (
    <>
      {tramos.map((t, i) =>
        t.tipo === 'igual' ? (
          <span key={i}>{t.texto}</span>
        ) : t.tipo === 'agregado' ? (
          <ins key={i} className="rounded bg-emerald-500/20 px-0.5 text-text no-underline">
            {t.texto}
          </ins>
        ) : (
          <del key={i} className="text-danger">
            {t.texto}
          </del>
        ),
      )}
    </>
  );
}

function Parrafos({ texto, className }: { texto: string; className: string }) {
  return (
    <>
      {texto
        .split(/\n+/)
        .filter((t) => t.trim())
        .map((t, j) => (
          <p key={j} className={className}>
            {t}
          </p>
        ))}
    </>
  );
}

function Bloque({
  bloque: b,
  marca,
  filas,
  ciudad,
  fechaLarga,
}: {
  bloque: BloqueFinal;
  marca: MarcaCambio | null;
  filas: Record<string, TramoDiff[] | 'agregada'> | null;
  ciudad: string;
  fechaLarga: string;
}) {
  const cambio = marca && marca.estado !== 'igual';
  const resalte = cambio ? 'border-l-4 border-brand pl-3 -ml-1' : '';
  const etiqueta = cambio ? (
    <span className="mb-1 inline-block rounded-full bg-brand-dim px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-brand">
      {marca.estado === 'agregado' ? 'Nueva' : 'Modificada'}
    </span>
  ) : null;

  if (b.tipo === 'titulo') {
    return (
      <div className="mb-5 text-center">
        <h2 className="text-lg font-extrabold leading-snug sm:text-xl">{b.texto}</h2>
        <p className="mt-1 text-[13px] text-text-3">
          {ciudad}, {fechaLarga}
        </p>
      </div>
    );
  }
  if (b.tipo === 'subtitulo') {
    return <h3 className="mb-3 mt-6 text-sm font-extrabold tracking-[0.04em]">{b.texto}</h3>;
  }
  if (b.tipo === 'ficha') {
    return (
      <div className={`my-5 overflow-hidden rounded-xl border border-line ${cambio ? 'ring-2 ring-brand/40' : ''}`}>
        <p className="border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-extrabold tracking-[0.06em] text-text-2">{b.titulo}</p>
        <dl className="divide-y divide-line">
          {b.filas.map((f) => {
            const c = filas?.[f.etiqueta];
            return (
              <div key={f.etiqueta} className={`flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4 ${c ? 'bg-brand-dim' : ''}`}>
                <dt className="text-[13px] font-semibold text-text-2 sm:w-48 sm:shrink-0">{f.etiqueta}</dt>
                <dd className="min-w-0 break-words text-[15px] leading-relaxed text-text">
                  {c && c !== 'agregada' ? <Tramos tramos={c} /> : f.valor}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  }
  if (b.tipo === 'clausula') {
    return (
      <div className={`mb-5 ${resalte}`}>
        {etiqueta}
        <p className="text-[15px] font-bold">{b.encabezado}</p>
        {marca?.estado === 'modificado' && marca.tituloAnterior ? (
          <p className="text-[13px] text-text-3">
            Antes: <del>{marca.tituloAnterior}</del>
          </p>
        ) : null}
        {marca?.estado === 'modificado' && marca.tramos.length > 0 ? (
          <p className="mt-1.5 hyphens-auto whitespace-pre-line break-words text-justify text-[15px] leading-relaxed text-text-2">
            <Tramos tramos={marca.tramos} />
          </p>
        ) : (
          <Parrafos texto={b.texto} className="mt-1.5 hyphens-auto break-words text-justify text-[15px] leading-relaxed text-text-2" />
        )}
      </div>
    );
  }
  if (b.tipo === 'firmas') {
    return (
      <div className="mt-6 border-t border-line pt-5">
        <p className="text-[14px] text-text-2">El contrato se firmará personalmente por:</p>
        <ul className="mt-2 space-y-1.5">
          {b.partes.map((p, j) => (
            <li key={j} className="text-[15px]">
              <span className="font-semibold text-text">{p.enRepresentacionDe ? p.enRepresentacionDe.razonSocial : p.nombre}</span>
              <span className="text-text-3">
                {' '}
                · {p.calidad.toLowerCase()}
                {p.enRepresentacionDe ? ` (representada por ${p.nombre})` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (b.tipo === 'aviso') return null;
  return (
    <div className={`mb-3 ${resalte}`}>
      {etiqueta}
      <p className="hyphens-auto break-words text-justify text-[15px] leading-relaxed text-text-2">
        {marca?.estado === 'modificado' ? <Tramos tramos={marca.tramos} /> : b.texto}
      </p>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BloqueFinal, CambiosEntreVersiones } from '@/lib/real-estate/contratos/clausulas';
import { AVISO_APROBACION, AVISO_PAGINA_APROBACION, DECLARACION_APROBACION } from '@/lib/real-estate/contratos/tipos';

// La pantalla donde una parte revisa una versión y decide. Funciona igual en
// celular, tablet y escritorio: una sola columna, el documento arriba y la
// decisión abajo.
//
// Dos reglas la definen:
//   1. La advertencia de que aprobar NO es firmar se ve con el mismo peso que
//      el resto del texto, arriba y junto al botón. Nunca en letra chica.
//   2. Ni aprobar ni pedir cambios se habilitan hasta que la persona desplazó
//      el documento hasta el final: es lo que permite afirmar en la constancia
//      que tuvo el texto completo a la vista.

type Resultado = { estado: 'APROBADO'; versionAprobada: boolean } | { estado: 'RECHAZADO' };

export default function PanelAprobacion({
  token,
  nombreDocumento,
  numero,
  codigo,
  bloques,
  cambios,
  parte,
  partes,
  remitente,
  venceEl,
  urlPdf,
}: {
  token: string;
  nombreDocumento: string;
  numero: number;
  codigo: string;
  bloques: BloqueFinal[];
  cambios: CambiosEntreVersiones | null;
  parte: { nombre: string; rol: string; correo: string; enNombreDe: string | null };
  partes: Array<{ nombre: string; rol: string; estado: string }>;
  remitente: { nombre: string; empresa: string | null; photoUrl: string | null };
  venceEl: string;
  urlPdf: string;
}) {
  const [llegoAlFinal, setLlegoAlFinal] = useState(false);
  const [declara, setDeclara] = useState(false);
  const [digitos, setDigitos] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pidiendoCambios, setPidiendoCambios] = useState(false);
  const [motivo, setMotivo] = useState('');
  const centinela = useRef<HTMLDivElement | null>(null);

  // Se marca "leído" cuando el final del documento entra en pantalla o ya quedó
  // atrás. Lo segundo importa: un deslizamiento rápido en el celular puede
  // saltar de arriba abajo sin que el final llegue a pintarse en ningún cuadro,
  // y esperar a "verlo" dejaba el botón deshabilitado para siempre.
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
        return d as { estado: string; versionAprobada?: boolean };
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
    if (d) setResultado({ estado: 'APROBADO', versionAprobada: Boolean(d.versionAprobada) });
  }

  async function pedirCambios() {
    const d = await enviar({ accion: 'rechazar', ultimos4: digitos, leyoCompleto: llegoAlFinal, motivo: motivo.trim() });
    if (d) setResultado({ estado: 'RECHAZADO' });
  }

  if (resultado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-text">
        <div className="w-full max-w-md text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
          <h1 className="mt-3 text-xl font-bold">
            {resultado.estado === 'APROBADO' ? `Aprobó la versión ${numero}` : 'Pedido de cambios enviado'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            {resultado.estado === 'RECHAZADO'
              ? 'Registramos lo que indicó y avisamos a quien le envió el documento. Recibirá una versión nueva cuando esté lista.'
              : resultado.versionAprobada
                ? 'Todas las partes aprobaron esta versión. Le enviamos el PDF a su correo, con la constancia de aprobación como anexo.'
                : 'Su aprobación quedó registrada. Cuando las demás partes decidan, recibirá el PDF de la versión aprobada en su correo.'}
          </p>
          {resultado.estado === 'APROBADO' ? (
            <p className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-[14px] leading-relaxed text-text">
              {AVISO_APROBACION}
            </p>
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
  const hayCambios =
    cambios && (cambios.modificadas.length > 0 || cambios.agregadas.length > 0 || cambios.retiradas.length > 0 || cambios.otros);

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <header className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io · Revisión de borrador</p>
          <h1 className="mt-2 text-xl font-extrabold leading-tight sm:text-2xl">{nombreDocumento}</h1>
          <p className="mt-1 text-sm font-semibold text-text-2">Versión {numero}</p>
          <div className="mt-4 flex items-center gap-3">
            {remitente.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={remitente.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-text-2">
                {remitente.nombre.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">Le envía {remitente.nombre}</p>
              {remitente.empresa ? <p className="text-xs text-text-2">{remitente.empresa}</p> : null}
            </div>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-text-2">
            Usted revisa como <span className="font-semibold text-text">{parte.rol}</span>: {parte.nombre}
            {parte.enNombreDe ? `, por ${parte.enNombreDe}` : ''} · {parte.correo}. Este enlace es personal y está disponible
            hasta el {venceEl}.
          </p>
        </header>

        {/* La advertencia, con el mismo cuerpo de letra que el documento. */}
        <p
          role="note"
          className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 text-[14px] leading-relaxed text-text"
        >
          {AVISO_APROBACION}
        </p>

        {hayCambios && cambios ? (
          <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-bold">Cambios respecto de la versión {numero - 1}</h2>
            <ul className="mt-2 space-y-1 text-[14px] leading-relaxed text-text-2">
              {cambios.modificadas.map((c) => (
                <li key={`m-${c}`}>Modificada: {c}</li>
              ))}
              {cambios.agregadas.map((c) => (
                <li key={`a-${c}`}>Nueva: {c}</li>
              ))}
              {cambios.retiradas.map((c) => (
                <li key={`r-${c}`}>Retirada: {c}</li>
              ))}
              {cambios.otros ? <li>Cambios en los datos de las partes o del inmueble</li> : null}
            </ul>
          </section>
        ) : null}

        {/* El documento completo, no un resumen. */}
        <article className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          {bloques.map((b, i) => {
            if (b.tipo === 'titulo') {
              return (
                <h2 key={i} className="mb-5 text-center text-lg font-extrabold sm:text-xl">
                  {b.texto}
                </h2>
              );
            }
            if (b.tipo === 'subtitulo') {
              return (
                <h3 key={i} className="mb-3 mt-6 text-sm font-extrabold tracking-[0.04em]">
                  {b.texto}
                </h3>
              );
            }
            if (b.tipo === 'aviso') {
              return (
                <p key={i} className="my-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[14px] leading-relaxed text-text">
                  {b.texto}
                </p>
              );
            }
            if (b.tipo === 'ficha') {
              return (
                <div key={i} className="my-5 overflow-hidden rounded-xl border border-line">
                  <p className="border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-extrabold tracking-[0.06em] text-text-2">
                    {b.titulo}
                  </p>
                  <dl className="divide-y divide-line">
                    {b.filas.map((f) => (
                      <div key={f.etiqueta} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4">
                        <dt className="text-[13px] font-semibold text-text-2 sm:w-48 sm:shrink-0">{f.etiqueta}</dt>
                        <dd className="min-w-0 break-words text-[14px] leading-relaxed text-text">{f.valor}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            }
            if (b.tipo === 'clausula') {
              return (
                <div key={i} className="mb-5">
                  <p className="text-[14px] font-bold">{b.encabezado}</p>
                  {b.texto
                    .split(/\n+/)
                    .filter((t) => t.trim())
                    .map((t, j) => (
                      <p key={j} className="mt-1.5 break-words text-[14px] leading-relaxed text-text-2">
                        {t}
                      </p>
                    ))}
                </div>
              );
            }
            if (b.tipo === 'firmas') {
              return (
                <div key={i} className="mt-6 border-t border-line pt-5">
                  <p className="text-[13.5px] text-text-2">El contrato se firmará personalmente por:</p>
                  <ul className="mt-2 space-y-1.5">
                    {b.partes.map((p, j) => (
                      <li key={j} className="text-[14px]">
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
            return (
              <p key={i} className="mb-3 break-words text-[14px] leading-relaxed text-text-2">
                {b.texto}
              </p>
            );
          })}

          {/* Centinela: cuando esto entra en pantalla, la persona llegó al final. */}
          <div ref={centinela} className="h-px w-full" aria-hidden="true" />
        </article>

        <a
          href={urlPdf}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          Descargar esta versión en PDF
        </a>

        {partes.length > 1 ? (
          <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-bold">Quiénes revisan esta versión</h2>
            <ul className="mt-2 space-y-1.5">
              {partes.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-text">{p.nombre}</span> <span className="text-text-3">· {p.rol}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${p.estado === 'APROBADO' ? 'text-accent' : 'text-text-3'}`}>
                    {p.estado === 'APROBADO' ? '✓ Aprobó' : 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Decisión */}
        <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
          <p className="mb-4 text-[14px] leading-relaxed text-text-2">{AVISO_PAGINA_APROBACION}</p>

          {!llegoAlFinal ? (
            <p className="mb-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[14px] leading-relaxed text-text-2">
              Desplace el documento hasta el final para poder decidir. Queda registrado que tuvo el texto completo a la vista.
            </p>
          ) : null}

          <label className="mt-1 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
              Últimos 4 dígitos de su cédula
            </span>
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={digitos}
              onChange={(e) => setDigitos(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="min-h-[48px] w-full max-w-[180px] rounded-xl border border-line-strong bg-surface-2 px-4 text-lg tracking-[0.4em] text-text outline-none focus:border-brand"
              aria-label="Últimos 4 dígitos de su cédula"
            />
            <span className="mt-1.5 block text-xs leading-relaxed text-text-3">
              Confirman que es usted quien decide. Deben coincidir con los que registró quien le envió el documento.
            </span>
          </label>

          {!pidiendoCambios ? (
            <>
              <label className="mt-4 flex cursor-pointer items-start gap-3 py-2">
                <input
                  type="checkbox"
                  checked={declara}
                  onChange={(e) => setDeclara(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                <span className="text-[14px] leading-relaxed text-text-2">{DECLARACION_APROBACION}</span>
              </label>

              {/* Junto al botón, con el mismo peso: es aquí donde se decide. */}
              <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[14px] leading-relaxed text-text">
                {AVISO_APROBACION}
              </p>

              {error ? (
                <p className="mt-3 rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
              ) : null}

              <button
                onClick={() => void aprobar()}
                disabled={!puedeAprobar}
                className="gradient-btn mt-4 min-h-[52px] w-full rounded-xl text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-45"
              >
                {enviando ? 'Registrando…' : 'Apruebo esta versión'}
              </button>

              <button
                onClick={() => {
                  setPidiendoCambios(true);
                  setError('');
                }}
                className="mt-3 min-h-[44px] w-full rounded-xl border border-line text-sm font-semibold text-text-2 transition hover:bg-surface-2"
              >
                No la apruebo: necesito cambios
              </button>
            </>
          ) : (
            <div className="mt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                  ¿Qué necesita cambiar?
                </span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Por ejemplo: el plazo de la cláusula cuarta debería ser de 12 meses."
                  className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-[14px] text-text outline-none focus:border-brand"
                />
              </label>
              {error ? (
                <p className="mt-3 rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
              ) : null}
              <button
                onClick={() => void pedirCambios()}
                disabled={!puedePedirCambios}
                className="mt-3 min-h-[48px] w-full rounded-xl border border-danger px-5 text-sm font-bold text-danger transition disabled:opacity-45"
              >
                {enviando ? 'Enviando…' : 'Enviar mi pedido de cambios'}
              </button>
              <button
                onClick={() => setPidiendoCambios(false)}
                className="mt-2 min-h-[44px] w-full text-sm font-semibold text-text-3 underline-offset-2 hover:underline"
              >
                Volver
              </button>
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-text-3">
          Documento {codigo} · Si usted no es el destinatario, contacte con quien se lo envió.
        </p>
      </div>
    </main>
  );
}

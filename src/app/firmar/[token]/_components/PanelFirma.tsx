'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AVISO_FIRMA_ELECTRONICA, AVISO_PAGINA_FIRMA, NOTA_PIE_OBLIGATORIA } from '@/lib/real-estate/contratos/tipos';

// La pantalla donde una parte lee y acepta. Funciona igual en celular, tablet
// y escritorio: una sola columna, el documento arriba y la decisión abajo.
//
// La regla que la define: el botón de firmar NO se habilita hasta que la
// persona desplazó el documento hasta el final. No es un adorno de producto,
// es lo que permite afirmar en la constancia que tuvo el contenido a la vista.

export type BloqueVista =
  | { tipo: 'titulo' | 'subtitulo' | 'parrafo' | 'aviso'; texto: string }
  | { tipo: 'clausula'; encabezado: string; texto: string }
  | { tipo: 'ficha'; titulo: string; filas: Array<{ etiqueta: string; valor: string }> }
  | { tipo: 'firmas'; partes: Array<{ nombre: string; rol: string; firmado: boolean }> };

type Resultado = { estado: 'FIRMADO'; completo: boolean } | { estado: 'RECHAZADO' };

export default function PanelFirma({
  token,
  nombreDocumento,
  codigo,
  bloques,
  firmante,
  remitente,
  venceEl,
  urlPdf,
}: {
  token: string;
  nombreDocumento: string;
  codigo: string;
  bloques: BloqueVista[];
  firmante: { nombre: string; rol: string; correo: string };
  remitente: { nombre: string; empresa: string | null; photoUrl: string | null };
  venceEl: string;
  largoDocumento: number;
  urlPdf: string;
}) {
  const [llegoAlFinal, setLlegoAlFinal] = useState(false);
  const [leyoTodo, setLeyoTodo] = useState(false);
  const [aceptaFirma, setAceptaFirma] = useState(false);
  const [digitos, setDigitos] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [rechazoAbierto, setRechazoAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const centinela = useRef<HTMLDivElement | null>(null);

  // Se marca "leído" cuando el final del documento entra en pantalla. Con
  // IntersectionObserver en vez de calcular scrollTop: funciona igual con el
  // scroll de la página, con zoom y en cualquier tamaño de pantalla.
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo) return;
    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setLlegoAlFinal(true);
      },
      { threshold: 0.6 },
    );
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  const enviar = useCallback(
    async (cuerpo: Record<string, unknown>) => {
      setEnviando(true);
      setError('');
      try {
        const r = await fetch(`/api/firma/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(d.error ?? 'No se pudo completar la operación. Intente de nuevo.');
          return null;
        }
        return d as { estado: string; completo?: boolean };
      } catch {
        setError('No se pudo completar la operación. Revise su conexión.');
        return null;
      } finally {
        setEnviando(false);
      }
    },
    [token],
  );

  async function firmar() {
    const d = await enviar({
      accion: 'firmar',
      ultimos4: digitos,
      leyoCompleto: llegoAlFinal,
      aceptoLectura: leyoTodo,
      aceptoValorFirma: aceptaFirma,
      zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (d) setResultado({ estado: 'FIRMADO', completo: Boolean(d.completo) });
  }

  async function rechazar() {
    const d = await enviar({ accion: 'rechazar', motivo: motivo.trim() });
    if (d) setResultado({ estado: 'RECHAZADO' });
  }

  if (resultado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-text">
        <div className="w-full max-w-md text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
          <h1 className="mt-3 text-xl font-bold">
            {resultado.estado === 'FIRMADO' ? 'Documento firmado' : 'Documento rechazado'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            {resultado.estado === 'RECHAZADO'
              ? 'Registramos su rechazo y avisamos a quien se lo envió. El proceso quedó detenido.'
              : resultado.completo
                ? 'Ya firmaron todas las partes. Le enviamos el PDF final a su correo, con la constancia al pie.'
                : 'Su firma quedó registrada. Cuando las demás partes hagan lo propio, recibirá el PDF final en su correo.'}
          </p>
          {resultado.estado === 'FIRMADO' ? (
            <p className="mt-4 text-xs text-text-3">
              Identificador: <span className="font-semibold text-text-2">{codigo}</span>
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  const puedeFirmar = llegoAlFinal && leyoTodo && aceptaFirma && /^\d{4}$/.test(digitos) && !enviando;

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {/* Quién envía y qué es (punto 3.4) */}
        <header className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
          <h1 className="mt-2 text-xl font-extrabold leading-tight sm:text-2xl">{nombreDocumento}</h1>
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
          <p className="mt-4 text-xs leading-relaxed text-text-2">
            Usted firma como <span className="font-semibold text-text">{firmante.rol}</span>: {firmante.nombre} ·{' '}
            {firmante.correo}. Este enlace es personal y está disponible hasta el {venceEl}.
          </p>
        </header>

        {/* Límite honesto, sin letra chica (punto 3.10) */}
        <p className="mt-4 rounded-2xl border border-accent-line bg-accent-dim px-4 py-3 text-[13px] leading-relaxed text-accent">
          {AVISO_FIRMA_ELECTRONICA}
        </p>

        {/* El documento completo, no un resumen (punto 3.4) */}
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
                <p
                  key={i}
                  className="my-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-amber-700 dark:text-amber-200"
                >
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
                        <dd className="min-w-0 text-[13.5px] leading-relaxed text-text">{f.valor}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            }
            if (b.tipo === 'clausula') {
              return (
                <div key={i} className="mb-4">
                  <p className="text-[14px] font-bold">{b.encabezado}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-text-2">{b.texto}</p>
                </div>
              );
            }
            if (b.tipo === 'firmas') {
              return (
                <div key={i} className="mt-6 border-t border-line pt-5">
                  <p className="text-xs text-text-2">Partes que suscriben este documento:</p>
                  <ul className="mt-2 space-y-1.5">
                    {b.partes.map((p) => (
                      <li key={p.rol + p.nombre} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="font-semibold text-text">{p.nombre}</span>{' '}
                          <span className="text-text-3">· {p.rol}</span>
                        </span>
                        <span className={`shrink-0 text-xs font-semibold ${p.firmado ? 'text-accent' : 'text-text-3'}`}>
                          {p.firmado ? '✓ Firmado' : 'Pendiente'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            return (
              <p key={i} className="mb-3 text-[14px] leading-relaxed text-text-2">
                {b.texto}
              </p>
            );
          })}

          <p className="mt-6 border-t border-line pt-4 text-[11.5px] leading-relaxed text-text-3">
            {NOTA_PIE_OBLIGATORIA}
          </p>

          {/* Centinela: cuando esto entra en pantalla, la persona llegó al final. */}
          <div ref={centinela} className="h-px w-full" aria-hidden="true" />
        </article>

        <a
          href={urlPdf}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          Descargar el documento en PDF
        </a>

        {/* Decisión */}
        <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
          {/* Punto 4.2.c: antes de las casillas y con el mismo peso tipográfico
              que el resto de la sección. Nunca en letra chica: quien firma
              tiene que poder leerlo sin buscarlo. */}
          <p className="mb-4 text-[13.5px] leading-relaxed text-text-2">{AVISO_PAGINA_FIRMA}</p>

          {!llegoAlFinal ? (
            <p className="mb-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">
              Desplace hasta el final para habilitar la firma. Queda registrado que tuvo el contenido
              completo a la vista.
            </p>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 py-2.5">
            <input
              type="checkbox"
              checked={leyoTodo}
              onChange={(e) => setLeyoTodo(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-[13.5px] leading-relaxed text-text-2">
              He leído el documento en su totalidad y estoy de acuerdo con su contenido.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 py-2.5">
            <input
              type="checkbox"
              checked={aceptaFirma}
              onChange={(e) => setAceptaFirma(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            {/* "Reconozco" y no "acepto": una consecuencia jurídica no se
                acepta, se reconoce. Y se nombra el acto por lo que es, una
                firma electrónica, en vez de "mi aceptación electrónica". */}
            <span className="text-[13.5px] leading-relaxed text-text-2">
              Reconozco que esta firma electrónica tiene el mismo valor que mi firma manuscrita, conforme a la Ley de
              Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos del Ecuador.
            </span>
          </label>

          <label className="mt-3 block">
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
            <span className="mt-1.5 block text-xs text-text-3">
              Confirman que es usted quien firma. Deben coincidir con los que registró quien le envió el documento.
            </span>
          </label>

          {error ? (
            <p className="mt-3 rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
          ) : null}

          <button
            onClick={() => void firmar()}
            disabled={!puedeFirmar}
            className="gradient-btn mt-4 min-h-[52px] w-full rounded-xl text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-45"
          >
            {enviando ? 'Registrando su firma…' : 'Firmar'}
          </button>

          <button
            onClick={() => setRechazoAbierto((v) => !v)}
            className="mt-3 min-h-[44px] w-full text-sm font-semibold text-text-3 underline-offset-2 transition hover:text-text-2 hover:underline"
          >
            Rechazar
          </button>

          {rechazoAbierto ? (
            <div className="mt-3 rounded-xl border border-line bg-surface-2 p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                  Motivo del rechazo
                </span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-sm text-text outline-none focus:border-brand"
                />
              </label>
              <button
                onClick={() => void rechazar()}
                disabled={motivo.trim().length < 3 || enviando}
                className="mt-3 min-h-[44px] w-full rounded-xl border border-danger px-5 text-sm font-bold text-danger transition disabled:opacity-45"
              >
                Confirmar rechazo
              </button>
            </div>
          ) : null}
        </section>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-text-3">
          Documento {codigo} · Si usted no es el destinatario, contacte con quien se lo envió.
        </p>
      </div>
    </main>
  );
}

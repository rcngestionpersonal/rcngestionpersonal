'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CARTA_BLOQUES,
  type CartaBloqueClave,
  type CartaBloques,
  type CartaPaleta,
} from '@/lib/real-estate/cartas/tipos';
import type { CartaCompleta, EstadoCuotaCliente } from './tipos-cliente';

// Pasos 5 a 7: revision por bloques, vista previa en vivo del PDF y salida
// (descarga o envio).
//
// La regla que manda esta pantalla es el punto 3.5: NADA se descarga ni se
// envia sin que el agente confirme que reviso el texto. La confirmacion cae
// sola cada vez que el texto cambia, asi que no se puede confirmar una version
// y mandar otra.

type Envio = { abierto: boolean; para: string; asunto: string; mensaje: string };

export default function CartaEditor({
  carta: cartaInicial,
  cuota: cuotaInicial,
  tieneCorreo,
  t,
  onVolver,
  onCambio,
}: {
  carta: CartaCompleta;
  cuota: EstadoCuotaCliente;
  tieneCorreo: boolean;
  t: (k: string) => string;
  onVolver: () => void;
  onCambio: () => void;
}) {
  const [carta, setCarta] = useState<CartaCompleta>(cartaInicial);
  const [bloques, setBloques] = useState<CartaBloques>(cartaInicial.bloques);
  const [cuota, setCuota] = useState(cuotaInicial);
  const [paleta, setPaleta] = useState<CartaPaleta>(cartaInicial.paleta);
  const [revisada, setRevisada] = useState(Boolean(cartaInicial.revisadaAt));
  const [regenerando, setRegenerando] = useState<CartaBloqueClave | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [previaUrl, setPreviaUrl] = useState<string | null>(null);
  const [envio, setEnvio] = useState<Envio>({ abierto: false, para: '', asunto: '', mensaje: '' });
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const guardadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Vista previa en vivo (punto 3.4): es el MISMO render que la descarga, no
  // una maqueta en HTML, asi que lo que se ve es lo que va a bajar.
  const refrescarPrevia = useCallback(
    async (paletaActual: CartaPaleta) => {
      try {
        const r = await fetch(`/api/real-estate/cartas/${carta.id}/archivo?formato=png&previa=1&paleta=${paletaActual}&_=${Date.now()}`);
        if (!r.ok) return;
        const blob = await r.blob();
        setPreviaUrl((anterior) => {
          if (anterior) URL.revokeObjectURL(anterior);
          return URL.createObjectURL(blob);
        });
      } catch {
        // La previa es una ayuda, no el producto: si falla, la edicion sigue.
      }
    },
    [carta.id],
  );

  useEffect(() => {
    void refrescarPrevia(paleta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previaUrl) URL.revokeObjectURL(previaUrl);
    };
  }, [previaUrl]);

  const guardar = useCallback(
    async (siguientes: CartaBloques, paletaActual: CartaPaleta) => {
      setGuardando(true);
      try {
        const r = await fetch(`/api/real-estate/cartas/${carta.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bloques: siguientes, paleta: paletaActual }),
        });
        if (r.ok) {
          // Cualquier edicion invalida la revision: el servidor ya limpio
          // revisadaAt, y la pantalla tiene que reflejarlo.
          setRevisada(false);
          onCambio();
          void refrescarPrevia(paletaActual);
        }
      } finally {
        setGuardando(false);
      }
    },
    [carta.id, onCambio, refrescarPrevia],
  );

  function editarBloque(clave: CartaBloqueClave, texto: string) {
    const siguientes = { ...bloques, [clave]: texto };
    setBloques(siguientes);
    setRevisada(false);
    if (guardadoTimer.current) clearTimeout(guardadoTimer.current);
    guardadoTimer.current = setTimeout(() => void guardar(siguientes, paleta), 900);
  }

  async function regenerar(clave: CartaBloqueClave) {
    setRegenerando(clave);
    setError('');
    try {
      const r = await fetch(`/api/real-estate/cartas/${carta.id}/bloque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloque: clave }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.cuota) setCuota(d.cuota);
      if (!r.ok) {
        setError(d.error ?? t('cartas.error.regenerar'));
        return;
      }
      setBloques((previos) => ({ ...previos, [clave]: d.texto as string }));
      setRevisada(false);
      onCambio();
      void refrescarPrevia(paleta);
    } catch {
      setError(t('cartas.error.regenerar'));
    } finally {
      setRegenerando(null);
    }
  }

  async function cambiarPaleta(nueva: CartaPaleta) {
    setPaleta(nueva);
    await guardar(bloques, nueva);
  }

  async function confirmarRevision() {
    setError('');
    // Se manda el texto junto con la confirmacion para que no exista ninguna
    // ventana en la que se confirme una version y se guarde otra.
    const r = await fetch(`/api/real-estate/cartas/${carta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bloques, paleta, revisada: true }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error ?? t('cartas.error.guardar'));
      return;
    }
    setCarta((c) => ({ ...c, revisadaAt: d.carta?.revisadaAt ?? new Date().toISOString() }));
    setRevisada(true);
    setAviso(t('cartas.revisionConfirmada'));
    setTimeout(() => setAviso(''), 2500);
    onCambio();
  }

  async function enviarCorreo() {
    setEnviando(true);
    setError('');
    try {
      const r = await fetch(`/api/real-estate/cartas/${carta.id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ para: envio.para.trim(), asunto: envio.asunto.trim() || undefined, mensaje: envio.mensaje.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t('cartas.error.enviar'));
        return;
      }
      setEnvio({ abierto: false, para: '', asunto: '', mensaje: '' });
      setAviso(t('cartas.enviada'));
      onCambio();
    } catch {
      setError(t('cartas.error.enviar'));
    } finally {
      setEnviando(false);
    }
  }

  const mensajeWhatsapp = encodeURIComponent(
    `${t('cartas.whatsapp.mensaje')} ${carta.destinatarioNombre}`.trim(),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-text">{carta.destinatarioNombre}</h3>
          <p className="text-xs text-text-2">
            {t(`cartas.destinatario.${carta.destinatarioTipo}`)}
            {guardando ? ` · ${t('cartas.guardando')}` : ''}
          </p>
        </div>
        <button
          onClick={onVolver}
          className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {t('cartas.volverAlHistorial')}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---- Bloques editables (puntos 3.1 y 3.2) ---- */}
        <div className="space-y-3">
          {CARTA_BLOQUES.map((clave) => (
            <div key={clave} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t(`cartas.bloque.${clave}`)}</p>
                <button
                  onClick={() => void regenerar(clave)}
                  disabled={regenerando !== null || cuota.restantes <= 0}
                  className="min-h-[36px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text-2 transition hover:bg-surface-2 disabled:opacity-50"
                >
                  {regenerando === clave ? t('cartas.regenerando') : t('cartas.regenerarParrafo')}
                </button>
              </div>
              <textarea
                value={bloques[clave]}
                onChange={(e) => editarBloque(clave, e.target.value)}
                rows={clave === 'saludo' || clave === 'cierre' ? 2 : 4}
                aria-label={t(`cartas.bloque.${clave}`)}
                className="mt-2 w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-text outline-none transition focus:border-brand"
              />
            </div>
          ))}
        </div>

        {/* ---- Vista previa en vivo + salidas ---- */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('cartas.vistaPrevia')}</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface-2">
              {previaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previaUrl} alt={t('cartas.vistaPrevia')} className="w-full" />
              ) : (
                <div className="flex aspect-[794/1123] items-center justify-center text-sm text-text-3">
                  {t('cartas.generandoPrevia')}
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              {(['clara', 'oscura'] as const).map((clave) => (
                <button
                  key={clave}
                  onClick={() => void cambiarPaleta(clave)}
                  aria-pressed={paleta === clave}
                  className={`min-h-[44px] flex-1 rounded-xl border text-sm font-semibold transition ${
                    paleta === clave ? 'border-brand-line bg-brand-dim text-brand' : 'border-line text-text-2 hover:bg-surface-2'
                  }`}
                >
                  {t(`cartas.paleta.${clave}`)}
                </button>
              ))}
            </div>
          </div>

          {/* ---- La puerta del punto 3.5 ---- */}
          <div className={`rounded-2xl border p-4 ${revisada ? 'border-accent-line bg-accent-dim' : 'border-line bg-surface'}`}>
            <p className="text-sm font-bold text-text">{t('cartas.revision.titulo')}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-2">{t('cartas.revision.detalle')}</p>
            <button
              onClick={() => void confirmarRevision()}
              disabled={revisada}
              className={`mt-3 min-h-[44px] w-full rounded-xl text-sm font-bold transition ${
                revisada
                  ? 'cursor-default border border-accent-line text-accent'
                  : 'gradient-btn text-grad-contrast'
              }`}
            >
              {revisada ? t('cartas.revision.hecha') : t('cartas.revision.confirmar')}
            </button>
          </div>

          <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('cartas.salidas')}</p>
            {!revisada ? <p className="text-xs text-text-3">{t('cartas.salidas.bloqueadas')}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={revisada ? `/api/real-estate/cartas/${carta.id}/archivo?formato=pdf&paleta=${paleta}` : undefined}
                aria-disabled={!revisada}
                className={`flex min-h-[44px] items-center justify-center rounded-xl border border-line-strong text-sm font-semibold transition ${
                  revisada ? 'text-text hover:bg-surface-2' : 'pointer-events-none text-text-3 opacity-50'
                }`}
              >
                PDF
              </a>
              <a
                href={revisada ? `/api/real-estate/cartas/${carta.id}/archivo?formato=png&paleta=${paleta}` : undefined}
                aria-disabled={!revisada}
                className={`flex min-h-[44px] items-center justify-center rounded-xl border border-line-strong text-sm font-semibold transition ${
                  revisada ? 'text-text hover:bg-surface-2' : 'pointer-events-none text-text-3 opacity-50'
                }`}
              >
                PNG
              </a>
            </div>
            <button
              onClick={() => setEnvio((e) => ({ ...e, abierto: true }))}
              disabled={!revisada || !tieneCorreo}
              className="min-h-[44px] w-full rounded-xl border border-line-strong text-sm font-semibold text-text transition hover:bg-surface-2 disabled:opacity-50"
            >
              {tieneCorreo ? t('cartas.enviarCorreo') : t('cartas.sinCorreo')}
            </button>
            <a
              href={revisada ? `https://wa.me/?text=${mensajeWhatsapp}` : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!revisada}
              className={`flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line-strong text-sm font-semibold transition ${
                revisada ? 'text-text hover:bg-surface-2' : 'pointer-events-none text-text-3 opacity-50'
              }`}
            >
              {t('cartas.enviarWhatsapp')}
            </a>
            {revisada ? <p className="text-[11px] leading-relaxed text-text-3">{t('cartas.whatsapp.aviso')}</p> : null}
          </div>

          <p className="text-center text-xs text-text-3">
            {t('cartas.cuota').replace('{usadas}', String(cuota.usadas)).replace('{limite}', String(cuota.limite))}
          </p>
        </div>
      </div>

      {aviso ? <p className="rounded-xl border border-accent-line bg-accent-dim px-3.5 py-2.5 text-sm text-accent">{aviso}</p> : null}
      {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      {/* ---- Confirmacion explicita antes de enviar (punto 5.3) ---- */}
      {envio.abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={t('cartas.envio.titulo')}
          onClick={() => setEnvio((e) => ({ ...e, abierto: false }))}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg-alt p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-bold text-text">{t('cartas.envio.titulo')}</h4>
            <p className="mt-1 text-xs leading-relaxed text-text-2">{t('cartas.envio.detalle')}</p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                {t('cartas.envio.para')}
              </span>
              <input
                type="email"
                value={envio.para}
                onChange={(e) => setEnvio((v) => ({ ...v, para: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-text outline-none focus:border-brand"
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                {t('cartas.envio.asunto')}
              </span>
              <input
                value={envio.asunto}
                onChange={(e) => setEnvio((v) => ({ ...v, asunto: e.target.value }))}
                placeholder={t('cartas.envio.asuntoPlaceholder')}
                className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-text outline-none focus:border-brand"
              />
            </label>

            {previaUrl ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previaUrl} alt={t('cartas.vistaPrevia')} className="max-h-64 w-full object-cover object-top" />
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                onClick={() => void enviarCorreo()}
                disabled={enviando || !envio.para.includes('@')}
                className="gradient-btn min-h-[44px] rounded-xl px-6 text-sm font-bold text-grad-contrast disabled:opacity-50 sm:min-w-[160px]"
              >
                {enviando ? t('cartas.enviando') : t('cartas.envio.confirmar')}
              </button>
              <button
                onClick={() => setEnvio((e) => ({ ...e, abierto: false }))}
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

'use client';

import { useState } from 'react';
import type { ReportePaleta } from '@/lib/real-estate/reportes/tipos';
import type { DocumentoEnviado } from './tipos-cliente';

// Salida de cualquiera de los tres reportes: vista previa, paleta, descarga en
// PDF o PNG, envio por correo y WhatsApp. Un solo componente para los tres.
//
// EL PDF ENVIADO NO CAMBIA. Despues del primer envio por correo el PDF queda
// congelado: los reenvios y las descargas en PDF entregan ese mismo documento.
// Por eso, desde ahi la paleta queda fija en la del documento enviado.
//
// WhatsApp no deja adjuntar archivos desde un enlace. En el celular se usa el
// menu de compartir del sistema, que SI pasa el PNG; en escritorio se descarga
// el PNG y se abre el chat.

export type RespuestaEnvio = { ok: true; documento: DocumentoEnviado; reenvio: boolean; tasacionId?: string };

type Props = {
  urlArchivo: (formato: 'pdf' | 'png', paleta: ReportePaleta, previa?: boolean) => string;
  urlEnviar: string;
  // Cuerpo extra del envio (la tasacion nueva manda los datos del inmueble).
  cuerpoEnvio?: Record<string, unknown>;
  paletaInicial: ReportePaleta;
  documento?: DocumentoEnviado | null;
  tieneCorreo: boolean;
  correoInicial?: string | null;
  nombreDestinatarioInicial?: string | null;
  telefonoPropietario?: string | null;
  textoWhatsapp: string;
  nombreArchivo: string;
  t: (k: string) => string;
  onEnviado?: (para: string, respuesta: RespuestaEnvio) => void;
};

function mb(bytes: number): string {
  return (bytes / 1024).toFixed(0) + ' KB';
}

export default function CompartirReporte({
  urlArchivo,
  urlEnviar,
  cuerpoEnvio,
  paletaInicial,
  documento: documentoInicial,
  tieneCorreo,
  correoInicial,
  nombreDestinatarioInicial,
  telefonoPropietario,
  textoWhatsapp,
  nombreArchivo,
  t,
  onEnviado,
}: Props) {
  const [documento, setDocumento] = useState<DocumentoEnviado | null>(documentoInicial ?? null);
  const [paleta, setPaleta] = useState<ReportePaleta>(
    documentoInicial?.paleta === 'oscura' || documentoInicial?.paleta === 'clara' ? documentoInicial.paleta : paletaInicial,
  );
  const [cargandoPrevia, setCargandoPrevia] = useState(true);
  const [correoAbierto, setCorreoAbierto] = useState(false);
  const [para, setPara] = useState(correoInicial ?? '');
  const [nombre, setNombre] = useState(nombreDestinatarioInicial ?? '');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ofrecerEnlace, setOfrecerEnlace] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  async function enviarCorreo(modo: 'adjunto' | 'enlace') {
    setEnviando(true);
    setError('');
    setAviso('');
    try {
      const r = await fetch(urlEnviar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(cuerpoEnvio ?? {}),
          para: para.trim(),
          nombreDestinatario: nombre.trim() || undefined,
          mensaje: mensaje.trim() || undefined,
          paleta,
          modo,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // El PDF supera el limite: no se envio nada. Se ofrece el enlace.
        setOfrecerEnlace(d.code === 'pdf_muy_grande');
        setError(d.error ?? t('reportes.compartir.errorEnvio'));
        return;
      }
      const respuesta = d as RespuestaEnvio;
      setDocumento(respuesta.documento);
      setOfrecerEnlace(false);
      setAviso(
        (modo === 'enlace' ? t('reportes.compartir.enviadoEnlace') : respuesta.reenvio ? t('reportes.compartir.reenviado') : t('reportes.compartir.enviado')).replace(
          '{correo}',
          para.trim(),
        ),
      );
      setCorreoAbierto(false);
      onEnviado?.(para.trim(), respuesta);
    } catch {
      setError(t('reportes.compartir.errorEnvio'));
    } finally {
      setEnviando(false);
    }
  }

  async function compartirWhatsapp() {
    setCompartiendo(true);
    setError('');
    try {
      const r = await fetch(urlArchivo('png', paleta));
      if (!r.ok) throw new Error('render');
      const blob = await r.blob();
      const archivo = new File([blob], `${nombreArchivo}.png`, { type: 'image/png' });

      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare?.({ files: [archivo] })) {
        await nav.share({ files: [archivo], text: textoWhatsapp });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = archivo.name;
      a.click();
      URL.revokeObjectURL(url);
      const telefono = (telefonoPropietario ?? '').replace(/\D/g, '');
      window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(textoWhatsapp)}`, '_blank', 'noopener');
      setAviso(t('reportes.compartir.whatsappEscritorio'));
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(t('reportes.compartir.errorArchivo'));
    } finally {
      setCompartiendo(false);
    }
  }

  const boton =
    'flex min-h-[48px] items-center justify-center rounded-xl border border-line-strong px-3 text-sm font-semibold text-text transition hover:bg-surface-2 disabled:opacity-50';
  const campo =
    'min-h-[44px] w-full rounded-xl border border-line-strong bg-surface px-3 text-base text-text outline-none focus:border-brand sm:text-sm';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
        <div className="relative overflow-hidden rounded-xl border border-line bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={paleta}
            src={urlArchivo('png', paleta, true)}
            alt={t('reportes.compartir.previa')}
            onLoad={() => setCargandoPrevia(false)}
            onError={() => setCargandoPrevia(false)}
            className="w-full"
          />
          {cargandoPrevia ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-2 text-sm text-text-3">{t('reportes.compartir.generando')}</div>
          ) : null}
        </div>
        {documento ? (
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-text-2">
            {t('reportes.compartir.documentoCongelado')
              .replace('{fecha}', new Date(documento.creadoAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }))
              .replace('{archivo}', documento.nombreArchivo)
              .replace('{peso}', mb(documento.bytes))}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['clara', 'oscura'] as const).map((clave) => (
              <button
                key={clave}
                onClick={() => {
                  if (clave === paleta) return;
                  setCargandoPrevia(true);
                  setPaleta(clave);
                }}
                aria-pressed={paleta === clave}
                className={`min-h-[44px] rounded-xl border text-sm font-semibold transition ${
                  paleta === clave ? 'border-brand-line bg-brand-dim text-brand' : 'border-line text-text-2 hover:bg-surface-2'
                }`}
              >
                {t(`reportes.paleta.${clave}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-line bg-surface p-3 sm:p-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('reportes.compartir.titulo')}</p>
        <button
          onClick={() => void compartirWhatsapp()}
          disabled={compartiendo}
          className="gradient-btn flex min-h-[48px] w-full items-center justify-center rounded-xl text-sm font-bold text-grad-contrast disabled:opacity-60"
        >
          {compartiendo ? t('reportes.compartir.preparando') : t('reportes.compartir.whatsapp')}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <a href={urlArchivo('pdf', paleta)} className={boton}>
            {t('reportes.compartir.pdf')}
          </a>
          <a href={urlArchivo('png', paleta)} className={boton}>
            {t('reportes.compartir.png')}
          </a>
        </div>
        <button onClick={() => setCorreoAbierto((v) => !v)} disabled={!tieneCorreo} className={`${boton} w-full`}>
          {!tieneCorreo ? t('reportes.compartir.sinCorreo') : documento ? t('reportes.compartir.reenviar') : t('reportes.compartir.correo')}
        </button>

        {correoAbierto ? (
          <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
            <label className="block text-xs font-semibold text-text-2" htmlFor="reporte-para">
              {t('reportes.compartir.para')}
            </label>
            <input id="reporte-para" type="email" inputMode="email" autoComplete="email" value={para} onChange={(e) => setPara(e.target.value)} className={campo} />
            <label className="block text-xs font-semibold text-text-2" htmlFor="reporte-nombre">
              {t('reportes.compartir.nombre')}
            </label>
            <input id="reporte-nombre" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} placeholder={t('reportes.compartir.nombrePlaceholder')} className={campo} />
            <label className="block text-xs font-semibold text-text-2" htmlFor="reporte-mensaje">
              {t('reportes.compartir.mensaje')}
            </label>
            <textarea
              id="reporte-mensaje"
              rows={3}
              maxLength={2000}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder={t('reportes.compartir.mensajePlaceholder')}
              className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-base text-text outline-none focus:border-brand sm:text-sm"
            />
            <button
              onClick={() => void enviarCorreo('adjunto')}
              disabled={enviando || !/^\S+@\S+\.\S+$/.test(para.trim())}
              className="min-h-[48px] w-full rounded-xl bg-accent text-sm font-bold text-accent-contrast transition hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? t('reportes.compartir.enviando') : t('reportes.compartir.enviar')}
            </button>
          </div>
        ) : null}

        {aviso ? <p className="rounded-xl border border-accent-line bg-accent-dim px-3 py-2 text-xs text-accent">{aviso}</p> : null}
        {error ? (
          <div className="space-y-2 rounded-xl border border-danger bg-danger-dim px-3 py-2">
            <p className="text-xs text-danger">{error}</p>
            {ofrecerEnlace ? (
              <button
                onClick={() => void enviarCorreo('enlace')}
                disabled={enviando}
                className="min-h-[44px] w-full rounded-lg border border-danger text-xs font-bold text-danger disabled:opacity-50"
              >
                {enviando ? t('reportes.compartir.enviando') : t('reportes.compartir.enviarEnlace')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

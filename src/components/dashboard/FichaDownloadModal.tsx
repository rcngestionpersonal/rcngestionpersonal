'use client';

import { useState } from 'react';
import RequiereFeature from './RequiereFeature';
import type { AccesoInput } from '@/lib/real-estate/access';

type UiVersion = 'cliente' | 'sin_marca' | 'redes';
type RedesFormato = 'redes_post' | 'redes_story';
type Paleta = 'oscura' | 'clara';

// Selector de version + paleta antes de descargar la ficha (Fase 2, seccion
// 2). El bloqueo Pro (seccion 5.2) se resuelve envolviendo el selector en
// RequiereFeature: el boton "Descargar ficha" SIEMPRE se ve y SIEMPRE abre
// este modal, pero en plan Basico lo que se ve adentro es el candado
// elegante en vez del selector - nunca se oculta el boton.
export default function FichaDownloadModal({
  listingId,
  listingHasPhoto,
  suscripcion,
  lang,
  t,
  onClose,
}: {
  listingId: string;
  listingHasPhoto: boolean;
  suscripcion: AccesoInput;
  lang: 'es' | 'en';
  t: (k: string) => string;
  onClose: () => void;
}) {
  const [version, setVersion] = useState<UiVersion>('cliente');
  const [redesFormato, setRedesFormato] = useState<RedesFormato>('redes_post');
  const [paleta, setPaleta] = useState<Paleta>('oscura');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  async function handleDownload() {
    setDownloading(true);
    setError('');
    setToast('');
    try {
      const apiVersion = version === 'redes' ? redesFormato : version;
      const params = new URLSearchParams({ version: apiVersion, palette: paleta, lang });
      const res = await fetch(`/api/real-estate/listings/${listingId}/ficha?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const messageByCode: Record<string, string> = {
          feature_locked: t('ficha.errorBloqueada'),
          data_fetch_failed: t('ficha.errorDatos'),
          render_failed: t('ficha.errorGenerando'),
        };
        setError(messageByCode[body?.code] ?? t('ficha.error'));
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? (apiVersion.startsWith('redes') ? 'ficha-redinmo.png' : 'ficha-redinmo.pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setToast(t('ficha.listo'));
      setTimeout(() => setToast(''), 3000);
    } catch {
      setError(t('ficha.error'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-[24px] border border-line bg-surface p-5 sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('ficha.modal.titulo')}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-bold text-text">{t('ficha.modal.titulo')}</h3>
          <button
            onClick={onClose}
            aria-label={lang === 'es' ? 'Cerrar' : 'Close'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
          >
            ✕
          </button>
        </div>

        <RequiereFeature suscripcion={suscripcion} feature="fichas_pdf">
          <div className="mt-4 space-y-5">
            {!listingHasPhoto ? (
              <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                {t('ficha.fotoFaltante')}
              </p>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('ficha.version.titulo')}</p>
              <div className="space-y-2">
                <VersionOption
                  active={version === 'cliente'}
                  onClick={() => setVersion('cliente')}
                  title={t('ficha.version.cliente')}
                  detail={t('ficha.version.cliente.detalle')}
                />
                <VersionOption
                  active={version === 'sin_marca'}
                  onClick={() => setVersion('sin_marca')}
                  title={t('ficha.version.sinMarca')}
                  detail={t('ficha.version.sinMarca.detalle')}
                />
                <VersionOption
                  active={version === 'redes'}
                  onClick={() => setVersion('redes')}
                  title={t('ficha.version.redes')}
                  detail={t('ficha.version.redes.detalle')}
                />
              </div>
            </div>

            {version === 'redes' ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('ficha.redesFormato.titulo')}</p>
                <div className="grid grid-cols-2 gap-1.5 rounded-full border border-line bg-surface p-1">
                  {(['redes_post', 'redes_story'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setRedesFormato(opt)}
                      className={`rounded-full py-2 text-[12.5px] font-bold transition-colors ${
                        redesFormato === opt ? 'bg-accent-dim text-accent' : 'text-text-2 hover:text-text'
                      }`}
                    >
                      {opt === 'redes_post' ? t('ficha.redesFormato.post') : t('ficha.redesFormato.story')}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('ficha.paleta.titulo')}</p>
              <div className="grid grid-cols-2 gap-1.5 rounded-full border border-line bg-surface p-1">
                {(['oscura', 'clara'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPaleta(opt)}
                    className={`rounded-full py-2 text-[12.5px] font-bold transition-colors ${
                      paleta === opt ? 'bg-accent-dim text-accent' : 'text-text-2 hover:text-text'
                    }`}
                  >
                    {opt === 'oscura' ? t('ficha.paleta.oscura') : t('ficha.paleta.clara')}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-accent px-4 py-3 text-sm font-bold text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ⬇ {downloading ? t('ficha.generando') : t('ficha.descargarBoton')}
            </button>

            {error ? <p className="text-center text-xs text-danger">{error}</p> : null}
            {toast ? <p className="text-center text-xs text-accent">{toast}</p> : null}
          </div>
        </RequiereFeature>
      </div>
    </div>
  );
}

function VersionOption({ active, onClick, title, detail }: { active: boolean; onClick: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-150 ${
        active ? 'border-accent bg-accent-dim' : 'border-line-strong hover:bg-surface-2'
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          active ? 'border-accent' : 'border-line-strong'
        }`}
      >
        {active ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold text-text">{title}</span>
        <span className="mt-0.5 block text-[12px] text-text-2">{detail}</span>
      </span>
    </button>
  );
}

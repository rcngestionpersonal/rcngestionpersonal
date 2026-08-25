'use client';

import { useState } from 'react';
import { BrokerCard, DEFAULT_CARNET_MESSAGE_ES, DEFAULT_CARNET_MESSAGE_EN, type BrokerCardData } from './BrokerCard';
import { generateCarnetImage, generateCarnetPrintImage } from './carnet-image';

// Modal de "Compartir mi carnet": toggle Colegas/Clientes con vista previa en
// vivo (el MISMO BrokerCard que se ve en Ranking, solo cambia el prop
// audience) + exportar/compartir la imagen 1080x1920 de carnet-image.ts.
export default function CarnetShareModal({
  data,
  lang,
  t,
  initialAudience = 'colegas',
  onClose,
}: {
  data: BrokerCardData;
  lang: 'es' | 'en';
  t: (k: string) => string;
  initialAudience?: 'colegas' | 'clientes';
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<'colegas' | 'clientes'>(initialAudience);
  const [sharing, setSharing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState('');

  async function handleShare() {
    setSharing(true);
    setToast('');
    try {
      const levelLabel = lang === 'es' ? data.level.labelEs : data.level.labelEn;
      const firstName = data.displayName.trim().split(/\s+/)[0] ?? data.displayName;
      const defaultMessage = (lang === 'es' ? DEFAULT_CARNET_MESSAGE_ES : DEFAULT_CARNET_MESSAGE_EN).replace('{nombre}', firstName);
      const whatsappMessage = data.carnetMessage?.trim() ? data.carnetMessage : defaultMessage;
      const vigenteLabel = new Date().toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { month: 'long', year: 'numeric' });

      const blob = await generateCarnetImage({
        displayName: data.displayName,
        photoUrl: data.photoUrl,
        levelLabel,
        // El canvas de exportacion no puede resolver custom properties CSS - el
        // carnet exportado siempre usa el violeta de marca literal (Parte 5.22).
        levelColor: '#b7a5ff',
        verified: data.verified,
        audience,
        rank: data.rank,
        totalPoints: data.totalPoints,
        cierres: data.cierres,
        joinYear: data.joinYear,
        listingsActive: data.listingsActive,
        zones: data.specializationZones,
        phone: data.phone,
        whatsappMessage,
        subscriptionActive: data.subscriptionActive,
        vigenteLabel,
        carnetSlug: data.carnetSlug,
        yearsExperience: data.yearsExperience,
        licenseNumber: data.licenseNumber,
        lang,
      });
      const file = new File([blob], 'carnet-redinmo.png', { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Redinmo' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'carnet-redinmo.png';
        a.click();
        URL.revokeObjectURL(url);
        setToast(t('ranking.carnet.imagenLista'));
        setTimeout(() => setToast(''), 3000);
      }
    } catch {
      // El share/descarga puede fallar (cancelado por el usuario, canvas no
      // soportado); no es una accion critica, se ignora en silencio.
    } finally {
      setSharing(false);
    }
  }

  // Version "credencial fisica" (CR80, 600 DPI) - pensada para imprimir y
  // plastificar, no para compartir en redes. El QR apunta a la verificacion
  // publica del carnet, no a WhatsApp (Parte "alta resolucion para imprimir").
  async function handleDownloadPrint() {
    setPrinting(true);
    try {
      const levelLabel = lang === 'es' ? data.level.labelEs : data.level.labelEn;
      const blob = await generateCarnetPrintImage({
        displayName: data.displayName,
        photoUrl: data.photoUrl,
        levelLabel,
        levelColor: '#b7a5ff',
        verified: data.verified,
        yearsExperience: data.yearsExperience,
        licenseNumber: data.licenseNumber,
        company: data.company,
        zones: data.specializationZones,
        phone: data.phone,
        carnetSlug: data.carnetSlug,
        lang,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carnet-redinmo-imprimir.png';
      a.click();
      URL.revokeObjectURL(url);
      setToast(t('ranking.carnet.imagenLista'));
      setTimeout(() => setToast(''), 3000);
    } catch {
      // No bloqueante: si el canvas falla, el agente sigue teniendo la
      // version para compartir.
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-[420px] overflow-y-auto rounded-t-[24px] border border-line bg-[#141722] p-5 sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('ranking.compartirCarnet')}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-bold text-text">{t('ranking.compartirCarnet')}</h3>
          <button
            onClick={onClose}
            aria-label={lang === 'es' ? 'Cerrar' : 'Close'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-full border border-line bg-surface p-1">
          {(['colegas', 'clientes'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setAudience(opt)}
              className={`rounded-full py-2 text-[13px] font-bold transition-colors ${
                audience === opt ? 'bg-accent-dim text-accent' : 'text-text-2 hover:text-text'
              }`}
            >
              {opt === 'colegas' ? (lang === 'es' ? 'Para colegas' : 'For colleagues') : lang === 'es' ? 'Para clientes' : 'For clients'}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <BrokerCard data={data} audience={audience} lang={lang} t={t} />
        </div>

        <button
          onClick={handleShare}
          disabled={sharing}
          aria-label={t('ranking.compartirCarnet')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] bg-accent px-4 py-3 text-sm font-bold text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ↗ {sharing ? t('ranking.carnet.generando') : t('ranking.compartirCarnet')}
        </button>

        <button
          onClick={handleDownloadPrint}
          disabled={printing}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[12px] border border-line-strong px-4 py-3 text-sm font-bold text-text-2 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ⬇ {printing ? t('ranking.carnet.generando') : t('ranking.carnet.descargarImprimir')}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-text-3">{t('ranking.carnet.descargarImprimirAyuda')}</p>

        {toast ? <p className="mt-2 text-center text-xs text-accent">{toast}</p> : null}
      </div>
    </div>
  );
}

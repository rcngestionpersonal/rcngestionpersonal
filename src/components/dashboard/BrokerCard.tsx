'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AvatarInitials } from './CardKit';
import { levelColorFor } from '@/lib/real-estate/points';
import { zoneLabel } from '@/lib/real-estate/quito-zones';

export const DEFAULT_CARNET_MESSAGE_ES =
  'Hola {nombre} 👋 Encontré tu Carnet de Agente en Redinmo ✦ Me gustaría conversar contigo sobre un tema inmobiliario 🏡 ¿Cuándo tienes disponibilidad? 📅';
export const DEFAULT_CARNET_MESSAGE_EN =
  "Hi {nombre} 👋 I found your Agent Card on Redinmo ✦ I'd like to talk to you about a real estate matter 🏡 When are you available? 📅";

function onlyDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

// QR que abre WhatsApp con el mensaje precargado (editable por el agente,
// ver perfil). Arquitectura lista para un futuro QR_TARGET_CLIENTE = "cartera":
// hoy siempre "whatsapp".
const QR_TARGET_CLIENTE: 'whatsapp' | 'cartera' = 'whatsapp';

function CarnetQrBlock({ phone, message, lang }: { phone: string; message: string; lang: 'es' | 'en' }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const target = QR_TARGET_CLIENTE === 'whatsapp' ? `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}` : '';
    if (!target) return;
    QRCode.toDataURL(target, { width: 148, margin: 1, color: { dark: '#04201c', light: '#00000000' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phone, message]);

  return (
    <div className="relative mt-3 flex items-center gap-3 rounded-xl border border-accent-line bg-accent-dim p-3 text-left">
      {/* Fondo blanco fijo aqui adentro (nunca tokenizado): un QR necesita
          contraste oscuro-sobre-claro para escanear bien, sin importar el
          tema activo de la app. */}
      <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-lg bg-white/90">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="Código QR para escribir por WhatsApp" className="h-full w-full" />
        ) : (
          <span className="text-[9px] text-black/50">QR</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-text">{lang === 'es' ? 'Escanéame y hablemos por WhatsApp' : 'Scan me and let’s talk on WhatsApp'}</p>
        <p className="mt-0.5 text-[10.5px] text-text-2">
          {lang === 'es' ? 'Abre un chat directo conmigo con un mensaje listo.' : 'Opens a direct chat with me, message ready to send.'}
        </p>
      </div>
    </div>
  );
}

// El Carnet de Agente: UN solo componente para las dos audiencias (colegas /
// clientes) - nunca duplicar. La version Clientes oculta puntos/posicion
// (jerga interna que el cliente no entiende); la version Colegas las
// muestra. Nunca se expone el total de agentes de la Red (ni aqui ni en la
// imagen exportada - ver carnet-image.ts), solo "#N en la Red".
export type BrokerCardData = {
  displayName: string;
  photoUrl?: string | null;
  verified: boolean;
  level: { key: string; labelEs: string; labelEn: string; min: number };
  totalPoints: number;
  rank: number;
  cierres: number;
  listingsActive: number;
  joinYear: number;
  specializationZones: string[];
  phone: string;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  specialty?: 'SALE' | 'RENT' | 'BOTH';
  subscriptionActive: boolean;
  carnetMessage?: string | null;
  carnetSlug?: string | null;
  yearsExperience?: number | null;
  licenseNumber?: string | null;
  company?: string | null;
};

export function BrokerCard({
  data,
  audience,
  lang,
  t,
}: {
  data: BrokerCardData;
  audience: 'colegas' | 'clientes';
  lang: 'es' | 'en';
  t: (k: string) => string;
}) {
  const levelLabel = lang === 'es' ? data.level.labelEs : data.level.labelEn;
  const levelColor = levelColorFor(data.level.key);
  const zones = data.specializationZones.map((key) => zoneLabel(key, lang)).filter(Boolean);
  const vigenteLabel = new Date().toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { month: 'long', year: 'numeric' });
  const firstName = data.displayName.trim().split(/\s+/)[0] ?? data.displayName;
  const defaultMessage = (lang === 'es' ? DEFAULT_CARNET_MESSAGE_ES : DEFAULT_CARNET_MESSAGE_EN).replace('{nombre}', firstName);
  const whatsappMessage = data.carnetMessage?.trim() ? data.carnetMessage : defaultMessage;

  return (
    <div
      className="relative overflow-hidden rounded-[20px] border border-accent-line p-5 text-center sm:p-6"
      style={{ background: 'linear-gradient(165deg, var(--surface) 0%, var(--surface-2) 100%)' }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-accent-line" />
      <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full border border-accent-line" />

      <p className="relative text-[10px] font-extrabold uppercase tracking-[0.18em] text-text-3">
        <span className="text-accent">✦ REDINMO</span> · {t('ranking.carnet.tipo').replace('· ', '')}
      </p>

      <div className="relative mt-4 flex justify-center">
        <div className="rounded-full outline outline-[2.5px] outline-offset-[3px] outline-accent">
          <AvatarInitials name={data.displayName || '—'} size={88} colorHex="#efeaff" photoUrl={data.photoUrl} />
        </div>
      </div>

      <p className="relative mt-3 truncate text-[21px] font-extrabold text-text">{data.displayName}</p>

      <div className="relative mt-2 flex flex-wrap items-center justify-center gap-1.5">
        {data.verified ? (
          <span className="inline-flex items-center rounded-full border border-accent-line bg-accent-dim px-2.5 py-1 text-[10px] font-bold text-accent">
            ✓ {t('shell.verificado')}
          </span>
        ) : null}
        <span
          className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-dim px-2.5 py-1 text-[10px] font-bold"
          style={{ color: levelColor }}
        >
          ● {levelLabel}
        </span>
      </div>

      {zones.length > 0 ? <p className="relative mt-3 text-[11.5px] text-text-2">{zones.join(' · ')}</p> : null}

      {data.yearsExperience || data.licenseNumber ? (
        <div className="relative mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {data.yearsExperience ? (
            <span className="inline-flex items-center rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-[10px] font-bold text-text">
              {data.yearsExperience}+ {lang === 'es' ? 'años de experiencia' : 'years of experience'}
            </span>
          ) : null}
          {data.licenseNumber ? (
            <span className="inline-flex items-center rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-[10px] font-bold text-text">
              {lang === 'es' ? 'Lic.' : 'Lic.'} {data.licenseNumber}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {audience === 'colegas' ? (
          <>
            <MiniStat value={`#${data.rank}`} label={lang === 'es' ? 'EN LA RED' : 'IN THE NETWORK'} />
            <MiniStat value={String(data.cierres)} label={t('ranking.carnet.cierresLabel')} />
            <MiniStat value={String(data.totalPoints)} label={t('ranking.carnet.puntosLabel')} />
          </>
        ) : (
          <>
            <MiniStat value={String(data.cierres)} label={t('ranking.carnet.cierresLabel')} />
            <MiniStat value={String(data.joinYear)} label={lang === 'es' ? 'EN REDINMO' : 'ON REDINMO'} />
            <MiniStat value={String(data.listingsActive)} label={lang === 'es' ? 'INMUEBLES ACTIVOS' : 'ACTIVE LISTINGS'} />
          </>
        )}
      </div>

      <p className="relative mt-4 text-[10.5px] font-semibold" style={{ color: data.subscriptionActive ? 'var(--accent)' : 'var(--text-3)' }}>
        {data.subscriptionActive ? `● ${lang === 'es' ? 'Vigente' : 'Active'} · ${vigenteLabel}` : lang === 'es' ? 'No vigente' : 'Not active'}
      </p>

      <div className="relative mt-4 rounded-xl border border-dashed border-line bg-surface-2 p-3 text-left">
        <p className="flex items-center gap-1.5 text-[12px] text-text-2">
          <span aria-hidden="true" className="text-accent">✆</span> {data.phone}
        </p>
        <p className="mt-1 text-[12px] text-text-2">
          Quito, Ecuador{zones.length > 0 ? ` · ${zones.slice(0, 2).join(', ')}` : ''}
        </p>
      </div>

      <CarnetQrBlock phone={data.phone} message={whatsappMessage} lang={lang} />

      {data.carnetSlug ? (
        <p className="relative mt-3 text-[9.5px] text-text-3">
          {lang === 'es' ? 'Verifica este carnet en' : 'Verify this card at'}{' '}
          <span className="font-semibold text-text-2">redinmo.io/v/{data.carnetSlug}</span>
        </p>
      ) : null}

      <p className="relative mt-4 text-[10px] text-text-3">
        <span className="font-bold text-accent">redinmo.io</span> ·{' '}
        {lang === 'es' ? 'EL HUB QUE CONECTA COLEGAS' : 'THE HUB THAT CONNECTS COLLEAGUES'}
      </p>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[11px] bg-surface-2 p-3 text-center">
      <p className="truncate text-lg font-extrabold text-accent">{value}</p>
      <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-text-3">{label}</p>
    </div>
  );
}

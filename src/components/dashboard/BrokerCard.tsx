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
    <div className="relative mt-3 flex items-center gap-3 rounded-xl border border-[rgba(45,212,191,0.35)] bg-[rgba(45,212,191,0.12)] p-3 text-left">
      <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-lg bg-white/90">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="Código QR para escribir por WhatsApp" className="h-full w-full" />
        ) : (
          <span className="text-[9px] text-[#0b0d14]/50">QR</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-[#f0f1f7]">{lang === 'es' ? 'Escanéame y hablemos por WhatsApp' : 'Scan me and let’s talk on WhatsApp'}</p>
        <p className="mt-0.5 text-[10.5px] text-[#9296b0]">
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
      className="relative overflow-hidden rounded-[20px] border p-5 text-center sm:p-6"
      style={{ background: 'linear-gradient(165deg, #131a22 0%, #10141f 45%, #141225 100%)', borderColor: 'rgba(45,212,191,0.35)' }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[rgba(45,212,191,0.2)]" />
      <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full border border-[rgba(45,212,191,0.2)]" />

      <p className="relative text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#62667f]">
        <span className="text-[#2dd4bf]">✦ REDINMO</span> · {t('ranking.carnet.tipo').replace('· ', '')}
      </p>

      <div className="relative mt-4 flex justify-center">
        <div className="rounded-full outline outline-[2.5px] outline-offset-[3px] outline-[#2dd4bf]">
          <AvatarInitials name={data.displayName || '—'} size={88} colorHex="#26304a" photoUrl={data.photoUrl} />
        </div>
      </div>

      <p className="relative mt-3 truncate text-[21px] font-extrabold text-[#f0f1f7]">{data.displayName}</p>

      <div className="relative mt-2 flex flex-wrap items-center justify-center gap-1.5">
        {data.verified ? (
          <span className="inline-flex items-center rounded-full border border-[rgba(45,212,191,0.35)] bg-[rgba(45,212,191,0.12)] px-2.5 py-1 text-[10px] font-bold text-[#2dd4bf]">
            ✓ {t('shell.verificado')}
          </span>
        ) : null}
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold"
          style={{ borderColor: 'rgba(167,139,250,0.42)', background: 'rgba(167,139,250,0.13)', color: levelColor }}
        >
          ● {levelLabel}
        </span>
      </div>

      {zones.length > 0 ? <p className="relative mt-3 text-[11.5px] text-[#9296b0]">{zones.join(' · ')}</p> : null}

      {data.yearsExperience || data.licenseNumber ? (
        <div className="relative mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {data.yearsExperience ? (
            <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.12)] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-[#f0f1f7]">
              {data.yearsExperience}+ {lang === 'es' ? 'años de experiencia' : 'years of experience'}
            </span>
          ) : null}
          {data.licenseNumber ? (
            <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.12)] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-[#f0f1f7]">
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

      <p className="relative mt-4 text-[10.5px] font-semibold" style={{ color: data.subscriptionActive ? '#2dd4bf' : '#62667f' }}>
        {data.subscriptionActive ? `● ${lang === 'es' ? 'Vigente' : 'Active'} · ${vigenteLabel}` : lang === 'es' ? 'No vigente' : 'Not active'}
      </p>

      <div className="relative mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-left">
        <p className="flex items-center gap-1.5 text-[12px] text-[#9296b0]">
          <span aria-hidden="true" className="text-[#2dd4bf]">✆</span> {data.phone}
        </p>
        <p className="mt-1 text-[12px] text-[#9296b0]">
          Quito, Ecuador{zones.length > 0 ? ` · ${zones.slice(0, 2).join(', ')}` : ''}
        </p>
      </div>

      <CarnetQrBlock phone={data.phone} message={whatsappMessage} lang={lang} />

      {data.carnetSlug ? (
        <p className="relative mt-3 text-[9.5px] text-[#62667f]">
          {lang === 'es' ? 'Verifica este carnet en' : 'Verify this card at'}{' '}
          <span className="font-semibold text-[#8b8fa3]">redinmo.io/v/{data.carnetSlug}</span>
        </p>
      ) : null}

      <p className="relative mt-4 text-[10px] text-[#62667f]">
        <span className="font-bold text-[#2dd4bf]">redinmo.io</span> ·{' '}
        {lang === 'es' ? 'EL HUB QUE CONECTA COLEGAS' : 'THE HUB THAT CONNECTS COLLEAGUES'}
      </p>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[11px] bg-white/[0.03] p-3 text-center">
      <p className="truncate text-lg font-extrabold text-[#3ee8d2]">{value}</p>
      <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#62667f]">{label}</p>
    </div>
  );
}

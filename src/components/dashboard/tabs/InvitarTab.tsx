'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { Card, ModuleHeader } from '../CardKit';
import { IconInvite } from '../icons';
import type { AgentItem } from '../types';

export default function InvitarTab({ myAgentId, agents }: { myAgentId?: string; agents: AgentItem[] }) {
  const { t, lang } = useLanguage();
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://redinmo.io';
  const inviteUrl = myAgentId ? `${origin}/agentes/registro?ref=${myAgentId}` : '';

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El portapapeles puede fallar (permiso denegado, contexto no seguro); el
      // input de todas formas queda seleccionable manualmente.
    }
  }

  const whatsappMessage =
    lang === 'es'
      ? `👋 Hola, te invito a unirte a Redinmo, la plataforma de matches entre agentes inmobiliarios de Quito. Regístrate con mi link: ${inviteUrl}`
      : `👋 Hi, I'm inviting you to join Redinmo, the matching platform for Quito real estate agents. Sign up with my link: ${inviteUrl}`;

  const invited = agents.filter((a) => a.referredByAgentId === myAgentId);

  return (
    <div className="space-y-8">
      <ModuleHeader icon={<IconInvite className="h-[17px] w-[17px]" strokeWidth={1.8} />} title={t('invitar.title')} subtitle={t('invitar.subtitle')} />

      <Card>
        <h3 className="text-[17px] font-bold text-[#f0f1f7]">{t('invitar.tuLink')}</h3>
        <p className="mt-1 text-sm text-[#9296b0]">{t('invitar.tuLinkDetalle')}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={inviteUrl}
            onClick={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 truncate rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#171a26] px-3 py-2.5 text-sm text-[#f0f1f7] outline-none"
          />
          <button
            onClick={copyLink}
            className="shrink-0 rounded-[10px] border border-[rgba(167,139,250,0.42)] bg-[rgba(167,139,250,0.13)] px-4 py-2.5 text-sm font-bold text-[#b7a5ff] transition-colors duration-150 hover:bg-[rgba(167,139,250,0.22)]"
          >
            {copied ? t('invitar.copiado') : t('invitar.copiar')}
          </button>
        </div>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex w-full items-center justify-center rounded-[10px] bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] px-4 py-[13px] text-[15px] font-bold text-white transition-[filter] duration-150 hover:brightness-[1.08] sm:w-auto"
        >
          {t('invitar.compartirWhatsapp')}
        </a>
      </Card>

      <Card>
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#f0f1f7]">
          <Users className="h-4 w-4 shrink-0 text-[#b7a5ff]" strokeWidth={2} />
          <span className="min-w-0 truncate">{t('invitar.agentesInvitados')} ({invited.length})</span>
        </h3>
        {invited.length === 0 ? (
          <p className="mt-2 text-sm text-[#62667f]">{t('invitar.sinInvitados')}</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {invited.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-white/80">{a.fullName}</span>
                <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {t('invitar.registrado')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

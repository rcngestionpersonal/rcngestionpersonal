'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { isAgentVerified, type AgentItem } from '../types';
import { daysRemaining, resolveEffectiveSubscriptionStatus } from '@/lib/real-estate/subscription-status';

export default function SuscripcionTab({
  isAdmin,
  agents,
  myAgentId,
  activateSubscription,
  activating,
}: {
  isAdmin: boolean;
  agents: AgentItem[];
  myAgentId?: string;
  activateSubscription: (agentId: string) => void;
  activating: string | null;
}) {
  const { t, tSubscriptionStatus } = useLanguage();

  if (!isAdmin) {
    const myAgent = agents.find((a) => a.id === myAgentId);
    const verified = isAgentVerified(myAgent);
    const effectiveStatus = myAgent ? resolveEffectiveSubscriptionStatus(myAgent) : undefined;
    const needsPayment = effectiveStatus === 'TRIAL' || effectiveStatus === 'INACTIVE' || effectiveStatus === 'PAST_DUE';

    return (
      <div className="space-y-10">
        <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
          <h2 className="text-xl font-bold text-text">{t('suscripcion.title.agent')}</h2>
          <p className="mt-1 text-sm text-text-2">{t('suscripcion.plan')}</p>

          {myAgent ? (
            <article className="mt-4 rounded-2xl border border-line bg-surface-2 p-4">
              <p className="text-sm font-semibold text-text">{myAgent.fullName}</p>
              <p className="text-xs text-text-2">
                {myAgent.company ?? t('suscripcion.sinEmpresa')} | {myAgent.phone}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-1 text-xs font-semibold text-text">
                  {tSubscriptionStatus(effectiveStatus ?? myAgent.subscriptionStatus)}
                </span>
                {needsPayment ? (
                  <Link
                    href="/agentes/suscripcion/pagar"
                    className="gradient-btn w-full rounded-full px-3 py-2 text-center text-xs font-semibold transition-transform duration-200 hover:scale-[1.02] sm:w-auto sm:py-1.5"
                  >
                    {t('suscripcion.activar')}
                  </Link>
                ) : effectiveStatus === 'ACTIVE' ? (
                  <span className="text-xs font-semibold text-emerald-400">{t('suscripcion.pagoActivo')}</span>
                ) : null}
              </div>
              {effectiveStatus === 'TRIAL' ? (
                <p className="mt-2 text-xs text-text-2">
                  {t('suscripcion.diasRestantes')} <span className="font-semibold text-text">{daysRemaining(myAgent.trialEndsAt)}</span>
                </p>
              ) : null}
              {!verified ? (
                <a href="/agentes/verificar-telefono" className="mt-2 inline-block text-xs font-semibold text-violet-300 hover:underline">
                  {t('suscripcion.verificarPendiente')} →
                </a>
              ) : null}
            </article>
          ) : (
            <p className="mt-4 text-sm text-text-2">{t('suscripcion.sinRegistro')}</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">{t('suscripcion.title.admin')}</h2>
        <p className="text-sm text-text-2">{t('suscripcion.planShort')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <article
            key={agent.id}
            className="rounded-2xl border border-line bg-surface-2 p-4 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <p className="text-sm font-semibold text-text">
              {agent.fullName}
              {isAgentVerified(agent) ? (
                <span className="ml-1.5 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-emerald-300">
                  ✓
                </span>
              ) : null}
            </p>
            <p className="text-xs text-text-2">
              {agent.company ?? t('suscripcion.sinEmpresa')} | {agent.phone}
            </p>
            <p className="mt-2 text-xs text-text-2">
              {t('suscripcion.zonas')} {agent.zones.join(', ') || t('suscripcion.noDefinidas')}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-1 text-xs font-semibold text-text">
                {tSubscriptionStatus(agent.subscriptionStatus)}
              </span>
              {agent.subscriptionStatus !== 'ACTIVE' ? (
                <button
                  onClick={() => activateSubscription(agent.id)}
                  disabled={activating === agent.id}
                  className="gradient-btn w-full rounded-full px-3 py-2 text-xs font-semibold transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-1.5"
                >
                  {activating === agent.id ? (
                    t('suscripcion.activando')
                  ) : (
                    <span className="flex flex-col items-center leading-tight">
                      <span>{t('suscripcion.activar')}</span>
                      <span className="text-[10px] font-normal opacity-80">{t('suscripcion.masIva')}</span>
                    </span>
                  )}
                </button>
              ) : (
                <span className="text-xs font-semibold text-emerald-400">{t('suscripcion.pagoActivo')}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

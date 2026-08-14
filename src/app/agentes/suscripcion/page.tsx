'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PayPalSubscribeButton, { isPaypalButtonConfigured } from '@/components/dashboard/PayPalSubscribeButton';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { TRIAL_DAYS } from '@/lib/real-estate/paypal';

type MeAgent = {
  id: string;
  fullName: string;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE';
  trialEndsAt?: string;
  phoneVerifiedAt?: string | null;
};

function daysRemaining(trialEndsAt?: string): number {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function SuscripcionOnboardingPage() {
  return (
    <LanguageProvider>
      <SuscripcionOnboardingContent />
    </LanguageProvider>
  );
}

function SuscripcionOnboardingContent() {
  const router = useRouter();
  const [agent, setAgent] = useState<MeAgent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/real-estate/agents/me', { cache: 'no-store' });
      if (!res.ok) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      const me = data.agent as MeAgent;
      if (!me.phoneVerifiedAt) {
        router.replace('/agentes/verificar-telefono');
        return;
      }
      setAgent(me);
    } finally {
      setLoading(false);
    }
  }

  function goToDashboard() {
    router.replace('/');
    router.refresh();
  }

  if (loading || !agent) {
    return <main className="min-h-screen bg-bg" />;
  }

  const days = daysRemaining(agent.trialEndsAt);

  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-10 text-text sm:py-16">
      <div className="mx-auto max-w-md">
        <section className="grain-overlay relative mb-6 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-violet-600/25 blur-2xl" />
          <div className="relative z-10 space-y-2">
            <p className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              Paso 2 de 2
            </p>
            <h1 className="gradient-text text-2xl font-bold leading-tight sm:text-3xl">Activa tu suscripción</h1>
            <p className="max-w-xl text-sm text-text-2">
              {agent.subscriptionStatus === 'ACTIVE'
                ? 'Tu suscripción ya está activa.'
                : `Tu prueba gratuita de ${TRIAL_DAYS} días está activa${days > 0 ? ` (te quedan ${days} día${days === 1 ? '' : 's'})` : ''}. Suscríbete ahora o continúa disfrutando tu trial.`}
            </p>
          </div>
        </section>

        <section className="glass-card rounded-3xl p-5 sm:p-6">
          {agent.subscriptionStatus !== 'ACTIVE' && isPaypalButtonConfigured() ? (
            <PayPalSubscribeButton onSuccess={goToDashboard} />
          ) : null}

          <button
            onClick={goToDashboard}
            className="mt-4 w-full rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm font-semibold text-text transition hover:bg-surface-2"
          >
            {agent.subscriptionStatus === 'ACTIVE' ? 'Ir a mi panel →' : 'Continuar con mi prueba gratuita →'}
          </button>
        </section>
      </div>
    </main>
  );
}

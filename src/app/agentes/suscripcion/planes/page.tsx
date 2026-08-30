'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageProvider';
import { resolveEffectiveSubscriptionStatus } from '@/lib/real-estate/subscription-status';
import { PLANES, formatUsd, planTipoToParam, type Feature, type PlanTipo } from '@/config/planes';
import { IconCheck } from '@/components/dashboard/icons';
import { PriceTag } from '@/components/PriceTag';

type MeAgent = {
  id: string;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE';
  trialEndsAt?: string | null;
  subscriptionPaidUntil?: string | null;
  plan?: PlanTipo;
  precioFundadorBasico?: number | null;
};

const FEATURE_ORDER: Feature[] = [
  'matches_ilimitados',
  'gestion_inventario',
  'mapa_cierres_consulta',
  'carnet_estandar',
  'ranking',
  'seguimientos',
  'mini_sitio',
  'fichas_pdf',
  'carta_presentacion',
  'reportes_clientes',
  'carnet_pro',
];

export default function PlanesPage() {
  return (
    <LanguageProvider>
      <PlanesContent />
    </LanguageProvider>
  );
}

function fmtFecha(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

function PlanesContent() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const [agent, setAgent] = useState<MeAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPlan, setPendingPlan] = useState<PlanTipo | null>(null);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [error, setError] = useState('');
  const [scheduled, setScheduled] = useState<{ plan: PlanTipo; effectiveAt: string | null } | null>(null);

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
      setAgent(data.agent as MeAgent);
    } finally {
      setLoading(false);
    }
  }

  const effectiveStatus = agent ? resolveEffectiveSubscriptionStatus(agent) : undefined;
  const needsPayment = effectiveStatus === 'TRIAL' || effectiveStatus === 'INACTIVE' || effectiveStatus === 'PAST_DUE';
  const isActive = effectiveStatus === 'ACTIVE';

  async function elegirPlanEnCheckout(tipo: PlanTipo) {
    router.push(`/agentes/suscripcion/pagar?plan=${planTipoToParam(tipo)}`);
  }

  async function programarCambio(tipo: PlanTipo) {
    setPendingPlan(tipo);
    setError('');
    try {
      const res = await fetch('/api/real-estate/billing/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: tipo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('suscripcion.errorCambioPlan'));
        return;
      }
      setScheduled({ plan: tipo, effectiveAt: data.effectiveAt ?? null });
      setAgent((prev) => (prev ? { ...prev, ...data.agent } : prev));
    } catch {
      setError(t('suscripcion.errorCambioPlan'));
    } finally {
      setPendingPlan(null);
      setConfirmDowngrade(false);
    }
  }

  function handleCardAction(tipo: PlanTipo) {
    if (needsPayment) {
      void elegirPlanEnCheckout(tipo);
      return;
    }
    if (!agent || tipo === agent.plan) return;
    if (tipo === 'BASICO') {
      setConfirmDowngrade(true);
      return;
    }
    void programarCambio(tipo);
  }

  const planActualNombre = useMemo(() => {
    if (!agent?.plan) return null;
    return agent.plan === 'PRO' ? t('plan.pro.nombre') : t('plan.basico.nombre');
  }, [agent?.plan, t]);

  if (loading || !agent) {
    return <main className="min-h-screen bg-bg" />;
  }

  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-10 text-text sm:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href="/" className="text-sm text-text-2 underline decoration-dotted underline-offset-2 hover:text-text">
            ← {t('planes.volver')}
          </Link>
        </div>

        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-3">{t('planes.eyebrow')}</p>
          <h1 className="gradient-text mt-1 text-2xl font-bold leading-tight sm:text-3xl">{t('planes.titulo')}</h1>
        </div>

        {effectiveStatus === 'TRIAL' ? (
          <div className="mb-6 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-text-2">
            {t('planes.avisoTrial')}
          </div>
        ) : null}

        {agent.precioFundadorBasico ? (
          <div className="mb-6 rounded-2xl border border-accent-line bg-accent-dim px-4 py-3 text-center text-sm font-medium text-accent">
            {t('planes.fundadorAviso')}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-2xl border border-danger bg-danger-dim px-4 py-3 text-center text-sm text-danger">{error}</div>
        ) : null}

        {scheduled ? (
          <div className="mb-6 rounded-2xl border border-accent-line bg-accent-dim px-4 py-3 text-center text-sm font-semibold text-accent">
            {t('suscripcion.cambiaraA')
              .replace('{plan}', scheduled.plan === 'PRO' ? t('plan.pro.nombre') : t('plan.basico.nombre'))
              .replace('{fecha}', fmtFecha(scheduled.effectiveAt))}
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <PlanCard
            tipo="BASICO"
            destacado={false}
            planActual={isActive && agent.plan === 'BASICO'}
            needsPayment={needsPayment}
            disabled={pendingPlan !== null}
            onAction={() => handleCardAction('BASICO')}
            lang={lang}
            t={t}
          />
          <PlanCard
            tipo="PRO"
            destacado
            planActual={isActive && agent.plan === 'PRO'}
            needsPayment={needsPayment}
            disabled={pendingPlan !== null}
            onAction={() => handleCardAction('PRO')}
            lang={lang}
            t={t}
          />
        </div>

        {planActualNombre && !needsPayment ? (
          <p className="mt-6 text-center text-xs text-text-3">
            {t('suscripcion.planActual')}: <span className="font-semibold text-text-2">{planActualNombre}</span>
          </p>
        ) : null}
      </div>

      {confirmDowngrade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-[1.6rem] border border-line bg-surface p-6 shadow-xl">
            <p className="text-sm text-text-2">{t('planes.downgradeAviso')}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => void programarCambio('BASICO')}
                disabled={pendingPlan !== null}
                className="rounded-full border border-danger bg-danger-dim px-4 py-2.5 text-sm font-semibold text-danger transition hover:brightness-110 disabled:opacity-60"
              >
                {t('planes.downgradeConfirmar')}
              </button>
              <button
                onClick={() => setConfirmDowngrade(false)}
                className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
              >
                {t('planes.downgradeCancelar')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PlanCard({
  tipo,
  destacado,
  planActual,
  needsPayment,
  disabled,
  onAction,
  lang,
  t,
}: {
  tipo: PlanTipo;
  destacado: boolean;
  planActual: boolean;
  needsPayment: boolean;
  disabled: boolean;
  onAction: () => void;
  lang: 'es' | 'en';
  t: (key: string) => string;
}) {
  const plan = PLANES[tipo];
  const nombre = tipo === 'PRO' ? t('plan.pro.nombre') : t('plan.basico.nombre');
  const bajada = tipo === 'PRO' ? t('planes.pro.bajada') : t('planes.basico.bajada');

  let ctaLabel: string;
  if (planActual) {
    ctaLabel = t('planes.planActualBadge');
  } else if (needsPayment) {
    ctaLabel = tipo === 'PRO' ? t('planes.elegirPro') : t('planes.elegirBasico');
  } else {
    ctaLabel = tipo === 'PRO' ? t('planes.cambiarAPro') : t('planes.cambiarABasico');
  }

  const card = (
    <section className="grain-overlay relative flex h-full flex-col rounded-[calc(1.5rem-2px)] bg-surface p-6 sm:p-7">
      {destacado ? (
        <span className="gradient-btn absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-grad-contrast">
          {t('planes.recomendado')}
        </span>
      ) : null}

      <h2 className="text-xl font-bold text-text">{nombre}</h2>
      <p className="mt-1 text-sm text-text-2">{bajada}</p>

      <PriceTag
        className="mt-4 text-3xl font-bold text-text"
        amount={`$${formatUsd(plan.precioBase)}`}
        suffix={lang === 'es' ? '+ IVA al mes' : '+ tax/mo'}
      />

      <ul className="mt-5 flex-1 space-y-2.5">
        {FEATURE_ORDER.filter((f) => plan.features.includes(f)).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-text-2">
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>{t(`feature.${f}`)}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onAction}
        disabled={planActual || disabled}
        className={`mt-6 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-transform duration-200 ${
          planActual
            ? 'cursor-default border border-line-strong bg-surface-2 text-text-2'
            : 'gradient-btn text-grad-contrast hover:scale-[1.02] disabled:opacity-60'
        }`}
      >
        {ctaLabel}
      </button>
    </section>
  );

  if (!destacado) {
    return <div className="rounded-3xl border border-line shadow-md backdrop-blur-xl">{card}</div>;
  }

  // La tarjeta Pro lleva un borde con el degradado de marca: un wrapper con
  // fondo degradado y 2px de padding hace de "borde", sin depender de
  // background-clip (mas fragil entre temas).
  return (
    <div className="rounded-3xl p-[2px] shadow-lg" style={{ background: 'var(--grad)' }}>
      {card}
    </div>
  );
}

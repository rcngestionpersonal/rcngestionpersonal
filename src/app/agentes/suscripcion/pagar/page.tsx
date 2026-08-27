'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PayphoneCheckoutBox, { isPayphoneCheckoutConfigured } from '@/components/dashboard/PayphoneCheckoutBox';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageProvider';
import { PLANES, formatUsd, planParamToTipo } from '@/config/planes';

type MeAgent = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE';
  phoneVerifiedAt?: string | null;
};

export default function PagarSuscripcionPage() {
  return (
    <LanguageProvider>
      <Suspense fallback={<main className="min-h-screen bg-bg" />}>
        <PagarSuscripcionContent />
      </Suspense>
    </LanguageProvider>
  );
}

function PagarSuscripcionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const [agent, setAgent] = useState<MeAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const confirmAttempted = useRef(false);

  // Checkout dual (seccion 6): el plan viene por query param (?plan=basico|pro).
  const plan = planParamToTipo(searchParams.get('plan'));
  const confirmId = searchParams.get('id');
  const confirmTxId = searchParams.get('clientTransactionId');
  // Payphone redirige de vuelta a una URL fija configurada una vez en su
  // dashboard - no conserva nuestro ?plan=. Por eso, si venimos de un pago
  // (hay id+clientTransactionId), NO redirigimos a /planes aunque no haya
  // ?plan=: el plan se recupera server-side leyendo el clientTransactionId.
  const volviendoDePago = Boolean(confirmId && confirmTxId);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!plan && !volviendoDePago) {
      router.replace('/agentes/suscripcion/planes');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, volviendoDePago]);

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

  // Se confirma una sola vez (Payphone exige confirmar dentro de los primeros
  // 5 minutos, asi que esto corre apenas carga la pagina). El plan cobrado se
  // deriva server-side del clientTransactionId, no de este cliente.
  useEffect(() => {
    if (!volviendoDePago || confirmAttempted.current) return;
    confirmAttempted.current = true;
    setConfirming(true);
    fetch('/api/real-estate/billing/payphone/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(confirmId), clientTransactionId: confirmTxId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setConfirmError(data.error ?? t('suscripcion.pagar.errorConfirmacion'));
          return;
        }
        setConfirmed(true);
        setTimeout(() => {
          router.replace('/');
          router.refresh();
        }, 1800);
      })
      .catch(() => setConfirmError(t('suscripcion.pagar.errorConfirmacion')))
      .finally(() => setConfirming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volviendoDePago, confirmId, confirmTxId]);

  if (loading || !agent || (!plan && !volviendoDePago)) {
    return <main className="min-h-screen bg-bg" />;
  }

  const def = plan ? PLANES[plan] : null;
  const planNombre = plan === 'PRO' ? t('plan.pro.nombre') : t('plan.basico.nombre');

  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-10 text-text sm:py-16">
      <div className="mx-auto max-w-md">
        <section className="grain-overlay relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-md backdrop-blur-xl sm:p-7">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[var(--glow-brand)] blur-2xl" />

          <div className="relative z-10 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-3">{t('suscripcion.pagar.eyebrow')}</p>
              <h1 className="gradient-text mt-1 text-2xl font-bold leading-tight sm:text-3xl">{t('suscripcion.pagar.titulo')}</h1>
            </div>

            {def ? (
              // Resumen del plan elegido - un solo camino, sin alternativas de metodo de pago.
              <div className="rounded-2xl border border-line bg-surface-2 p-4">
                <div className="flex items-center justify-between text-sm text-text-2">
                  <span>{t('suscripcion.pagar.planLabel').replace('{plan}', planNombre)}</span>
                  <span>${formatUsd(def.precioBase)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-sm text-text-2">
                  <span>{t('suscripcion.pagar.ivaLabel')}</span>
                  <span>${formatUsd(def.impuesto)}</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5 text-base font-bold text-text">
                  <span>{t('suscripcion.pagar.totalLabel')}</span>
                  <span>${formatUsd(def.total)}</span>
                </div>
              </div>
            ) : null}

            {confirming ? (
              <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-text-2">{t('suscripcion.pagar.confirmando')}</p>
            ) : confirmed ? (
              <p className="rounded-xl border border-accent-line bg-accent-dim px-4 py-3 text-center text-sm font-semibold text-accent">{t('suscripcion.pagar.exito')}</p>
            ) : (
              <>
                {confirmError ? (
                  <p className="rounded-xl border border-danger bg-danger-dim px-4 py-3 text-center text-sm text-danger">{confirmError}</p>
                ) : null}

                {plan ? (
                  isPayphoneCheckoutConfigured() ? (
                    <PayphoneCheckoutBox
                      agentId={agent.id}
                      plan={plan}
                      email={agent.email}
                      phone={agent.phone}
                      idNumber={agent.idNumber}
                      lang={lang}
                    />
                  ) : (
                    <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-text-2">{t('suscripcion.pagar.noDisponible')}</p>
                  )
                ) : null}

                <p className="text-center text-[11.5px] text-text-3">{t('suscripcion.pagar.notaSeguridad')}</p>
                <p className="text-center text-[11.5px] text-text-3">
                  <Link href="/politica-cancelacion" className="underline decoration-dotted underline-offset-2 hover:text-text-2">
                    {t('suscripcion.pagar.politicaCancelacion')}
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

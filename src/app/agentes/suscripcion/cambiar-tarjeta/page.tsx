'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PayphoneCheckoutBox, { isPayphoneCheckoutConfigured } from '@/components/dashboard/PayphoneCheckoutBox';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageProvider';
import { formatUsd, type PlanTipo } from '@/config/planes';

type MeAgent = { id: string; email?: string | null; phone?: string | null; idNumber?: string | null; plan: PlanTipo };

export default function CambiarTarjetaPage() {
  return (
    <LanguageProvider>
      <Suspense fallback={<main className="min-h-screen bg-bg" />}>
        <CambiarTarjetaContent />
      </Suspense>
    </LanguageProvider>
  );
}

// Reemplaza la tarjeta guardada (seccion 7 del pedido de recurrencias):
// reabre la Cajita y tokeniza de nuevo. Si la suscripcion esta PAST_DUE, el
// cargo es el monto real que se debe (y de paso resuelve el atraso); si esta
// al dia, es un cargo nominal solo para validar la tarjeta nueva - en ambos
// casos /api/subscription/change-card decide el monto, esta pagina solo
// muestra lo que esa ruta devuelve.
function CambiarTarjetaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const [agent, setAgent] = useState<MeAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [prepared, setPrepared] = useState<{ clientTransactionId: string; amount: number; mode: string } | null>(null);

  const confirmId = searchParams.get('id');
  const confirmTxId = searchParams.get('clientTransactionId');
  const ctoken = searchParams.get('ctoken');
  const volviendoDePago = Boolean(confirmId && confirmTxId);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const confirmAttempted = useRef(false);

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

  useEffect(() => {
    if (!volviendoDePago || confirmAttempted.current) return;
    confirmAttempted.current = true;
    setConfirming(true);
    fetch('/api/real-estate/billing/payphone/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(confirmId), clientTransactionId: confirmTxId, ctoken: ctoken || undefined }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setConfirmError(data.error ?? (lang === 'es' ? 'No pudimos actualizar tu tarjeta.' : "We couldn't update your card."));
          return;
        }
        setConfirmed(true);
        setTimeout(() => {
          router.replace('/');
          router.refresh();
        }, 1800);
      })
      .catch(() => setConfirmError(lang === 'es' ? 'No pudimos actualizar tu tarjeta.' : "We couldn't update your card."))
      .finally(() => setConfirming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volviendoDePago, confirmId, confirmTxId, ctoken]);

  async function startChangeCard() {
    if (!consentAccepted) return;
    setStarting(true);
    setStartError('');
    try {
      const res = await fetch('/api/subscription/change-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentAccepted: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStartError(data.error ?? (lang === 'es' ? 'No se pudo iniciar el cambio de tarjeta.' : 'Could not start the card change.'));
        return;
      }
      setPrepared({ clientTransactionId: data.clientTransactionId, amount: data.amounts.amount, mode: data.mode });
    } catch {
      setStartError(lang === 'es' ? 'No se pudo iniciar el cambio de tarjeta.' : 'Could not start the card change.');
    } finally {
      setStarting(false);
    }
  }

  if (loading || !agent) {
    return <main className="min-h-screen bg-bg" />;
  }

  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-10 text-text sm:py-16">
      <div className="mx-auto max-w-md">
        <section className="grain-overlay relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-md backdrop-blur-xl sm:p-7">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[var(--glow-brand)] blur-2xl" />
          <div className="relative z-10 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-3">{t('cambiarTarjeta.eyebrow')}</p>
              <h1 className="gradient-text mt-1 text-2xl font-bold leading-tight sm:text-3xl">{t('cambiarTarjeta.titulo')}</h1>
            </div>

            {confirming ? (
              <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-text-2">{t('cambiarTarjeta.confirmando')}</p>
            ) : confirmed ? (
              <p className="rounded-xl border border-accent-line bg-accent-dim px-4 py-3 text-center text-sm font-semibold text-accent">{t('cambiarTarjeta.exito')}</p>
            ) : (
              <>
                {confirmError ? <p className="rounded-xl border border-danger bg-danger-dim px-4 py-3 text-center text-sm text-danger">{confirmError}</p> : null}

                {isPayphoneCheckoutConfigured() ? (
                  prepared ? (
                    <>
                      <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-text-2">
                        {prepared.mode === 'settle_past_due'
                          ? t('cambiarTarjeta.avisoCobroPendiente').replace('{monto}', formatUsd(prepared.amount))
                          : t('cambiarTarjeta.avisoCobroNominal').replace('{monto}', formatUsd(prepared.amount))}
                      </p>
                      <PayphoneCheckoutBox
                        agentId={agent.id}
                        plan={agent.plan}
                        email={agent.email}
                        phone={agent.phone}
                        idNumber={agent.idNumber}
                        lang={lang}
                        clientTransactionId={prepared.clientTransactionId}
                      />
                    </>
                  ) : (
                    <div className="space-y-3">
                      <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5 text-[12.5px] leading-snug text-text-2">
                        <input
                          type="checkbox"
                          checked={consentAccepted}
                          onChange={(e) => setConsentAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                        />
                        <span>{t('cambiarTarjeta.consentimiento')}</span>
                      </label>
                      {startError ? <p className="text-center text-xs text-danger">{startError}</p> : null}
                      <button
                        type="button"
                        disabled={!consentAccepted || starting}
                        onClick={() => void startChangeCard()}
                        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-contrast transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {starting ? t('cambiarTarjeta.preparando') : t('cambiarTarjeta.continuar')}
                      </button>
                    </div>
                  )
                ) : (
                  <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-text-2">{t('suscripcion.pagar.noDisponible')}</p>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

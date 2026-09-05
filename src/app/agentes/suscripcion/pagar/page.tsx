'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PayphoneCheckoutBox, { isPayphoneCheckoutConfigured } from '@/components/dashboard/PayphoneCheckoutBox';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageProvider';
import { getCheckoutAmountsInCents, formatUsd, planParamToTipo } from '@/config/planes';

type MeAgent = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE';
  phoneVerifiedAt?: string | null;
  precioFundadorBasico?: number | null;
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
  // Consentimiento de guardado de tarjeta (seccion 8 del pedido de
  // recurrencias): checkbox NO premarcado - hasta que el agente lo marque y
  // pulse "Continuar", no se llama a /api/subscription/checkout ni se
  // renderiza la Cajita. serverClientTransactionId llega de esa llamada.
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [serverClientTransactionId, setServerClientTransactionId] = useState<string | null>(null);

  // Checkout dual (seccion 6): el plan viene por query param (?plan=basico|pro).
  const plan = planParamToTipo(searchParams.get('plan'));
  const confirmId = searchParams.get('id');
  const confirmTxId = searchParams.get('clientTransactionId');
  // El ctoken (si Payphone ya nos autorizo la tokenizacion para esta tarjeta)
  // llega como query param en la URL de retorno, NO en la respuesta de
  // /api/confirm (seccion 3.3 del pedido de recurrencias) - se reenvia tal
  // cual al servidor, nunca se usa del lado del cliente.
  const ctoken = searchParams.get('ctoken');
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
      body: JSON.stringify({ id: Number(confirmId), clientTransactionId: confirmTxId, ctoken: ctoken || undefined }),
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
  }, [volviendoDePago, confirmId, confirmTxId, ctoken]);

  if (loading || !agent || (!plan && !volviendoDePago)) {
    return <main className="min-h-screen bg-bg" />;
  }

  async function startCheckout() {
    if (!plan || !consentAccepted) return;
    setStartingCheckout(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, consentAccepted: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCheckoutError(data.error ?? t('suscripcion.pagar.errorConfirmacion'));
        return;
      }
      setServerClientTransactionId(data.clientTransactionId as string);
    } catch {
      setCheckoutError(t('suscripcion.pagar.errorConfirmacion'));
    } finally {
      setStartingCheckout(false);
    }
  }

  // Precio fundador (Fase 7, seccion 9.4): solo aplica a Basico, y solo si el
  // agente ya tiene uno congelado Y no viene de CANCELED/INACTIVE (misma
  // regla que valida el server en /billing/payphone/confirm) - de lo
  // contrario se cobra el vigente, que pasara a ser su nuevo precio fundador.
  const esReactivacion = agent.subscriptionStatus === 'CANCELED' || agent.subscriptionStatus === 'INACTIVE';
  const founderTotalCents = plan === 'BASICO' && agent.precioFundadorBasico && !esReactivacion ? agent.precioFundadorBasico : null;
  const amounts = plan ? getCheckoutAmountsInCents(plan, founderTotalCents) : null;
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

            {amounts ? (
              // Resumen del plan elegido - un solo camino, sin alternativas de metodo de pago.
              <div className="rounded-2xl border border-line bg-surface-2 p-4">
                {founderTotalCents ? (
                  <span className="mb-3 inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-dim px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    {t('suscripcion.pagar.pillFundador')}
                  </span>
                ) : null}
                <div className="flex items-center justify-between text-sm text-text-2">
                  <span>{t('suscripcion.pagar.planLabel').replace('{plan}', planNombre)}</span>
                  <span>${formatUsd(amounts.amountWithTax)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-sm text-text-2">
                  <span>{t('suscripcion.pagar.ivaLabel')}</span>
                  <span>${formatUsd(amounts.tax)}</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5 text-base font-bold text-text">
                  <span>{t('suscripcion.pagar.totalLabel')}</span>
                  <span>${formatUsd(amounts.amount)}</span>
                </div>
                {plan === 'BASICO' ? <p className="mt-2.5 text-[11.5px] text-text-3">{t('suscripcion.pagar.notaFundador')}</p> : null}
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
                    serverClientTransactionId ? (
                      <PayphoneCheckoutBox
                        agentId={agent.id}
                        plan={plan}
                        email={agent.email}
                        phone={agent.phone}
                        idNumber={agent.idNumber}
                        founderTotalCents={founderTotalCents}
                        lang={lang}
                        clientTransactionId={serverClientTransactionId}
                      />
                    ) : (
                      <div className="space-y-3">
                        <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5 text-[12.5px] leading-snug text-text-2">
                          <input
                            type="checkbox"
                            checked={consentAccepted}
                            onChange={(e) => setConsentAccepted(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                          />
                          <span>
                            {lang === 'es'
                              ? 'Acepto que Redinmo.io guarde un identificador de mi tarjeta y me cobre automáticamente el monto de mi plan cada 30 días. Puedo cancelar cuando quiera desde mi cuenta.'
                              : 'I agree that Redinmo.io saves a token for my card and automatically charges my plan every 30 days. I can cancel anytime from my account.'}
                          </span>
                        </label>
                        {checkoutError ? <p className="text-center text-xs text-danger">{checkoutError}</p> : null}
                        <button
                          type="button"
                          disabled={!consentAccepted || startingCheckout}
                          onClick={() => void startCheckout()}
                          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-contrast transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {startingCheckout ? t('suscripcion.pagar.iniciandoPago') : (lang === 'es' ? 'Continuar al pago' : 'Continue to payment')}
                        </button>
                      </div>
                    )
                  ) : (
                    <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-text-2">{t('suscripcion.pagar.noDisponible')}</p>
                  )
                ) : null}

                <p className="text-center text-[11.5px] text-text-3">{t('suscripcion.pagar.notaSeguridad')}</p>
                <p className="text-center text-[11.5px] text-text-3">
                  <Link href="/legal/suscripcion" className="underline decoration-dotted underline-offset-2 hover:text-text-2">
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

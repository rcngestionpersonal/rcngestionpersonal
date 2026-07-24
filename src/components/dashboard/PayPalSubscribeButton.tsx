'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const PAYPAL_PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID;

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        style?: Record<string, string>;
        createSubscription: (
          data: unknown,
          actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } },
        ) => Promise<string>;
        onApprove: (data: { subscriptionID: string }) => void | Promise<void>;
        onError?: (err: unknown) => void;
      }) => { render: (container: HTMLElement) => void };
    };
  }
}

export function isPaypalButtonConfigured(): boolean {
  return Boolean(PAYPAL_CLIENT_ID && PAYPAL_PLAN_ID);
}

export default function PayPalSubscribeButton({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!sdkReady || rendered.current || !containerRef.current || !window.paypal || !PAYPAL_PLAN_ID) return;
    rendered.current = true;

    window.paypal.Buttons({
      style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'subscribe' },
      createSubscription: (_data, actions) => actions.subscription.create({ plan_id: PAYPAL_PLAN_ID }),
      onApprove: async (data) => {
        setStatus('processing');
        try {
          const res = await fetch('/api/real-estate/paypal/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: data.subscriptionID }),
          });
          if (!res.ok) throw new Error('confirm failed');
          setStatus('success');
          await onSuccess();
        } catch {
          setStatus('error');
        }
      },
      onError: () => setStatus('error'),
    }).render(containerRef.current);
  }, [sdkReady, onSuccess]);

  if (!PAYPAL_CLIENT_ID || !PAYPAL_PLAN_ID) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`}
        strategy="lazyOnload"
        onReady={() => setSdkReady(true)}
      />
      <div className="flex items-center gap-2">
        <span className="text-lg">🔒</span>
        <p className="text-sm font-semibold text-white">{t('paypal.tituloSeguro')}</p>
      </div>
      <p className="mt-1 text-xs text-[#9296b0]">{t('paypal.detalle')}</p>

      {status === 'success' ? (
        <p className="mt-4 rounded-xl bg-violet-400/10 px-3 py-2.5 text-sm font-semibold text-violet-300">
          ✓ {t('paypal.exito')}
        </p>
      ) : (
        <div className="mt-4 max-w-xs" ref={containerRef} />
      )}

      {status === 'processing' ? <p className="mt-2 text-xs text-[#9296b0]">{t('paypal.confirmando')}</p> : null}
      {status === 'error' ? <p className="mt-2 text-xs text-pink-300">{t('paypal.error')}</p> : null}

      <p className="mt-3 text-[10px] text-[#7d8099]">{t('paypal.cancelacion')}</p>
    </div>
  );
}

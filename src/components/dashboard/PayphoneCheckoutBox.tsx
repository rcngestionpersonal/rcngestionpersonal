'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { getCheckoutAmountsInCents } from '@/lib/real-estate/subscription-config';

// Integra la "Cajita de Pagos" de Payphone (https://docs.payphone.app/cajita-de-pagos):
// widget embebido que soporta tarjeta de credito/debito y saldo Payphone. El
// unico trabajo de este componente es renderizar el widget con los datos del
// agente - la confirmacion del pago pasa por /api/real-estate/billing/payphone/confirm
// cuando Payphone redirige de vuelta con ?id=...&clientTransactionId=...
// (ver PagarSuscripcionPage, que lee esos query params al montar).
declare global {
  interface Window {
    PPaymentButtonBox?: new (config: Record<string, unknown>) => { render: (containerId: string) => void };
  }
}

export function isPayphoneCheckoutConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PAYPHONE_TOKEN);
}

export default function PayphoneCheckoutBox({
  agentId,
  email,
  phone,
  idNumber,
  lang,
}: {
  agentId: string;
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
  lang: 'es' | 'en';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initedRef = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sdkReady || initedRef.current) return;
    const token = process.env.NEXT_PUBLIC_PAYPHONE_TOKEN;
    if (!token || !window.PPaymentButtonBox || !containerRef.current) return;

    try {
      // clientTransactionId lleva el agentId adentro (ver payments/payphone.ts)
      // para poder identificar al agente al volver de Payphone sin depender de
      // una tabla de transacciones pendientes aparte.
      const clientTransactionId = `${agentId}::${Date.now()}`;
      const storeId = process.env.NEXT_PUBLIC_PAYPHONE_STORE_ID;
      const amounts = getCheckoutAmountsInCents();

      const config: Record<string, unknown> = {
        token,
        clientTransactionId,
        ...amounts,
        currency: 'USD',
        reference: lang === 'es' ? 'Suscripción mensual Redinmo' : 'Redinmo monthly subscription',
        lang,
        defaultMethod: 'card',
      };
      if (storeId) config.storeId = storeId;
      if (phone) config.phoneNumber = phone;
      if (email) config.email = email;
      if (idNumber) {
        config.documentId = idNumber;
        config.identificationType = 1; // 1 = cedula
      }

      const box = new window.PPaymentButtonBox(config);
      box.render('pp-checkout-box');
      initedRef.current = true;
    } catch {
      setError(lang === 'es' ? 'No se pudo cargar el formulario de pago. Recarga la página.' : 'Could not load the payment form. Reload the page.');
    }
  }, [sdkReady, agentId, email, phone, idNumber, lang]);

  return (
    <div>
      <link rel="stylesheet" href="https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css" />
      <Script
        type="module"
        src="https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
      />
      <div id="pp-checkout-box" ref={containerRef} className="min-h-[220px]" />
      {error ? <p className="mt-2 text-center text-xs text-danger">{error}</p> : null}
    </div>
  );
}

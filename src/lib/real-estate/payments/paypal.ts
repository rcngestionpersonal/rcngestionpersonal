// Adaptador de PayPal - INACTIVO por diseno.
//
// Redinmo opera hoy exclusivamente en Ecuador, donde PayPal no es el metodo de
// pago preferido ni el mas confiable para cobros recurrentes locales; por eso
// el selector de proveedor (subscription-config.ts) siempre devuelve
// 'PAYPHONE'. Este adaptador NO se borra: se reactivara el dia que Redinmo
// empiece a operar agentes fuera de Ecuador (donde PayPal si tiene sentido
// como opcion de cobro). Hasta entonces, ninguna pantalla debe importar ni
// renderizar nada de este archivo - solo queda disponible para ese futuro.
import { getAppUrl } from '../subscription-config';

function getPaypalBaseUrl(): string {
  return process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_PLAN_ID);
}

async function getPaypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal no esta configurado.');
  }

  const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`No se pudo autenticar con PayPal: ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function createPaypalSubscription(agent: {
  id: string;
  fullName: string;
  email?: string | null;
}): Promise<{ subscriptionId: string; approveUrl: string | null }> {
  const planId = process.env.PAYPAL_PLAN_ID;
  if (!planId) {
    throw new Error('PAYPAL_PLAN_ID no esta configurado.');
  }

  const accessToken = await getPaypalAccessToken();
  const appUrl = getAppUrl();

  const response = await fetch(`${getPaypalBaseUrl()}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `redinmo-${agent.id}-${Date.now()}`,
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: agent.id,
      subscriber: {
        name: { given_name: agent.fullName },
        email_address: agent.email ?? undefined,
      },
      application_context: {
        brand_name: 'Redinmo.io',
        return_url: `${appUrl}/?billing=success`,
        cancel_url: `${appUrl}/?billing=cancel`,
        user_action: 'SUBSCRIBE_NOW',
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`No se pudo crear la suscripcion de PayPal: ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as { id: string; links?: Array<{ rel: string; href: string }> };
  const approveUrl = data.links?.find((link) => link.rel === 'approve')?.href ?? null;

  return { subscriptionId: data.id, approveUrl };
}

export async function verifyPaypalWebhookSignature(
  headers: Headers,
  body: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  try {
    const accessToken = await getPaypalAccessToken();
    const response = await fetch(`${getPaypalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transmission_id: headers.get('paypal-transmission-id'),
        transmission_time: headers.get('paypal-transmission-time'),
        cert_url: headers.get('paypal-cert-url'),
        auth_algo: headers.get('paypal-auth-algo'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    });

    if (!response.ok) return false;
    const data = (await response.json()) as { verification_status?: string };
    return data.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}

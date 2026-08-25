// Adaptador de Payphone - proveedor de pago activo (unico mercado: Ecuador).
//
// Integra la "Cajita de Pagos" (widget embebido, tarjeta + saldo Payphone) via
// https://docs.payphone.app/cajita-de-pagos. El widget en si corre 100% en el
// cliente (PayphoneCheckoutBox.tsx); este modulo solo cubre la parte
// server-side: confirmar la transaccion contra la API de Payphone despues de
// que el usuario vuelve del pago, y los helpers para armar/leer el
// clientTransactionId que identifica a que agente pertenece cada pago.
import { getCheckoutAmountsInCents } from '../subscription-config';

const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

export function isPayphoneConfigured(): boolean {
  return Boolean(process.env.PAYPHONE_TOKEN && process.env.NEXT_PUBLIC_PAYPHONE_TOKEN);
}

// El clientTransactionId es el unico dato que Payphone nos devuelve intacto al
// confirmar - codificamos el agentId adentro (en vez de mantener una tabla
// aparte) para saber a quien activar sin depender de una consulta extra.
export function buildClientTransactionId(agentId: string): string {
  return `${agentId}::${Date.now()}`;
}

export function parseAgentIdFromClientTransactionId(clientTransactionId: string): string | null {
  const [agentId] = clientTransactionId.split('::');
  return agentId || null;
}

export type PayphoneConfirmResult = {
  transactionStatus: 'Approved' | 'Canceled' | 'Pending' | string;
  statusCode: number;
  authorizationCode?: string;
  transactionId: number;
  clientTransactionId: string;
  amount: number;
  email?: string;
  cardBrand?: string;
  currency?: string;
};

// Debe ejecutarse dentro de los primeros 5 minutos tras el pago - pasado ese
// tiempo Payphone revierte la transaccion automaticamente (ver docs).
export async function confirmPayphoneTransaction(input: { id: number; clientTransactionId: string }): Promise<PayphoneConfirmResult> {
  const token = process.env.PAYPHONE_TOKEN;
  if (!token) {
    throw new Error('PAYPHONE_TOKEN no esta configurado.');
  }

  const response = await fetch(PAYPHONE_CONFIRM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: input.id, clientTxId: input.clientTransactionId }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`No se pudo confirmar el pago con Payphone: ${detail.slice(0, 300)}`);
  }

  return (await response.json()) as PayphoneConfirmResult;
}

// Verifica que lo efectivamente cobrado coincida con el precio vigente del
// plan - una defensa simple contra una respuesta de Payphone manipulada o
// desactualizada antes de activar la suscripcion.
export function isExpectedCheckoutAmount(amountCents: number): boolean {
  return amountCents === getCheckoutAmountsInCents().amount;
}

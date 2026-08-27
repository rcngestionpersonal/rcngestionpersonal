// Adaptador de Payphone - proveedor de pago activo (unico mercado: Ecuador).
//
// Integra la "Cajita de Pagos" (widget embebido, tarjeta + saldo Payphone) via
// https://docs.payphone.app/cajita-de-pagos. El widget en si corre 100% en el
// cliente (PayphoneCheckoutBox.tsx); este modulo solo cubre la parte
// server-side: confirmar la transaccion contra la API de Payphone despues de
// que el usuario vuelve del pago, y los helpers para armar/leer el
// clientTransactionId que identifica a que agente pertenece cada pago.
import { getCheckoutAmountsInCents, isPlanTipo, type PlanTipo } from '@/config/planes';

const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

export function isPayphoneConfigured(): boolean {
  return Boolean(process.env.PAYPHONE_TOKEN && process.env.NEXT_PUBLIC_PAYPHONE_TOKEN);
}

// El clientTransactionId es el unico dato que Payphone nos devuelve intacto al
// confirmar - codificamos adentro tanto el agentId como el plan elegido (en
// vez de mantener una tabla aparte). Esto importa especialmente para el plan:
// la URL a la que Payphone redirige de vuelta se configura una vez en su
// dashboard (no por request), asi que un ?plan= en la URL de checkout NO
// sobrevive el viaje de ida y vuelta - el clientTransactionId si.
export function buildClientTransactionId(agentId: string, plan: PlanTipo): string {
  return `${agentId}::${plan}::${Date.now()}`;
}

export function parseAgentIdFromClientTransactionId(clientTransactionId: string): string | null {
  const [agentId] = clientTransactionId.split('::');
  return agentId || null;
}

export function parsePlanFromClientTransactionId(clientTransactionId: string): PlanTipo | null {
  const [, plan] = clientTransactionId.split('::');
  return isPlanTipo(plan) ? plan : null;
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

// Verifica que lo efectivamente cobrado coincida con el precio esperado del
// plan elegido - una defensa simple contra una respuesta de Payphone
// manipulada o desactualizada antes de activar la suscripcion. `founderTotalCents`
// (Fase 7, seccion 9.4) permite aceptar el precio fundador congelado del
// agente como alternativa valida al precio vigente, solo para Basico.
export function isExpectedCheckoutAmount(amountCents: number, plan: PlanTipo, founderTotalCents?: number | null): boolean {
  return amountCents === getCheckoutAmountsInCents(plan, founderTotalCents).amount;
}

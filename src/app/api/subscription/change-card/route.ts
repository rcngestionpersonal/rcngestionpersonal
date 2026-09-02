import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { buildCardChangeClientTransactionId, buildClientTransactionId } from '@/lib/real-estate/payments/payphone';
import { CARD_UPDATE_MIN_CENTS } from '@/lib/real-estate/subscription-config';
import { getCheckoutAmountsInCents } from '@/config/planes';

export const runtime = 'nodejs';

const CONSENT_TEXT =
  'Autorizo a Redinmo a guardar un identificador de mi nueva tarjeta y a cobrarme automáticamente el monto de mi plan cada 30 días mientras la suscripción esté activa. Puedo cancelar cuando quiera desde mi cuenta.';

function getRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

// Prepara el reemplazo de tarjeta (seccion 7 del pedido: "Cambiar tarjeta:
// reabre la Cajita, tokeniza de nuevo y reemplaza el metodo de pago. Cobra
// el monto del periodo pendiente si esta en PAST_DUE; si esta al dia, usa el
// monto minimo que Payphone permita para generar el token nuevo").
//
// PAST_DUE usa el MISMO formato de clientTransactionId que un cobro normal
// (agentId::plan::timestamp) a proposito: cobrar lo que se debe Y reemplazar
// la tarjeta en el mismo paso es, en los hechos, un pago de plan comun -
// /billing/payphone/confirm lo procesa sin ninguna rama especial y de paso
// resuelve el PAST_DUE. Solo el caso "al dia" (monto nominal) necesita el
// marcador CARDCHANGE, porque ese monto NUNCA coincide con el precio de un
// plan.
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { consentAccepted?: boolean } | null;
  if (body?.consentAccepted !== true) {
    return NextResponse.json({ error: 'Debes aceptar el guardado de la tarjeta para continuar.' }, { status: 400 });
  }

  if (shouldUseMockStore()) {
    return NextResponse.json({ error: 'Cambiar tarjeta no está disponible en modo demo.' }, { status: 400 });
  }

  try {
    const sub = await prisma.subscription.findUnique({ where: { agentId: session.agentId } });
    if (!sub) {
      return NextResponse.json({ error: 'No tienes una suscripción para actualizar.' }, { status: 400 });
    }

    if (sub.status === 'PAST_DUE') {
      const founderTotalCents = sub.priceLocked ? sub.amountCents + sub.taxCents : null;
      const amounts = getCheckoutAmountsInCents(sub.plan, founderTotalCents);
      const clientTransactionId = buildClientTransactionId(session.agentId, sub.plan);
      await prisma.subscriptionEvent.create({
        data: { subscriptionId: sub.id, type: 'consent_recorded', payload: { text: CONSENT_TEXT, ip: getRequestIp(request), acceptedAt: new Date().toISOString() } },
      });
      return NextResponse.json({ clientTransactionId, amounts, mode: 'settle_past_due' });
    }

    const amounts = { amount: CARD_UPDATE_MIN_CENTS, amountWithoutTax: 0, amountWithTax: CARD_UPDATE_MIN_CENTS, tax: 0, service: 0, tip: 0 };
    const clientTransactionId = buildCardChangeClientTransactionId(session.agentId);
    await prisma.subscriptionEvent.create({
      data: { subscriptionId: sub.id, type: 'consent_recorded', payload: { text: CONSENT_TEXT, ip: getRequestIp(request), acceptedAt: new Date().toISOString() } },
    });
    return NextResponse.json({ clientTransactionId, amounts, mode: 'nominal_retokenize' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo iniciar el cambio de tarjeta.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

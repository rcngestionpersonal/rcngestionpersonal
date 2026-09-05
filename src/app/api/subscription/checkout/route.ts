import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { buildClientTransactionId } from '@/lib/real-estate/payments/payphone';
import { getCheckoutAmountsInCents, getCheckoutReference, isPlanTipo, type PlanTipo } from '@/config/planes';

export const runtime = 'nodejs';

// Texto exacto del consentimiento (seccion 8 del pedido de recurrencias) - se
// guarda tal cual junto con el momento y la IP en el evento
// "consent_recorded", para poder mostrar despues que fue lo que el agente
// acepto (no solo que acepto algo). Cambiar esta constante en el futuro no
// reescribe el historico: cada SubscriptionEvent conserva la version vigente
// al momento de aceptar.
const CONSENT_TEXT =
  'Autorizo a Redinmo.io a guardar un identificador de mi tarjeta y a cobrarme automáticamente el monto de mi plan cada 30 días mientras la suscripción esté activa. Puedo cancelar cuando quiera desde mi cuenta.';

function getRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

// Primer paso del Flujo A (seccion 3, punto 1): genera el clientTransactionId
// que se le va a pasar a la Cajita, deja un Charge PENDING reservando ese
// intento del periodo, y registra el consentimiento de guardado de tarjeta
// ANTES de que el agente vea el formulario de pago (nunca despues) - seccion
// 8: "checkbox no premarcado... antes de guardar la tarjeta".
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { plan?: string; consentAccepted?: boolean } | null;
  if (!body || !isPlanTipo(body.plan)) {
    return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
  }
  if (body.consentAccepted !== true) {
    return NextResponse.json({ error: 'Debes aceptar el guardado de la tarjeta para continuar.' }, { status: 400 });
  }

  const plan = body.plan as PlanTipo;
  const clientTransactionId = buildClientTransactionId(session.agentId, plan);

  // Modo mock (desarrollo local, sin DB real): el flujo de confirmacion mock
  // en billing/payphone/confirm/route.ts ya activa la cuenta sin depender de
  // Subscription/Charge - alcanza con devolver los parametros de la Cajita.
  if (shouldUseMockStore()) {
    const amounts = getCheckoutAmountsInCents(plan, null);
    return NextResponse.json({ clientTransactionId, amounts, reference: getCheckoutReference(plan, 'es') });
  }

  try {
    const agent = await prisma.agent.findUnique({
      where: { id: session.agentId },
      select: { subscriptionStatus: true, precioFundadorBasico: true },
    });
    if (!agent) {
      return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    }

    const esReactivacion = agent.subscriptionStatus === 'CANCELED' || agent.subscriptionStatus === 'INACTIVE';
    const founderTotalCents = plan === 'BASICO' && agent.precioFundadorBasico && !esReactivacion ? agent.precioFundadorBasico : null;
    const amounts = getCheckoutAmountsInCents(plan, founderTotalCents);
    const priceLocked = plan === 'BASICO' && founderTotalCents !== null;

    const subscription = await prisma.subscription.upsert({
      where: { agentId: session.agentId },
      create: {
        agentId: session.agentId,
        plan,
        status: 'TRIAL',
        amountCents: amounts.amountWithTax,
        taxCents: amounts.tax,
        priceLocked,
      },
      update: {
        plan,
        amountCents: amounts.amountWithTax,
        taxCents: amounts.tax,
        priceLocked,
      },
    });

    const periodKey = new Date().toISOString().slice(0, 7); // "2026-09"
    // Reintento de checkout dentro del mismo periodo (el agente abandono la
    // Cajita y volvio a intentar, o ya tiene un intento aprobado este mes y
    // esta reactivando) - se reserva el siguiente numero de intento libre en
    // vez de chocar con la restriccion unica [subscriptionId, periodKey, attempt].
    const ultimoIntento = await prisma.charge.findFirst({
      where: { subscriptionId: subscription.id, periodKey },
      orderBy: { attempt: 'desc' },
      select: { attempt: true },
    });
    const attempt = (ultimoIntento?.attempt ?? 0) + 1;

    await prisma.charge.create({
      data: {
        subscriptionId: subscription.id,
        periodKey,
        attempt,
        clientTransactionId,
        amountCents: amounts.amount,
        status: 'PENDING',
      },
    });

    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: 'consent_recorded',
        payload: { text: CONSENT_TEXT, ip: getRequestIp(request), acceptedAt: new Date().toISOString() },
      },
    });

    return NextResponse.json({ clientTransactionId, amounts, reference: getCheckoutReference(plan, 'es') });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo iniciar el pago.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

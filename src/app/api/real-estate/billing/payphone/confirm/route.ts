import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logSubscriptionActivation } from '@/lib/real-estate/churn';
import { findAgentById, shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';
import {
  confirmPayphoneTransaction,
  isExpectedCheckoutAmount,
  parseAgentIdFromClientTransactionId,
  parsePlanFromClientTransactionId,
} from '@/lib/real-estate/payments/payphone';
import { getBillingCycleMs } from '@/lib/real-estate/subscription-config';
import { getCheckoutAmountsInCents } from '@/config/planes';

// Confirma un pago de la Cajita de Payphone. El agente vuelve del pago con
// ?id=...&clientTransactionId=... en la URL; esta ruta hace la llamada
// server-side a Payphone (nunca confiamos en el estado que el cliente diga
// que tuvo el pago) y solo si Payphone responde "Approved" activa la cuenta.
// El plan cobrado se lee del propio clientTransactionId (no de lo que mande
// el cliente en el body): es el unico dato que sobrevive intacto el viaje de
// ida y vuelta a Payphone.
export async function POST(request: NextRequest) {
  try {
    const authSession = await getSessionFromRequest(request);
    if (!authSession || authSession.role !== 'agent' || !authSession.agentId) {
      return NextResponse.json({ error: 'Solo agentes autenticados pueden confirmar su pago.' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { id?: number; clientTransactionId?: string } | null;
    if (!body?.id || !body.clientTransactionId) {
      return NextResponse.json({ error: 'id y clientTransactionId son obligatorios.' }, { status: 400 });
    }

    // El clientTransactionId debe corresponder al agente de la sesion - evita
    // que un agente confirme (y active) el pago de otro.
    const ownerAgentId = parseAgentIdFromClientTransactionId(body.clientTransactionId);
    if (ownerAgentId !== authSession.agentId) {
      return NextResponse.json({ error: 'Esta transacción no corresponde a tu cuenta.' }, { status: 403 });
    }
    const plan = parsePlanFromClientTransactionId(body.clientTransactionId);
    if (!plan) {
      return NextResponse.json({ error: 'No se pudo determinar el plan de esta transacción.' }, { status: 400 });
    }

    if (shouldUseMockStore()) {
      // Sin credenciales reales de Payphone en modo mock: se simula un pago
      // aprobado para poder probar el flujo completo sin cobrar de verdad.
      const agent = findAgentById(authSession.agentId);
      if (agent?.payphoneTransactionId === String(body.id)) {
        // Idempotencia: mismo id de transaccion ya procesado (p.ej. el agente
        // recargo la pagina de retorno) - no volver a extender el periodo.
        return NextResponse.json({ success: true, fallback: true, alreadyProcessed: true });
      }
      const paidUntil = new Date(Date.now() + getBillingCycleMs()).toISOString();
      updateAgent(authSession.agentId, {
        subscriptionStatus: 'ACTIVE',
        subscriptionPaidUntil: paidUntil,
        lastPaymentProvider: 'PAYPHONE',
        payphoneTransactionId: String(body.id),
        plan,
        planDesde: new Date().toISOString(),
        planSiguiente: undefined,
      });
      return NextResponse.json({ success: true, fallback: true });
    }

    const result = await confirmPayphoneTransaction({ id: body.id, clientTransactionId: body.clientTransactionId });

    if (result.transactionStatus !== 'Approved') {
      return NextResponse.json({ error: 'El pago no fue aprobado por Payphone.', status: result.transactionStatus }, { status: 402 });
    }
    if (!isExpectedCheckoutAmount(result.amount, plan)) {
      return NextResponse.json({ error: 'El monto confirmado no coincide con el precio del plan.' }, { status: 400 });
    }

    // Idempotencia: si ya existe una Transaccion para este id de Payphone, el
    // pago ya fue procesado - no volver a extender el periodo ni duplicar el
    // registro (seccion 6.5 del pedido de arquitectura de planes).
    const yaRegistrada = await prisma.transaccion.findFirst({
      where: { agentId: authSession.agentId, providerTransactionId: String(result.transactionId) },
    });
    if (yaRegistrada) {
      return NextResponse.json({ success: true, authorizationCode: result.authorizationCode, alreadyProcessed: true });
    }

    const paidUntil = new Date(Date.now() + getBillingCycleMs());
    const amounts = getCheckoutAmountsInCents(plan);
    try {
      await prisma.$transaction([
        prisma.agent.update({
          where: { id: authSession.agentId },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionPaidUntil: paidUntil,
            lastPaymentProvider: 'PAYPHONE',
            payphoneTransactionId: String(result.transactionId),
            plan,
            planDesde: new Date(),
            planSiguiente: null,
          },
        }),
        prisma.transaccion.create({
          data: {
            agentId: authSession.agentId,
            plan,
            provider: 'PAYPHONE',
            amountCents: amounts.amountWithTax,
            taxCents: amounts.tax,
            totalCents: amounts.amount,
            providerTransactionId: String(result.transactionId),
            authorizationCode: result.authorizationCode,
          },
        }),
      ]);
      await logSubscriptionActivation(authSession.agentId);
    } catch {
      updateAgent(authSession.agentId, {
        subscriptionStatus: 'ACTIVE',
        subscriptionPaidUntil: paidUntil.toISOString(),
        lastPaymentProvider: 'PAYPHONE',
        payphoneTransactionId: String(result.transactionId),
        plan,
        planDesde: new Date().toISOString(),
        planSiguiente: undefined,
      });
    }

    return NextResponse.json({ success: true, authorizationCode: result.authorizationCode });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo confirmar el pago.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

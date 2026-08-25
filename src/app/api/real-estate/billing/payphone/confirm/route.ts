import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logSubscriptionActivation } from '@/lib/real-estate/churn';
import { shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';
import { confirmPayphoneTransaction, isExpectedCheckoutAmount, parseAgentIdFromClientTransactionId } from '@/lib/real-estate/payments/payphone';
import { getBillingCycleMs } from '@/lib/real-estate/subscription-config';

// Confirma un pago de la Cajita de Payphone. El agente vuelve del pago con
// ?id=...&clientTransactionId=... en la URL; esta ruta hace la llamada
// server-side a Payphone (nunca confiamos en el estado que el cliente diga
// que tuvo el pago) y solo si Payphone responde "Approved" activa la cuenta.
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

    if (shouldUseMockStore()) {
      // Sin credenciales reales de Payphone en modo mock: se simula un pago
      // aprobado para poder probar el flujo completo sin cobrar de verdad.
      const paidUntil = new Date(Date.now() + getBillingCycleMs()).toISOString();
      updateAgent(authSession.agentId, {
        subscriptionStatus: 'ACTIVE',
        subscriptionPaidUntil: paidUntil,
        lastPaymentProvider: 'PAYPHONE',
        payphoneTransactionId: String(body.id),
      });
      return NextResponse.json({ success: true, fallback: true });
    }

    const result = await confirmPayphoneTransaction({ id: body.id, clientTransactionId: body.clientTransactionId });

    if (result.transactionStatus !== 'Approved') {
      return NextResponse.json({ error: 'El pago no fue aprobado por Payphone.', status: result.transactionStatus }, { status: 402 });
    }
    if (!isExpectedCheckoutAmount(result.amount)) {
      return NextResponse.json({ error: 'El monto confirmado no coincide con el precio del plan.' }, { status: 400 });
    }

    const paidUntil = new Date(Date.now() + getBillingCycleMs());
    try {
      await prisma.agent.update({
        where: { id: authSession.agentId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionPaidUntil: paidUntil,
          lastPaymentProvider: 'PAYPHONE',
          payphoneTransactionId: String(result.transactionId),
        },
      });
      await logSubscriptionActivation(authSession.agentId);
    } catch {
      updateAgent(authSession.agentId, {
        subscriptionStatus: 'ACTIVE',
        subscriptionPaidUntil: paidUntil.toISOString(),
        lastPaymentProvider: 'PAYPHONE',
        payphoneTransactionId: String(result.transactionId),
      });
    }

    return NextResponse.json({ success: true, authorizationCode: result.authorizationCode });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo confirmar el pago.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { activateSubscription, shouldUseMockStore } from '@/lib/real-estate/mock-store';

const PLAN_PRICE_USD = 8.99;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { agentId?: string; paymentOk?: boolean };

    if (!body.agentId) {
      return NextResponse.json({ error: 'agentId es obligatorio.' }, { status: 400 });
    }

    if (!body.paymentOk) {
      return NextResponse.json(
        {
          success: false,
          message: `Pago no confirmado. Mantener en trial o restringir acceso al plan de USD ${PLAN_PRICE_USD}.`,
        },
        { status: 402 },
      );
    }

    if (shouldUseMockStore()) {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const agent = activateSubscription(body.agentId);
      if (!agent) {
        return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        amount: PLAN_PRICE_USD,
        currency: 'USD',
        nextBillingDate: periodEnd,
        agent,
        fallback: true,
      });
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    let agent;
    try {
      agent = await prisma.agent.update({
        where: { id: body.agentId },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
        },
      });

      await prisma.eventLog.create({
        data: {
          entityType: 'agent',
          entityId: agent.id,
          eventType: 'subscription_activated',
          payload: {
            amount: PLAN_PRICE_USD,
            currency: 'USD',
            periodEnd,
          },
        },
      });
    } catch {
      agent = activateSubscription(body.agentId);
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      amount: PLAN_PRICE_USD,
      currency: 'USD',
      nextBillingDate: periodEnd,
      agent,
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo activar la suscripción.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logSubscriptionActivation } from '@/lib/real-estate/churn';
import { shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';

export async function POST(request: NextRequest) {
  try {
    const authSession = await getSessionFromRequest(request);
    if (!authSession || authSession.role !== 'agent' || !authSession.agentId) {
      return NextResponse.json({ error: 'Solo agentes autenticados pueden confirmar su suscripción.' }, { status: 403 });
    }

    const body = (await request.json()) as { subscriptionId?: string };
    if (!body.subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId es obligatorio.' }, { status: 400 });
    }

    if (shouldUseMockStore()) {
      updateAgent(authSession.agentId, { subscriptionStatus: 'ACTIVE', paypalSubscriptionId: body.subscriptionId });
      return NextResponse.json({ success: true, fallback: true });
    }

    try {
      await prisma.agent.update({
        where: { id: authSession.agentId },
        data: { subscriptionStatus: 'ACTIVE', paypalSubscriptionId: body.subscriptionId },
      });
      await logSubscriptionActivation(authSession.agentId);
    } catch {
      updateAgent(authSession.agentId, { subscriptionStatus: 'ACTIVE', paypalSubscriptionId: body.subscriptionId });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo confirmar la suscripción.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

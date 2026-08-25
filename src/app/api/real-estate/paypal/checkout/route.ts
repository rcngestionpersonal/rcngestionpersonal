import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { activateSubscription, findAgentById, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { createPaypalSubscription, isPaypalConfigured } from '@/lib/real-estate/payments/paypal';

export async function POST(request: NextRequest) {
  try {
    const authSession = await getSessionFromRequest(request);
    if (!authSession) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const body = (await request.json()) as { agentId?: string };
    if (!body.agentId) {
      return NextResponse.json({ error: 'agentId es obligatorio.' }, { status: 400 });
    }

    if (authSession.role === 'agent' && authSession.agentId !== body.agentId) {
      return NextResponse.json({ error: 'Un agente solo puede activar su propia suscripción.' }, { status: 403 });
    }

    if (shouldUseMockStore() || !isPaypalConfigured()) {
      const agent = activateSubscription(body.agentId);
      if (!agent) {
        return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
      }
      return NextResponse.json({
        mode: 'mock',
        success: true,
        message: 'Suscripcion activada en modo demo.',
      });
    }

    let agent: { id: string; fullName: string; email: string | null } | null = null;
    try {
      const dbAgent = await prisma.agent.findUnique({ where: { id: body.agentId } });
      if (!dbAgent) {
        return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
      }
      agent = { id: dbAgent.id, fullName: dbAgent.fullName, email: dbAgent.email };
    } catch {
      const localAgent = findAgentById(body.agentId);
      if (!localAgent) {
        return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
      }
      agent = { id: localAgent.id, fullName: localAgent.fullName, email: localAgent.email ?? null };
    }

    const { subscriptionId, approveUrl } = await createPaypalSubscription(agent);

    return NextResponse.json({
      mode: 'paypal',
      subscriptionId,
      url: approveUrl,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo crear el checkout de PayPal.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

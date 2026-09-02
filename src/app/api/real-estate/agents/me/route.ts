import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAgentById, sanitizeAgent, shouldUseMockStore } from '@/lib/real-estate/mock-store';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados.' }, { status: 403 });
  }

  if (shouldUseMockStore()) {
    const agent = findAgentById(session.agentId);
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    return NextResponse.json({ agent: sanitizeAgent(agent), fallback: true });
  }

  try {
    const agent = await prisma.agent.findUnique({ where: { id: session.agentId } });
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    // Tarjeta guardada del motor de recurrencias (seccion 7 del pedido:
    // "mostrada solo como marca y ultimos 4 digitos") - nunca el cardTokenEnc
    // ni cardHolderEnc. subscriptionStatus se expone tal cual (no INACTIVE
    // vs EXPIRED, son el mismo valor) para que la UI decida el mensaje.
    const subscription = await prisma.subscription.findUnique({
      where: { agentId: session.agentId },
      select: { status: true, cancelAtPeriodEnd: true, paymentMethod: { select: { brand: true, lastDigits: true, active: true } } },
    });
    const paymentMethod = subscription?.paymentMethod?.active ? { brand: subscription.paymentMethod.brand, lastDigits: subscription.paymentMethod.lastDigits } : null;
    return NextResponse.json({
      agent: sanitizeAgent(agent),
      paymentMethod,
      subscriptionEngine: subscription ? { status: subscription.status, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd } : null,
    });
  } catch {
    const agent = findAgentById(session.agentId);
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    return NextResponse.json({ agent: sanitizeAgent(agent), fallback: true });
  }
}

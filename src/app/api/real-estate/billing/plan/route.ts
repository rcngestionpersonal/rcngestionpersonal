import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAgentById, shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';
import { resolveEffectiveSubscriptionStatus } from '@/lib/real-estate/subscription-status';
import { isPlanTipo } from '@/config/planes';

// Programa un cambio de plan (upgrade o downgrade) para la PROXIMA renovacion
// - nunca prorratea ni cobra de inmediato (seccion 7 del pedido de
// arquitectura de planes). El caso "aplica de inmediato" (trial o vencida)
// no pasa por aqui: ese es el checkout normal en /agentes/suscripcion/pagar,
// que ya activa el plan elegido al confirmar el pago.
export async function POST(request: NextRequest) {
  try {
    const authSession = await getSessionFromRequest(request);
    if (!authSession || authSession.role !== 'agent' || !authSession.agentId) {
      return NextResponse.json({ error: 'Solo agentes autenticados pueden cambiar de plan.' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { plan?: string } | null;
    if (!body?.plan || !isPlanTipo(body.plan)) {
      return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
    }
    const nuevoPlan = body.plan;

    if (shouldUseMockStore()) {
      const agent = findAgentById(authSession.agentId);
      if (!agent) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
      if (resolveEffectiveSubscriptionStatus(agent) !== 'ACTIVE') {
        return NextResponse.json({ error: 'Debes tener una suscripción activa para cambiar de plan.' }, { status: 400 });
      }
      const planSiguiente = nuevoPlan === agent.plan ? undefined : nuevoPlan;
      const updated = updateAgent(authSession.agentId, { planSiguiente });
      return NextResponse.json({ success: true, planSiguiente: planSiguiente ?? null, effectiveAt: agent.subscriptionPaidUntil ?? null, agent: updated });
    }

    const agent = await prisma.agent.findUnique({ where: { id: authSession.agentId } });
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    if (resolveEffectiveSubscriptionStatus(agent) !== 'ACTIVE') {
      return NextResponse.json({ error: 'Debes tener una suscripción activa para cambiar de plan.' }, { status: 400 });
    }
    const planSiguiente = nuevoPlan === agent.plan ? null : nuevoPlan;
    const updated = await prisma.agent.update({ where: { id: authSession.agentId }, data: { planSiguiente } });
    return NextResponse.json({ success: true, planSiguiente, effectiveAt: agent.subscriptionPaidUntil, agent: updated });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo cambiar el plan.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logSubscriptionCancellation } from '@/lib/real-estate/churn';
import { findAgentById, sanitizeAgent, shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';
import { resolveEffectiveSubscriptionStatus } from '@/lib/real-estate/subscription-status';

// Cancela la suscripcion: deja de renovarse, pero el acceso se mantiene hasta
// el final del periodo ya pagado (subscriptionPaidUntil) - ver el ajuste en
// resolveEffectiveSubscriptionStatus que trata CANCELED+aun-pagado como
// acceso activo. No hay reembolso ni corte inmediato.
export async function POST(request: NextRequest) {
  try {
    const authSession = await getSessionFromRequest(request);
    if (!authSession || authSession.role !== 'agent' || !authSession.agentId) {
      return NextResponse.json({ error: 'Solo agentes autenticados pueden cancelar su suscripción.' }, { status: 403 });
    }

    if (shouldUseMockStore()) {
      const agent = findAgentById(authSession.agentId);
      if (!agent || resolveEffectiveSubscriptionStatus(agent) !== 'ACTIVE') {
        return NextResponse.json({ error: 'No tienes una suscripción activa para cancelar.' }, { status: 400 });
      }
      const updated = updateAgent(authSession.agentId, { subscriptionStatus: 'CANCELED', planSiguiente: undefined });
      return NextResponse.json({ success: true, agent: sanitizeAgent(updated ?? {}) });
    }

    const agent = await prisma.agent.findUnique({ where: { id: authSession.agentId } });
    if (!agent || resolveEffectiveSubscriptionStatus(agent) !== 'ACTIVE') {
      return NextResponse.json({ error: 'No tienes una suscripción activa para cancelar.' }, { status: 400 });
    }
    const updated = await prisma.agent.update({
      where: { id: authSession.agentId },
      data: { subscriptionStatus: 'CANCELED', planSiguiente: null },
    });
    await logSubscriptionCancellation(authSession.agentId, 'VOLUNTARY');
    return NextResponse.json({ success: true, agent: sanitizeAgent(updated) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo cancelar la suscripción.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

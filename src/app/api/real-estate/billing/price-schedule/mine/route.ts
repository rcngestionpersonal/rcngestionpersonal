import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAgentById, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { getUpcomingPriceChangeNoticeForAgent } from '@/lib/real-estate/price-schedule';

// Aviso de cambio de precio aplicable al agente logueado (Fase 7, seccion
// 9.5) - null si no hay ninguno programado para su plan, o si tiene precio
// fundador vigente en Basico (no le afecta). Usado por el banner del panel.
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados.' }, { status: 403 });
  }

  const agent = shouldUseMockStore()
    ? findAgentById(session.agentId)
    : await prisma.agent.findUnique({ where: { id: session.agentId }, select: { plan: true, precioFundadorBasico: true } });
  if (!agent) return NextResponse.json({ notice: null });

  const notice = await getUpcomingPriceChangeNoticeForAgent({ plan: agent.plan, precioFundadorBasico: agent.precioFundadorBasico });
  return NextResponse.json({ notice });
}

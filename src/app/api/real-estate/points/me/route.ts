import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAgentPointsSummary } from '@/lib/real-estate/points-log';
import { ensureAgentSlug } from '@/lib/real-estate/agent-slug';
import { findAgentById, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const queriedAgentId = request.nextUrl.searchParams.get('agentId');
  const agentId = session.role === 'admin' && queriedAgentId ? queriedAgentId : session.agentId;
  if (!agentId) {
    return NextResponse.json({ error: 'Se requiere agentId.' }, { status: 400 });
  }

  const summary = await getAgentPointsSummary(agentId);

  // El slug del Carnet publico (/v/[slug]) se genera perezosamente aqui, la
  // primera vez que el propio agente carga su dashboard - asi nunca hace falta
  // un endpoint aparte solo para esto.
  let carnetSlug: string | null = null;
  try {
    const fullName = shouldUseMockStore()
      ? findAgentById(agentId)?.fullName
      : (await prisma.agent.findUnique({ where: { id: agentId }, select: { fullName: true } }))?.fullName;
    if (fullName) carnetSlug = await ensureAgentSlug(agentId, fullName);
  } catch {
    carnetSlug = null;
  }

  return NextResponse.json({ summary, carnetSlug });
}

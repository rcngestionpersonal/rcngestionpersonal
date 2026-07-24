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
    return NextResponse.json({ agent: sanitizeAgent(agent) });
  } catch {
    const agent = findAgentById(session.agentId);
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    return NextResponse.json({ agent: sanitizeAgent(agent), fallback: true });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteOpportunity, findOpportunityById, shouldUseMockStore, updateOpportunity } from '@/lib/real-estate/mock-store';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (shouldUseMockStore()) {
    const existing = findOpportunityById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent' && existing.createdByAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que creó este pedido puede editarlo.' }, { status: 403 });
    }
    const updated = updateOpportunity(id, body);
    return NextResponse.json({ opportunity: updated, fallback: true });
  }

  try {
    const existing = await prisma.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent' && existing.createdByAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que creó este pedido puede editarlo.' }, { status: 403 });
    }
    const opportunity = await prisma.opportunity.update({ where: { id }, data: body });
    return NextResponse.json({ opportunity });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el pedido.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (shouldUseMockStore()) {
    const existing = findOpportunityById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent' && existing.createdByAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que creó este pedido puede eliminarlo.' }, { status: 403 });
    }
    deleteOpportunity(id);
    return NextResponse.json({ success: true, fallback: true });
  }

  try {
    const existing = await prisma.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent' && existing.createdByAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que creó este pedido puede eliminarlo.' }, { status: 403 });
    }
    await prisma.opportunity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el pedido.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteListing, findListingById, shouldUseMockStore, updateListing } from '@/lib/real-estate/mock-store';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (shouldUseMockStore()) {
    const existing = findListingById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent' && existing.managingAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede editarlo.' }, { status: 403 });
    }
    const updated = updateListing(id, body);
    return NextResponse.json({ listing: updated, fallback: true });
  }

  try {
    const existing = await prisma.listing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent' && existing.managingAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede editarlo.' }, { status: 403 });
    }
    const listing = await prisma.listing.update({ where: { id }, data: body });
    return NextResponse.json({ listing });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el inmueble.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (shouldUseMockStore()) {
    const existing = findListingById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent' && existing.managingAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede eliminarlo.' }, { status: 403 });
    }
    deleteListing(id);
    return NextResponse.json({ success: true, fallback: true });
  }

  try {
    const existing = await prisma.listing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent' && existing.managingAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede eliminarlo.' }, { status: 403 });
    }
    await prisma.listing.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el inmueble.' }, { status: 500 });
  }
}

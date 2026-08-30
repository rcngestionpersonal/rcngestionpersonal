import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findListingById, listListingPhotos, reorderListingPhotos, shouldUseMockStore } from '@/lib/real-estate/mock-store';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { order?: unknown };
  if (!Array.isArray(body.order) || body.order.some((v) => typeof v !== 'string')) {
    return NextResponse.json({ error: 'Orden inválido.' }, { status: 400 });
  }
  const order = body.order as string[];

  if (shouldUseMockStore()) {
    const listing = findListingById(id);
    if (!listing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
    if (listing.managingAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede reordenar sus fotos.' }, { status: 403 });
    }
    const ok = reorderListingPhotos(id, order);
    if (!ok) return NextResponse.json({ error: 'El orden no coincide con las fotos actuales del inmueble.' }, { status: 400 });
    return NextResponse.json({ success: true, photos: listListingPhotos(id), fallback: true });
  }

  try {
    const listing = await prisma.listing.findUnique({ where: { id }, select: { managingAgentId: true } });
    if (!listing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
    if (listing.managingAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede reordenar sus fotos.' }, { status: 403 });
    }
    const current = await prisma.listingPhoto.findMany({ where: { listingId: id }, select: { id: true } });
    const currentIds = new Set(current.map((p) => p.id));
    if (currentIds.size !== order.length || order.some((pid) => !currentIds.has(pid))) {
      return NextResponse.json({ error: 'El orden no coincide con las fotos actuales del inmueble.' }, { status: 400 });
    }
    await Promise.all(order.map((photoId, i) => prisma.listingPhoto.update({ where: { id: photoId }, data: { orden: i } })));
    const photos = await prisma.listingPhoto.findMany({ where: { listingId: id }, orderBy: { orden: 'asc' } });
    return NextResponse.json({ success: true, photos });
  } catch {
    return NextResponse.json({ error: 'No se pudo reordenar las fotos.' }, { status: 500 });
  }
}

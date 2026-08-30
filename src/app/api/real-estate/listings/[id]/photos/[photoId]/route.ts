import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteListingPhoto, findListingById, listListingPhotos, setListingPhotoCover, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { deleteListingPhotoPrisma, setListingPhotoCoverPrisma } from '@/lib/real-estate/listing-photos-prisma';

async function assertOwnership(listingId: string, agentId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (shouldUseMockStore()) {
    const listing = findListingById(listingId);
    if (!listing) return { ok: false, status: 404, error: 'Inmueble no encontrado.' };
    if (listing.managingAgentId !== agentId) return { ok: false, status: 403, error: 'Solo el agente que gestiona este inmueble puede editar sus fotos.' };
    return { ok: true };
  }
  try {
    const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { managingAgentId: true } });
    if (!listing) return { ok: false, status: 404, error: 'Inmueble no encontrado.' };
    if (listing.managingAgentId !== agentId) return { ok: false, status: 403, error: 'Solo el agente que gestiona este inmueble puede editar sus fotos.' };
    return { ok: true };
  } catch {
    return { ok: false, status: 500, error: 'No se pudo verificar el inmueble.' };
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const owns = await assertOwnership(id, session.agentId);
  if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status });

  if (shouldUseMockStore()) {
    const result = deleteListingPhoto(photoId);
    if (!result || result.listingId !== id) return NextResponse.json({ error: 'Foto no encontrada.' }, { status: 404 });
    return NextResponse.json({ success: true, photos: listListingPhotos(id), fallback: true });
  }

  try {
    const result = await deleteListingPhotoPrisma(photoId);
    if (!result || result.listingId !== id) return NextResponse.json({ error: 'Foto no encontrada.' }, { status: 404 });
    const photos = await prisma.listingPhoto.findMany({ where: { listingId: id }, orderBy: { orden: 'asc' } });
    return NextResponse.json({ success: true, photos });
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar la foto.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { esPortada?: boolean };
  if (body.esPortada !== true) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  }

  const owns = await assertOwnership(id, session.agentId);
  if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status });

  if (shouldUseMockStore()) {
    const ok = setListingPhotoCover(id, photoId);
    if (!ok) return NextResponse.json({ error: 'Foto no encontrada.' }, { status: 404 });
    return NextResponse.json({ success: true, photos: listListingPhotos(id), fallback: true });
  }

  try {
    const ok = await setListingPhotoCoverPrisma(id, photoId);
    if (!ok) return NextResponse.json({ error: 'Foto no encontrada.' }, { status: 404 });
    const photos = await prisma.listingPhoto.findMany({ where: { listingId: id }, orderBy: { orden: 'asc' } });
    return NextResponse.json({ success: true, photos });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar la portada.' }, { status: 500 });
  }
}

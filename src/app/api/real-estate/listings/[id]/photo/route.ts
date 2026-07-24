import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findListingById, shouldUseMockStore, updateListing } from '@/lib/real-estate/mock-store';
import { awardListingPhotoAdded } from '@/lib/real-estate/points-log';

// Limite de seguridad pre-compresion: el cliente ya redimensiona/comprime a ~300KB
// antes de subir, pero se valida igual en el servidor por si el cliente falla o es
// baypaseado.
const MAX_BYTES = 10 * 1024 * 1024;

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede subir su foto.' }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('photo');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo no válido.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'El archivo debe ser una imagen.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen es demasiado pesada (máx. 10MB).' }, { status: 400 });
  }

  let hadPhoto = false;
  if (shouldUseMockStore()) {
    const existing = findListingById(id);
    if (!existing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
    if (existing.managingAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede editar su foto.' }, { status: 403 });
    }
    hadPhoto = Boolean(existing.coverPhotoUrl);
  } else {
    try {
      const existing = await prisma.listing.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
      if (existing.managingAgentId !== session.agentId) {
        return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede editar su foto.' }, { status: 403 });
      }
      hadPhoto = Boolean(existing.coverPhotoUrl);
    } catch {
      return NextResponse.json({ error: 'No se pudo verificar el inmueble.' }, { status: 500 });
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Almacenamiento de fotos no configurado.' }, { status: 503 });
  }

  let blobUrl: string;
  try {
    const blob = await put(`listings/${id}-${Date.now()}.${extensionFor(file.type)}`, file, {
      access: 'public',
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch {
    return NextResponse.json({ error: 'No se pudo subir la foto. Intenta de nuevo.' }, { status: 500 });
  }

  if (shouldUseMockStore()) {
    const updated = updateListing(id, { coverPhotoUrl: blobUrl });
    if (!hadPhoto) await awardListingPhotoAdded(session.agentId, id);
    return NextResponse.json({ url: blobUrl, listing: updated, fallback: true });
  }

  try {
    const listing = await prisma.listing.update({ where: { id }, data: { coverPhotoUrl: blobUrl } });
    if (!hadPhoto) await awardListingPhotoAdded(session.agentId, id);
    return NextResponse.json({ url: blobUrl, listing });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la foto.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  addListingPhoto,
  countListingPhotos,
  findListingById,
  listListingPhotos,
  shouldUseMockStore,
} from '@/lib/real-estate/mock-store';
import { MAX_LISTING_PHOTOS } from '@/lib/real-estate/listing-photos-shared';
import { awardListingPhotoAdded } from '@/lib/real-estate/points-log';

// Limite de seguridad pre-compresion: el cliente ya redimensiona/comprime a
// ~400KB antes de subir (maximo 1600px de lado mayor, ver image-compress.ts),
// pero se valida igual en el servidor por si el cliente falla o es bypaseado.
const MAX_BYTES = 10 * 1024 * 1024;

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (shouldUseMockStore()) {
    return NextResponse.json({ photos: listListingPhotos(id), fallback: true });
  }

  try {
    const photos = await prisma.listingPhoto.findMany({ where: { listingId: id }, orderBy: { orden: 'asc' } });
    return NextResponse.json({ photos });
  } catch {
    return NextResponse.json({ photos: listListingPhotos(id), fallback: true });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede subir fotos.' }, { status: 403 });
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

  let hadAnyPhoto = false;

  if (shouldUseMockStore()) {
    const existing = findListingById(id);
    if (!existing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
    if (existing.managingAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede editar sus fotos.' }, { status: 403 });
    }
    const currentCount = countListingPhotos(id);
    if (currentCount >= MAX_LISTING_PHOTOS) {
      return NextResponse.json({ error: `Ya tienes el máximo de ${MAX_LISTING_PHOTOS} fotos.` }, { status: 400 });
    }
    hadAnyPhoto = currentCount > 0;
  } else {
    try {
      const existing = await prisma.listing.findUnique({ where: { id }, select: { managingAgentId: true } });
      if (!existing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
      if (existing.managingAgentId !== session.agentId) {
        return NextResponse.json({ error: 'Solo el agente que gestiona este inmueble puede editar sus fotos.' }, { status: 403 });
      }
      const currentCount = await prisma.listingPhoto.count({ where: { listingId: id } });
      if (currentCount >= MAX_LISTING_PHOTOS) {
        return NextResponse.json({ error: `Ya tienes el máximo de ${MAX_LISTING_PHOTOS} fotos.` }, { status: 400 });
      }
      hadAnyPhoto = currentCount > 0;
    } catch {
      return NextResponse.json({ error: 'No se pudo verificar el inmueble.' }, { status: 500 });
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Almacenamiento de fotos no configurado.' }, { status: 503 });
  }

  let blobUrl: string;
  try {
    const blob = await put(`listings/${id}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extensionFor(file.type)}`, file, {
      access: 'public',
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch {
    return NextResponse.json({ error: 'No se pudo subir la foto. Intenta de nuevo.' }, { status: 500 });
  }

  if (shouldUseMockStore()) {
    const photo = addListingPhoto(id, blobUrl);
    if (!hadAnyPhoto) await awardListingPhotoAdded(session.agentId, id);
    return NextResponse.json({ photo, photos: listListingPhotos(id), fallback: true }, { status: 201 });
  }

  try {
    const currentMax = await prisma.listingPhoto.aggregate({ where: { listingId: id }, _max: { orden: true } });
    const photo = await prisma.listingPhoto.create({
      data: {
        listingId: id,
        url: blobUrl,
        orden: (currentMax._max.orden ?? -1) + 1,
        esPortada: !hadAnyPhoto,
      },
    });
    if (!hadAnyPhoto) {
      await prisma.listing.update({ where: { id }, data: { coverPhotoUrl: blobUrl } });
      await awardListingPhotoAdded(session.agentId, id);
    }
    const photos = await prisma.listingPhoto.findMany({ where: { listingId: id }, orderBy: { orden: 'asc' } });
    return NextResponse.json({ photo, photos }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la foto.' }, { status: 500 });
  }
}

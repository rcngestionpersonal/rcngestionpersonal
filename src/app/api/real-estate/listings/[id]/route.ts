import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteListing, findListingById, shouldUseMockStore, updateListing } from '@/lib/real-estate/mock-store';
import { borrarBlobSinFallar } from '@/lib/real-estate/listing-photos-prisma';

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
    // onDelete: Cascade borra las filas de ListingPhoto, pero NO los archivos
    // en Blob (punto 5.3): hay que leer las rutas ANTES de borrar el inmueble,
    // porque despues ya no hay de donde sacarlas. El borrado en Blob no puede
    // bloquear la eliminacion del inmueble, asi que va despues y sin fallar.
    const fotos = await prisma.listingPhoto.findMany({ where: { listingId: id }, select: { ruta: true } });
    await prisma.listing.delete({ where: { id } });
    await Promise.all(fotos.map((f) => borrarBlobSinFallar(f.ruta)));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el inmueble.' }, { status: 500 });
  }
}

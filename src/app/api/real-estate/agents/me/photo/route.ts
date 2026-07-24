import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sanitizeAgent, shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';

// Espejo de listings/[id]/photo/route.ts, pero para la foto de perfil del
// propio agente (nunca la de un tercero - por eso no recibe id, solo usa la
// sesion activa).
const MAX_BYTES = 10 * 1024 * 1024;

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo un agente autenticado puede subir su foto de perfil.' }, { status: 403 });
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Almacenamiento de fotos no configurado.' }, { status: 503 });
  }

  let blobUrl: string;
  try {
    const blob = await put(`agents/${session.agentId}-${Date.now()}.${extensionFor(file.type)}`, file, {
      access: 'public',
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch {
    return NextResponse.json({ error: 'No se pudo subir la foto. Intenta de nuevo.' }, { status: 500 });
  }

  if (shouldUseMockStore()) {
    const updated = updateAgent(session.agentId, { photoUrl: blobUrl });
    return NextResponse.json({ url: blobUrl, agent: updated ? sanitizeAgent(updated) : null, fallback: true });
  }

  try {
    const agent = await prisma.agent.update({ where: { id: session.agentId }, data: { photoUrl: blobUrl } });
    return NextResponse.json({ url: blobUrl, agent: sanitizeAgent(agent) });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la foto.' }, { status: 500 });
  }
}

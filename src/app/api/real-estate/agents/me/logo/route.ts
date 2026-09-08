import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Logotipo de la empresa del agente, para el encabezado de sus cartas de
// presentacion (punto 1.4). Espejo de agents/me/photo: solo la sesion activa,
// nunca el logo de un tercero.
export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;

function extensionPara(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'jpg';
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo un agente autenticado puede subir su logotipo.' }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('logo');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo no válido.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'El archivo debe ser una imagen.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen es demasiado pesada (máx. 5MB).' }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Almacenamiento de imágenes no configurado.' }, { status: 503 });
  }

  let blobUrl: string;
  try {
    const blob = await put(`logos/${session.agentId}-${Date.now()}.${extensionPara(file.type)}`, file, {
      access: 'public',
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch {
    return NextResponse.json({ error: 'No se pudo subir el logotipo. Intenta de nuevo.' }, { status: 500 });
  }

  await prisma.agent.update({
    where: { id: session.agentId },
    data: { cartaLogoUrl: blobUrl, cartaImagenTipo: 'logo' },
  });

  return NextResponse.json({ url: blobUrl });
}

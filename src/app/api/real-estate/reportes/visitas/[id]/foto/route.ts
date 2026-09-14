import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fotoDescifrada } from '@/lib/real-estate/reportes/foto';
import { agenteConReportes, faltaClaveDeCifrado } from '@/lib/real-estate/reportes/servidor';

// La UNICA puerta de salida de la foto de un visitante. No hay URL publica: la
// imagen vive cifrada en la base y solo el agente que registro la visita puede
// verla, siempre a traves de esta ruta autenticada.
//
//   ?uso=respaldo  se muestra en la pantalla del agente (inline)
//   ?uso=redes     descarga para publicar. Solo con el SEGUNDO consentimiento:
//                  sin el, se niega aunque el agente la pida a mano.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const sinClave = faltaClaveDeCifrado();
  if (sinClave) return sinClave;
  const { id } = await params;

  const foto = await prisma.reporteVisitaFoto.findUnique({
    where: { reporteId: id },
    select: { datosCifrados: true, consentimientoRedes: true, reporte: { select: { agentId: true } } },
  });
  if (!foto || foto.reporte.agentId !== auth.agentId) {
    return NextResponse.json({ error: 'Foto no encontrada.' }, { status: 404 });
  }

  const paraRedes = request.nextUrl.searchParams.get('uso') === 'redes';
  if (paraRedes && !foto.consentimientoRedes) {
    return NextResponse.json(
      { error: 'El visitante no autorizó publicar esta foto. Solo sirve como respaldo de la visita.', code: 'solo_respaldo' },
      { status: 403 },
    );
  }

  let jpeg: Buffer;
  try {
    jpeg = fotoDescifrada(foto.datosCifrados);
  } catch {
    return NextResponse.json({ error: 'No se pudo abrir la foto.' }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': paraRedes ? `attachment; filename="visita-${id.slice(-6)}.jpg"` : 'inline',
      // Imagen de un tercero: ni el navegador ni ningun intermediario la guardan.
      'Cache-Control': 'private, no-store',
    },
  });
}

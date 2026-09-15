import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { descifrarBytes } from '@/lib/real-estate/reportes/cifrado';
import { verificarEnlace } from '@/lib/real-estate/reportes/documento';

// Descarga de un reporte por enlace (punto 4.3 del pedido de adjuntos).
//
// Existe solo para el caso en que el PDF supero el limite de adjunto y el
// agente eligio mandar un enlace. Quien lo abre no tiene cuenta: su credencial
// es el token firmado del correo, que vence a los 30 días. Entrega el mismo
// documento congelado del envio, nunca uno regenerado.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verificado = verificarEnlace(token);
  if ('error' in verificado) {
    const vencido = verificado.error === 'vencido';
    return new NextResponse(vencido ? 'Este enlace ya venció. Pídale al agente que le reenvíe el reporte.' : 'Enlace no válido.', {
      status: vencido ? 410 : 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const doc = await prisma.reporteDocumento.findUnique({ where: { id: verificado.documentoId }, select: { pdfCifrado: true, nombreArchivo: true } });
  if (!doc) {
    // El agente pudo haber borrado el reporte: con el, su documento.
    return new NextResponse('Este reporte ya no está disponible.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  return new NextResponse(new Uint8Array(descifrarBytes(doc.pdfCifrado)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${doc.nombreArchivo}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

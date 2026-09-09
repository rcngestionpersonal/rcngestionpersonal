import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/real-estate/contratos/firma';
import { construirPdf, nombreArchivoContrato } from '@/lib/real-estate/contratos/servidor';
import type { ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// PDF del documento para el firmante (punto 3.4: "descargar borrador en PDF"
// antes de firmar, y descarga del final cuando ya firmo). El token es la
// credencial: quien tiene el enlace puede ver SU documento y ningun otro.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const firmante = await prisma.contratoFirmante.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { contrato: { include: { firmantes: true } } },
  });
  if (!firmante) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 });

  const contrato = firmante.contrato;
  if (contrato.estado === 'ANULADO') {
    return NextResponse.json({ error: 'Este documento fue cancelado.' }, { status: 409 });
  }
  // Un enlace vencido deja de servir tambien para descargar, salvo que la
  // persona ya haya firmado: en ese caso tiene derecho a su copia.
  if (firmante.expiraAt.getTime() < Date.now() && firmante.estado !== 'FIRMADO') {
    return NextResponse.json({ error: 'El enlace venció.' }, { status: 410 });
  }

  const { buffer } = await construirPdf(contrato);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivoContrato(contrato.tipo as ContratoTipo, contrato.codigoVerificacion)}"`,
      'Cache-Control': 'no-store',
    },
  });
}

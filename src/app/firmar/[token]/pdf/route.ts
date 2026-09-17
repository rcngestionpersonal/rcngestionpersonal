import { NextRequest, NextResponse } from 'next/server';
import { hashToken } from '@/lib/real-estate/contratos/aprobacion';
import { contratoDelAgente, nombreArchivoContrato, pdfDeFirmaLegado } from '@/lib/real-estate/contratos/servidor';
import type { ContratoTipo } from '@/lib/real-estate/contratos/tipos';
import { prisma } from '@/lib/prisma';

// Copia del documento para quien firmó durante la etapa de firma electrónica,
// retirada el 2026-09-16. Solo para quien firmó: el resto de estos enlaces ya
// no abre nada.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parte = await prisma.contratoParte.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { versionId: true, estado: true, contratoId: true, contrato: { select: { agentId: true, estado: true } } },
  });
  if (!parte || parte.versionId) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 });
  if (parte.estado !== 'FIRMADO' || parte.contrato.estado === 'ANULADO') {
    return NextResponse.json({ error: 'Este enlace ya no da acceso al documento.' }, { status: 410 });
  }

  const contrato = await contratoDelAgente(parte.contratoId, parte.contrato.agentId);
  if (!contrato) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 });

  const buffer = await pdfDeFirmaLegado(contrato);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivoContrato(contrato.tipo as ContratoTipo, contrato.codigoVerificacion)}"`,
      'Cache-Control': 'no-store',
    },
  });
}

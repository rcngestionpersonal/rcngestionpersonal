import { NextRequest, NextResponse } from 'next/server';
import { hashToken } from '@/lib/real-estate/contratos/aprobacion';
import { contratoDelAgente, nombreArchivoContrato, pdfDeVersion } from '@/lib/real-estate/contratos/servidor';
import { parteDeToken } from '@/lib/real-estate/contratos/versiones';
import type { ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// PDF de la versión que una parte tiene que revisar, o sobre la que ya decidió.
// El token es la credencial: quien tiene el enlace ve ESA versión de SU
// documento y ninguna otra.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parte = await parteDeToken(hashToken(token));
  if (!parte || !parte.version) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 });

  if (parte.contrato.estado === 'ANULADO') {
    return NextResponse.json({ error: 'Este documento fue cancelado.' }, { status: 409 });
  }
  // Un enlace vencido deja de servir también para descargar, salvo que la
  // persona ya haya decidido: en ese caso tiene derecho a su copia.
  const decidio = parte.estado === 'APROBADO' || parte.estado === 'RECHAZADO';
  if (parte.expiraAt.getTime() < Date.now() && !decidio) {
    return NextResponse.json({ error: 'El enlace venció.' }, { status: 410 });
  }

  const contrato = await contratoDelAgente(parte.contratoId, parte.contrato.agentId);
  const buffer = contrato ? await pdfDeVersion(contrato, parte.version.numero) : null;
  if (!contrato || !buffer) return NextResponse.json({ error: 'No se pudo preparar el documento.' }, { status: 500 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivoContrato(contrato.tipo as ContratoTipo, contrato.codigoVerificacion, { version: parte.version.numero })}"`,
      'Cache-Control': 'no-store',
    },
  });
}

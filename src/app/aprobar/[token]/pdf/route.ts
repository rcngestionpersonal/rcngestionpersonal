import { NextRequest, NextResponse } from 'next/server';
import { hashToken } from '@/lib/real-estate/contratos/aprobacion';
import { contratoDelAgente, nombreArchivoContrato, pdfDeVersion } from '@/lib/real-estate/contratos/servidor';
import { motivoCerrado, parteDeToken, statusDeMotivo, textoCerrado } from '@/lib/real-estate/contratos/versiones';
import type { ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// PDF de la versión que una parte tiene que revisar, o sobre la que ya decidió.
// El enlace es la credencial: quien lo tiene ve ESA versión de SU documento y
// ninguna otra, y solo si la página también se la mostraría (una contraparte no
// descarga lo que la parte principal todavía no aprobó).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parte = await parteDeToken(hashToken(token));
  if (!parte || !parte.version) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 });

  // Puede descargar quien puede decidir, y quien ya decidió (tiene derecho a su
  // copia). Nadie más.
  const motivo = motivoCerrado(parte);
  if (motivo && motivo !== 'ya_aprobo' && motivo !== 'ya_rechazo') {
    return NextResponse.json({ error: textoCerrado(motivo), code: motivo }, { status: statusDeMotivo(motivo) });
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

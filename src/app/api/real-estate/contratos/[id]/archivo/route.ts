import { NextRequest, NextResponse } from 'next/server';
import { agenteConContratos, construirPdf, contratoDelAgente, nombreArchivoContrato } from '@/lib/real-estate/contratos/servidor';
import type { ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// PDF del contrato para el agente: sirve de vista previa del borrador y de
// descarga del documento sellado. Node runtime por las fuentes embebidas y los
// binarios nativos de sharp/@resvg (ver outputFileTracingIncludes).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  const { buffer } = await construirPdf(contrato);
  const enLinea = new URL(request.url).searchParams.get('previa') === '1';

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${enLinea ? 'inline' : 'attachment'}; filename="${nombreArchivoContrato(contrato.tipo as ContratoTipo, contrato.codigoVerificacion)}"`,
      'Cache-Control': 'no-store',
    },
  });
}

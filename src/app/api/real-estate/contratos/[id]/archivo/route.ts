import { NextRequest, NextResponse } from 'next/server';
import {
  agenteConContratos,
  contratoDelAgente,
  esContratoDeFirma,
  nombreArchivoContrato,
  pdfDeFirmaLegado,
  pdfDeTrabajo,
  pdfDeVersion,
  pdfPredeterminado,
} from '@/lib/real-estate/contratos/servidor';
import type { ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// PDF del contrato para el agente.
//   ?version=N   la versión N tal como se envió, con su constancia como anexo
//   ?trabajo=1   el borrador de trabajo, con lo que aún no se envió
//   (nada)       la última versión si no hay cambios sin enviar; si no, el borrador
//   &previa=1    en el navegador en vez de descargar
// Node runtime por las fuentes embebidas y los binarios nativos de
// sharp/@resvg (ver outputFileTracingIncludes).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  const url = new URL(request.url);
  const pedida = Number(url.searchParams.get('version'));
  let buffer: Buffer | null;
  let version: number | null = null;

  if (esContratoDeFirma(contrato)) {
    buffer = await pdfDeFirmaLegado(contrato);
  } else if (Number.isInteger(pedida) && pedida > 0) {
    buffer = await pdfDeVersion(contrato, pedida);
    version = pedida;
    if (!buffer) return NextResponse.json({ error: 'Esa versión no existe.' }, { status: 404 });
  } else if (url.searchParams.get('trabajo') === '1') {
    buffer = await pdfDeTrabajo(contrato);
  } else {
    const predeterminado = await pdfPredeterminado(contrato);
    buffer = predeterminado.buffer;
    version = predeterminado.version;
  }

  const enLinea = url.searchParams.get('previa') === '1';
  const nombre = nombreArchivoContrato(contrato.tipo as ContratoTipo, contrato.codigoVerificacion, { version: version ?? undefined });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${enLinea ? 'inline' : 'attachment'}; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}

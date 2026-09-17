import { NextRequest, NextResponse } from 'next/server';
import {
  agenteConContratos,
  contratoDelAgente,
  documentoDeTrabajo,
  esContratoDeFirma,
  nombreArchivoContrato,
} from '@/lib/real-estate/contratos/servidor';
import { generarDocx } from '@/lib/real-estate/contratos/docx';
import { esTipoArchivado, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// Word (.docx) editable de la copia de trabajo, con los datos ya rellenados y
// las ediciones de cláusulas aplicadas. Solo descarga: nunca se envía por
// correo, y lo que se edite fuera queda fuera del circuito de aprobación.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });
  if (esContratoDeFirma(contrato) || esTipoArchivado(contrato.tipo)) {
    return NextResponse.json({ error: 'Este contrato no se exporta a Word.', code: 'no_exportable' }, { status: 409 });
  }

  const trabajo = await documentoDeTrabajo(contrato);
  const archivo = generarDocx({
    bloques: trabajo.preparado.bloques,
    nombreDocumento: trabajo.preparado.nombreDocumento,
    ciudad: trabajo.ciudad,
    fechaLarga: trabajo.fechaLarga,
  });

  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${nombreArchivoContrato(contrato.tipo as ContratoTipo, contrato.codigoVerificacion, { extension: 'docx' })}"`,
      'Cache-Control': 'no-store',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import {
  agenteConContratos,
  cambiosSinEnviar,
  contratoDelAgente,
  documentoDeTrabajo,
  esContratoDeFirma,
} from '@/lib/real-estate/contratos/servidor';
import { leerEdicion } from '@/lib/real-estate/contratos/clausulas';
import { AVISO_EXPORTAR_WORD, camposFaltantes, esEditable, type ContratoEstado, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// La copia de trabajo ya armada: las cláusulas para el editor (activas o no,
// con su texto modelo al lado del editado) y el documento tal como se leerá,
// para revisarlo antes de enviar.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  const trabajo = await documentoDeTrabajo(contrato);
  const visibles = Object.fromEntries(Object.entries(trabajo.datos).filter(([k]) => !k.startsWith('__')));
  const editable = !esContratoDeFirma(contrato) && esEditable(contrato.estado as ContratoEstado, contrato.tipo);

  return NextResponse.json({
    editable,
    admiteEdicion: editable && trabajo.preparado.admiteEdicion,
    nombreDocumento: trabajo.preparado.nombreDocumento,
    ciudad: trabajo.ciudad,
    fechaLarga: trabajo.fechaLarga,
    clausulas: trabajo.preparado.clausulas,
    // La edición tal como está guardada: el editor la modifica y la devuelve
    // entera, sin reconstruirla desde la vista.
    edicion: leerEdicion(trabajo.datos),
    bloques: trabajo.preparado.bloques,
    versionActual: contrato.versionActual,
    cambiosSinEnviar: cambiosSinEnviar(contrato, trabajo.preparado.bloques),
    faltantes: camposFaltantes(contrato.tipo as ContratoTipo, visibles),
    avisoWord: AVISO_EXPORTAR_WORD,
  });
}

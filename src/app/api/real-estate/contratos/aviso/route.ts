import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConContratos } from '@/lib/real-estate/contratos/servidor';
import { AVISO_MODULO_VERSION, debeAceptarAviso } from '@/lib/real-estate/contratos/tipos';

// Aceptacion del aviso "los contratos de Redinmo son modelos referenciales"
// (punto 4.2.a). Se registra con fecha y con la version del texto aceptado,
// para que quede constancia de QUE se aceptó y CUANDO.
//
// El texto no viaja en el cuerpo: el cliente solo confirma que marcó la
// casilla. Lo que se guarda es la version que el servidor tiene por vigente,
// de modo que nadie pueda declarar haber aceptado un texto distinto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const aceptarSchema = z.object({
  acepta: z.literal(true, { errorMap: () => ({ message: 'Debes marcar la casilla para continuar.' }) }),
});

export async function POST(request: NextRequest) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const parsed = aceptarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Debes marcar la casilla para continuar.' }, { status: 400 });
  }

  const ahora = new Date();
  await prisma.agent.update({
    where: { id: auth.agentId },
    data: { contratosAvisoAt: ahora, contratosAvisoVersion: AVISO_MODULO_VERSION },
  });

  return NextResponse.json({
    ok: true,
    aceptadoAt: ahora,
    version: AVISO_MODULO_VERSION,
    debeAceptar: debeAceptarAviso(ahora, AVISO_MODULO_VERSION),
  });
}

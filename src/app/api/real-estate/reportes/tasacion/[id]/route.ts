import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { metaDocumento } from '@/lib/real-estate/reportes/documento';
import { agenteConReportes } from '@/lib/real-estate/reportes/servidor';
import { tasacionDelAgente, tasacionParaAgente } from '@/lib/real-estate/reportes/tasacion-guardada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const t = await tasacionDelAgente(id, auth.agentId);
  if (!t) return NextResponse.json({ error: 'Tasación no encontrada.' }, { status: 404 });
  return NextResponse.json({ tasacion: tasacionParaAgente(t, await metaDocumento('tasacion', id)) });
}

// Punto 5.4: el agente puede borrar cualquier reporte; su PDF se va con el.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const t = await tasacionDelAgente(id, auth.agentId);
  if (!t) return NextResponse.json({ error: 'Tasación no encontrada.' }, { status: 404 });
  await prisma.reporteTasacion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

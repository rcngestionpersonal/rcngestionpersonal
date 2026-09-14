import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gestionDelAgente, gestionParaAgente } from '@/lib/real-estate/reportes/gestion';
import { agenteConReportes } from '@/lib/real-estate/reportes/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const g = await gestionDelAgente(id, auth.agentId);
  if (!g) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
  return NextResponse.json({ gestion: gestionParaAgente(g) });
}

// Punto 5.4: el agente puede borrar cualquier reporte.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const g = await gestionDelAgente(id, auth.agentId);
  if (!g) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
  await prisma.reporteGestion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

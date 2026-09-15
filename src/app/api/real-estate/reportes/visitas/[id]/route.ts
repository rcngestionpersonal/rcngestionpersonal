import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { metaDocumento } from '@/lib/real-estate/reportes/documento';
import { agenteConReportes, faltaClaveDeCifrado } from '@/lib/real-estate/reportes/servidor';
import { visitaDelAgente, visitaParaAgente } from '@/lib/real-estate/reportes/visitas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const sinClave = faltaClaveDeCifrado();
  if (sinClave) return sinClave;
  const { id } = await params;
  const reporte = await visitaDelAgente(id, auth.agentId);
  if (!reporte) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
  return NextResponse.json({ visita: { ...visitaParaAgente(reporte), documento: await metaDocumento('visita', id), propietario: reporte.listing.ownerName } });
}

// Punto 5.4: el agente puede borrar el reporte y todo lo asociado. La foto se
// va con el (onDelete: Cascade): no queda una imagen huerfana de un tercero.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  // Borrar NO exige la clave: un agente tiene que poder eliminar datos de un
  // tercero aunque el cifrado este caido.
  const { id } = await params;
  const reporte = await visitaDelAgente(id, auth.agentId);
  if (!reporte) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
  await prisma.reporteVisita.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

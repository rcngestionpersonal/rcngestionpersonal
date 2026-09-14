import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { periodoSiguiente } from '@/lib/real-estate/reportes/estadistica';
import { calcularDatosGestion, difusionPorDefecto } from '@/lib/real-estate/reportes/gestion-datos';
import { agenteConReportes, inmuebleDelAgente } from '@/lib/real-estate/reportes/servidor';
import { DIAS_POR_PERIODO, PERIODICIDADES, type EntradaDifusion, type Periodicidad } from '@/lib/real-estate/reportes/tipos';

// Borrador del reporte de gestion (punto 2.4): las cifras automaticas del
// periodo ya calculadas, y la difusion y las observaciones del reporte
// anterior, para que el agente solo actualice lo que cambio. No guarda nada.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;

  const q = request.nextUrl.searchParams;
  const listing = await inmuebleDelAgente(q.get('listingId') ?? '', auth.agentId);
  if (!listing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });

  const anterior = await prisma.reporteGestion.findFirst({
    where: { listingId: listing.id, agentId: auth.agentId },
    orderBy: { periodoHasta: 'desc' },
    select: { id: true, periodicidad: true, periodoHasta: true, difusion: true, observaciones: true },
  });

  const pedida = q.get('periodicidad');
  const periodicidad: Periodicidad = (PERIODICIDADES as readonly string[]).includes(pedida ?? '')
    ? (pedida as Periodicidad)
    : ((anterior?.periodicidad as Periodicidad | undefined) ?? 'SEMANAL');

  const { desde, hasta } = periodoSiguiente(new Date(), DIAS_POR_PERIODO[periodicidad], anterior?.periodoHasta ?? null);
  const { datos, senal } = await calcularDatosGestion(listing, periodicidad, desde, hasta);

  return NextResponse.json({
    periodicidad,
    datos,
    // Solo para el agente (punto 2.3). Nunca entra en "datos" ni en el PDF.
    senal,
    difusion: (anterior?.difusion as EntradaDifusion[] | undefined) ?? difusionPorDefecto(),
    observaciones: anterior?.observaciones ?? '',
    anterior: anterior ? { id: anterior.id, periodoHasta: anterior.periodoHasta.toISOString() } : null,
  });
}

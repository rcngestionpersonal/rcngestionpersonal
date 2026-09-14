import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { periodoSiguiente } from '@/lib/real-estate/reportes/estadistica';
import { gestionDelAgente, gestionParaAgente } from '@/lib/real-estate/reportes/gestion';
import { calcularDatosGestion, difusionSchema } from '@/lib/real-estate/reportes/gestion-datos';
import { agenteConReportes, inmuebleDelAgente } from '@/lib/real-estate/reportes/servidor';
import { DIAS_POR_PERIODO, GESTION_LIMITES, PERIODICIDADES } from '@/lib/real-estate/reportes/tipos';

// Emision de un reporte de gestion (punto 2). Las cifras se recalculan AQUI y
// se congelan: nunca se aceptan desde el cliente, que podria mandar cualquier
// numero.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  listingId: z.string().min(1),
  periodicidad: z.enum(PERIODICIDADES),
  difusion: difusionSchema,
  observaciones: z
    .string()
    .trim()
    .max(GESTION_LIMITES.observaciones)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export async function POST(request: NextRequest) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Revisa los datos del reporte.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const entrada = parsed.data;

  const listing = await inmuebleDelAgente(entrada.listingId, auth.agentId);
  if (!listing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });

  const anterior = await prisma.reporteGestion.findFirst({
    where: { listingId: listing.id, agentId: auth.agentId },
    orderBy: { periodoHasta: 'desc' },
    select: { periodoHasta: true },
  });
  const { desde, hasta } = periodoSiguiente(new Date(), DIAS_POR_PERIODO[entrada.periodicidad], anterior?.periodoHasta ?? null);
  const { datos } = await calcularDatosGestion(listing, entrada.periodicidad, desde, hasta);

  const creado = await prisma.reporteGestion.create({
    data: {
      agentId: auth.agentId,
      listingId: listing.id,
      periodicidad: entrada.periodicidad,
      periodoDesde: desde,
      periodoHasta: hasta,
      difusion: entrada.difusion,
      observaciones: entrada.observaciones,
      datos: datos as unknown as object,
    },
  });

  const fila = await gestionDelAgente(creado.id, auth.agentId);
  return NextResponse.json({ gestion: fila ? gestionParaAgente(fila) : null }, { status: 201 });
}

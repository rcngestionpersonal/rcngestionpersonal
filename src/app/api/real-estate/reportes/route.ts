import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { descifrarTexto } from '@/lib/real-estate/reportes/cifrado';
import { agenteConReportes } from '@/lib/real-estate/reportes/servidor';

// Datos de la pantalla de Reportes: el inventario del agente y el historial
// de reportes de cada inmueble (su expediente).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;

  const [inmuebles, visitas, gestiones, tasaciones, agente] = await Promise.all([
    prisma.listing.findMany({
      where: { managingAgentId: auth.agentId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        propertyType: true,
        operationType: true,
        city: true,
        zone: true,
        status: true,
        price: true,
        currency: true,
        areaM2: true,
        coverPhotoUrl: true,
        // Datos del propietario: solo los ve el agente que gestiona el inmueble,
        // y aqui solo sirven para prellenar el envio del reporte.
        ownerName: true,
        ownerPhone: true,
      },
    }),
    prisma.reporteVisita.findMany({
      where: { agentId: auth.agentId },
      orderBy: { visitadaAt: 'desc' },
      take: 200,
      select: {
        id: true,
        listingId: true,
        visitadaAt: true,
        reaccion: true,
        visitanteNombreCifrado: true,
        enviadoAt: true,
        foto: { select: { consentimientoRedes: true } },
      },
    }),
    prisma.reporteGestion.findMany({
      where: { agentId: auth.agentId },
      orderBy: { periodoHasta: 'desc' },
      take: 200,
      select: { id: true, listingId: true, periodicidad: true, periodoDesde: true, periodoHasta: true, enviadoAt: true, enviadoA: true },
    }),
    // Solo las tasaciones enviadas: las que se analizan sin enviar no se guardan.
    prisma.reporteTasacion.findMany({
      where: { agentId: auth.agentId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, listingId: true, titulo: true, sector: true, enviadoAt: true, enviadoA: true, createdAt: true },
    }),
    prisma.agent.findUnique({ where: { id: auth.agentId }, select: { email: true } }),
  ]);

  return NextResponse.json({
    inmuebles,
    visitas: visitas.map((v) => ({
      id: v.id,
      listingId: v.listingId,
      visitadaAt: v.visitadaAt.toISOString(),
      reaccion: v.reaccion,
      visitanteNombre: descifrarTexto(v.visitanteNombreCifrado) ?? '—',
      foto: v.foto ? { redes: v.foto.consentimientoRedes } : null,
      enviadoAt: v.enviadoAt?.toISOString() ?? null,
    })),
    gestiones: gestiones.map((g) => ({
      ...g,
      periodoDesde: g.periodoDesde.toISOString(),
      periodoHasta: g.periodoHasta.toISOString(),
      enviadoAt: g.enviadoAt?.toISOString() ?? null,
    })),
    tasaciones: tasaciones.map((t) => ({ ...t, enviadoAt: t.enviadoAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() })),
    tieneCorreo: Boolean(agente?.email),
  });
}

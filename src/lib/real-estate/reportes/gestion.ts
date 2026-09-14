import { prisma } from '@/lib/prisma';
import { diasEntre } from './estadistica';
import { fechasDeVisitaImpresas } from './gestion-datos';
import type { GestionImpresa } from './gestion-plantilla';
import { fechaImpresa } from './servidor';
import type { DatosGestion, EntradaDifusion, Periodicidad } from './tipos';

// Lectura de un reporte de gestion ya emitido. Lo que se imprime sale de
// "datos", congelado al emitir: el historial muestra lo que recibio el
// propietario, no un recalculo.

export async function gestionDelAgente(id: string, agentId: string) {
  const g = await prisma.reporteGestion.findUnique({ where: { id }, include: { listing: { select: { title: true, ownerPhone: true } } } });
  if (!g || g.agentId !== agentId) return null;
  return g;
}

type GestionFila = NonNullable<Awaited<ReturnType<typeof gestionDelAgente>>>;

function rango(desde: Date, hasta: Date): string {
  const opciones = { day: 'numeric', month: 'short', timeZone: 'America/Guayaquil' } as const;
  const anio = hasta.toLocaleDateString('es-EC', { year: 'numeric', timeZone: 'America/Guayaquil' });
  return `Del ${desde.toLocaleDateString('es-EC', opciones)} al ${hasta.toLocaleDateString('es-EC', opciones)} de ${anio}`;
}

export function gestionImpresa(g: GestionFila): GestionImpresa {
  const datos = g.datos as unknown as DatosGestion;
  return {
    datos,
    difusion: (g.difusion as unknown as EntradaDifusion[]) ?? [],
    observaciones: g.observaciones,
    periodoTexto: rango(g.periodoDesde, g.periodoHasta),
    fechasVisita: fechasDeVisitaImpresas(datos.visitas.fechas),
    emitidoEl: fechaImpresa(g.createdAt),
    diasPublicado: diasEntre(new Date(datos.inmueble.publicadoDesde), g.periodoHasta),
  };
}

export function gestionParaAgente(g: GestionFila) {
  return {
    id: g.id,
    listingId: g.listingId,
    inmueble: g.listing.title,
    periodicidad: g.periodicidad as Periodicidad,
    periodoDesde: g.periodoDesde.toISOString(),
    periodoHasta: g.periodoHasta.toISOString(),
    difusion: g.difusion as unknown as EntradaDifusion[],
    observaciones: g.observaciones,
    datos: g.datos as unknown as DatosGestion,
    paleta: g.paleta,
    enviadoAt: g.enviadoAt?.toISOString() ?? null,
    enviadoA: g.enviadoA,
    createdAt: g.createdAt.toISOString(),
  };
}

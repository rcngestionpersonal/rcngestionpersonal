import type { Listing } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { pricePerM2 } from '@/lib/real-estate/closed-deals-config';
import { actividadBaja, diasEntre, mediana, semanasDeGestion, visitasSinDuplicar } from './estadistica';
import { fechaCorta, operacionImpresa, sectorImpreso, tipoImpreso } from './servidor';
import {
  CANALES_DIFUSION,
  GESTION_LIMITES,
  GESTION_MINIMO_SIMILARES,
  TASACION_MINIMO_CIERRES,
  type DatosGestion,
  type EntradaDifusion,
  type Periodicidad,
} from './tipos';

// Datos del reporte de gestion. TODO sale del sistema: si una cifra no se puede
// medir, no se muestra. Nada de clientes ni de otros agentes llega aqui salvo
// como conteo agregado (punto 5.1).

export const difusionSchema = z
  .array(
    z.object({
      canal: z.enum(CANALES_DIFUSION),
      nombre: z.string().trim().min(1).max(GESTION_LIMITES.nombreCanal),
      enlace: z
        .string()
        .trim()
        .max(GESTION_LIMITES.enlace)
        .optional()
        .nullable()
        .transform((v) => (v ? v : null))
        .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), 'El enlace debe empezar con http:// o https://'),
    }),
  )
  .max(GESTION_LIMITES.difusionMaxima);

export type SenalActividad = { consultasPorSemana: number; promedioSector: number; similares: number };

export async function calcularDatosGestion(
  listing: Listing,
  periodicidad: Periodicidad,
  desde: Date,
  hasta: Date,
): Promise<{ datos: DatosGestion; senal: SenalActividad | null }> {
  const enPeriodo = { gte: desde, lte: hasta };

  const [visualizaciones, matches, contactados, reportesVisita, seguimientos, agendadas, negociacion, reportesHistoricos, seguimientosHistoricos, consultasTotales] =
    await Promise.all([
      // Vistas de la ficha del inmueble en el perfil profesional del agente.
      prisma.miniSitioVisita.count({ where: { listingId: listing.id, createdAt: enPeriodo } }),
      prisma.listingMatch.count({ where: { listingId: listing.id, createdAt: enPeriodo } }),
      // Consultas: matches en los que el agente del comprador contacto. De ellos
      // solo sale QUIEN es el agente, para contar colegas distintos; ningun
      // nombre llega al reporte.
      prisma.listingMatch.findMany({
        where: { listingId: listing.id, contactedAt: enPeriodo },
        select: { opportunity: { select: { claimedByAgentId: true, createdByAgentId: true } } },
      }),
      prisma.reporteVisita.findMany({ where: { listingId: listing.id, visitadaAt: enPeriodo }, select: { visitadaAt: true } }),
      prisma.listingMatch.findMany({ where: { listingId: listing.id, visitCompletedAt: enPeriodo }, select: { visitCompletedAt: true } }),
      prisma.listingMatch.count({ where: { listingId: listing.id, visitScheduledFor: enPeriodo } }),
      prisma.listingMatch.count({ where: { listingId: listing.id, offerInProgressAt: { not: null, lte: hasta }, closedWon: null } }),
      prisma.reporteVisita.findMany({ where: { listingId: listing.id, visitadaAt: { lte: hasta } }, select: { visitadaAt: true } }),
      prisma.listingMatch.findMany({ where: { listingId: listing.id, visitCompletedAt: { not: null, lte: hasta } }, select: { visitCompletedAt: true } }),
      prisma.listingMatch.count({ where: { listingId: listing.id, contactedAt: { not: null, lte: hasta } } }),
    ]);

  const colegas = new Set<string>();
  for (const c of contactados) {
    const id = c.opportunity.claimedByAgentId ?? c.opportunity.createdByAgentId;
    if (id && id !== listing.managingAgentId) colegas.add(id);
  }

  const visitas = visitasSinDuplicar(
    reportesVisita.map((v) => v.visitadaAt),
    seguimientos.map((s) => s.visitCompletedAt as Date),
  );
  const visitasTotales = visitasSinDuplicar(
    reportesHistoricos.map((v) => v.visitadaAt),
    seguimientosHistoricos.map((s) => s.visitCompletedAt as Date),
  );

  const { comparativo, promedioConsultasSector, similares } = await compararConSector(listing, desde, hasta);

  const semanasPeriodo = Math.max(1, (hasta.getTime() - desde.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const consultasPorSemana = contactados.length / semanasPeriodo;
  const senal = actividadBaja(consultasPorSemana, promedioConsultasSector, similares, GESTION_MINIMO_SIMILARES)
    ? { consultasPorSemana, promedioSector: promedioConsultasSector as number, similares }
    : null;

  return {
    datos: {
      inmueble: {
        titulo: listing.title,
        tipo: tipoImpreso(listing.propertyType),
        operacion: operacionImpresa(listing.operationType),
        sector: sectorImpreso(listing),
        precio: listing.price,
        moneda: listing.currency,
        metraje: listing.areaM2,
        publicadoDesde: listing.createdAt.toISOString(),
      },
      periodo: { desde: desde.toISOString(), hasta: hasta.toISOString(), periodicidad },
      actividad: { visualizaciones, matches, colegasInteresados: colegas.size },
      visitas: { cantidad: visitas.length, fechas: visitas.map((d) => d.toISOString()) },
      interesados: { consultas: contactados.length, visitasAgendadas: agendadas, enNegociacion: negociacion },
      comparativo,
      acumulado: {
        semanas: semanasDeGestion(listing.createdAt, hasta),
        visitas: visitasTotales.length,
        consultas: consultasTotales,
      },
    },
    senal,
  };
}

// Comparativo de mercado (punto 2.2.f): solo con muestra suficiente. De los
// otros inmuebles solo se leen fechas y conteos, nunca a quien pertenecen.
async function compararConSector(listing: Listing, desde: Date, hasta: Date) {
  if (!listing.zone) return { comparativo: null, promedioConsultasSector: null, similares: 0 };

  const [similares, cierres] = await Promise.all([
    prisma.listing.findMany({
      where: {
        id: { not: listing.id },
        zone: listing.zone,
        propertyType: listing.propertyType,
        operationType: listing.operationType,
        status: 'ACTIVE',
      },
      select: { id: true, createdAt: true },
      take: 500,
    }),
    prisma.closedDeal.findMany({
      where: { zone: listing.zone, propertyType: listing.propertyType, operationType: listing.operationType, declaredAccurate: true },
      select: { propertyType: true, price: true, areaM2: true, landAreaM2: true },
      take: 500,
    }),
  ]);

  const precios = cierres.map((c) => pricePerM2(c)).filter((x): x is number => typeof x === 'number' && x > 0);
  const hayCierres = precios.length >= TASACION_MINIMO_CIERRES;
  const haySimilares = similares.length >= GESTION_MINIMO_SIMILARES;

  let promedioConsultasSector: number | null = null;
  if (haySimilares) {
    const consultas = await prisma.listingMatch.count({
      where: { listingId: { in: similares.map((s) => s.id) }, contactedAt: { gte: desde, lte: hasta } },
    });
    const semanas = Math.max(1, (hasta.getTime() - desde.getTime()) / (7 * 24 * 60 * 60 * 1000));
    promedioConsultasSector = consultas / similares.length / semanas;
  }

  if (!haySimilares && !hayCierres) return { comparativo: null, promedioConsultasSector, similares: similares.length };

  return {
    comparativo: {
      similares: haySimilares ? similares.length : 0,
      diasPromedioPublicados: haySimilares
        ? Math.round(similares.reduce((s, x) => s + diasEntre(x.createdAt, hasta), 0) / similares.length)
        : null,
      precioM2Referencia: hayCierres ? Math.round(mediana(precios) as number) : null,
      cierresReferencia: hayCierres ? precios.length : 0,
    },
    promedioConsultasSector,
    similares: similares.length,
  };
}

// Lo que se imprime. Separado de los datos para que el historial muestre lo
// congelado y la plantilla no tenga que saber de fechas ISO.
export function fechasDeVisitaImpresas(fechas: string[]): string[] {
  return fechas.map((f) => fechaCorta(new Date(f)));
}

export function difusionPorDefecto(): EntradaDifusion[] {
  return [{ canal: 'REDINMO', nombre: 'Redinmo', enlace: null }];
}

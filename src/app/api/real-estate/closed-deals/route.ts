import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAgentEligible } from '@/lib/real-estate/matching';
import {
  createClosedDeal,
  findAgentById,
  isAgentActive,
  listClosedDeals,
  shouldUseMockStore,
} from '@/lib/real-estate/mock-store';
import { requiresAntiguedadYEstado, roundCoord, validateClosedDeal } from '@/lib/real-estate/closed-deals-config';
import { zoneCentroid } from '@/lib/real-estate/quito-zones';
import { awardClosingRegistered } from '@/lib/real-estate/points-log';

const closedDealSchema = z
  .object({
    operationType: z.enum(['SALE', 'RENT', 'BOTH']),
    propertyType: z.enum(['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM']),
    city: z.string().trim().optional(),
    zone: z.string().trim().min(1, 'La zona es obligatoria.'),
    sector: z.string().trim().min(1, 'El sector es obligatorio.'),
    microzona: z.string().trim().max(120).optional(),
    antiguedad: z.enum(['A_ESTRENAR', 'UNO_A_CINCO', 'SEIS_A_QUINCE', 'DIECISEIS_A_TREINTA', 'MAS_TREINTA']).optional(),
    estadoInmueble: z.enum(['EXCELENTE', 'BUENO', 'PARA_REMODELAR', 'OBRA_GRIS']).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    price: z.number(),
    publicationPrice: z.number().positive().optional(),
    currency: z.string().trim().optional(),
    areaM2: z.number().optional(),
    landAreaM2: z.number().optional(),
    bedrooms: z.number().int().nonnegative().optional(),
    bathrooms: z.number().int().nonnegative().optional(),
    parkingSpaces: z.number().int().nonnegative().optional(),
    timeOnMarket: z.enum(['MENOS_1', 'UNO_A_TRES', 'TRES_A_SEIS', 'SEIS_A_DOCE', 'MAS_DOCE']),
    paymentMethod: z.enum(['CONTADO', 'CREDITO', 'MIXTO', 'OTRO']),
    financialEntity: z.string().trim().optional(),
    approvalDelayed: z.boolean().optional(),
    closedAt: z.string(),
    declaredAccurate: z.literal(true, { errorMap: () => ({ message: 'Debes declarar que el cierre es real.' }) }),
  })
  .superRefine((data, ctx) => {
    // Terreno no requiere antiguedad ni estado del inmueble (no aplica el concepto de
    // "construccion" a un lote).
    if (!requiresAntiguedadYEstado(data.propertyType)) return;
    if (!data.antiguedad) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['antiguedad'], message: 'La antigüedad es obligatoria.' });
    }
    if (!data.estadoInmueble) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['estadoInmueble'], message: 'El estado del inmueble es obligatorio.' });
    }
  });

function requireActiveAgentOrAdmin(session: { role: string; agentId?: string }): boolean {
  if (session.role === 'admin') return true;
  if (!session.agentId) return false;
  if (shouldUseMockStore()) {
    const agent = findAgentById(session.agentId);
    return Boolean(agent && isAgentActive(agent));
  }
  return true;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (session.role === 'agent' && session.agentId && shouldUseMockStore()) {
    const agent = findAgentById(session.agentId);
    if (!agent || !isAgentActive(agent)) {
      return NextResponse.json(
        { error: 'Esta consulta está disponible solo para agentes activos (trial vigente y teléfono verificado).' },
        { status: 403 },
      );
    }
  }

  const city = request.nextUrl.searchParams.get('city') ?? undefined;
  const propertyType = request.nextUrl.searchParams.get('propertyType') ?? undefined;
  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '');
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 1000;
  // Bounding box para el mapa geografico: solo se piden los pins visibles en pantalla
  // (viewport), no toda la base de cierres. Los 4 parametros deben estar PRESENTES (no
  // solo numericos): Number(null) es 0, que es "finito" y activaria un bbox degenerado
  // si solo se chequeara Number.isFinite.
  const bboxKeys = ['south', 'west', 'north', 'east'] as const;
  const bboxRaw = bboxKeys.map((k) => request.nextUrl.searchParams.get(k));
  const bboxParams = bboxRaw.map((v) => Number(v));
  const bbox = bboxRaw.every((v) => v !== null) && bboxParams.every((n) => Number.isFinite(n))
    ? { south: bboxParams[0], west: bboxParams[1], north: bboxParams[2], east: bboxParams[3] }
    : undefined;

  if (shouldUseMockStore()) {
    return NextResponse.json({
      deals: listClosedDeals({ city, propertyType, viewerAgentId: session.agentId, bbox, limit }),
      fallback: true,
    });
  }

  try {
    if (session.role === 'agent' && session.agentId) {
      const dbAgent = await prisma.agent.findUnique({ where: { id: session.agentId } });
      if (!dbAgent || !isAgentEligible(dbAgent)) {
        return NextResponse.json(
          { error: 'Esta consulta está disponible solo para agentes activos (trial vigente y teléfono verificado).' },
          { status: 403 },
        );
      }
    }

    const deals = await prisma.closedDeal.findMany({
      where: {
        city: city ? { equals: city, mode: 'insensitive' } : undefined,
        propertyType: propertyType ? (propertyType as never) : undefined,
      },
      orderBy: { closedAt: 'desc' },
      take: bbox ? 5000 : limit,
    });

    // Cierres legacy sin coordenadas reciben el centroide aproximado de su zona
    // (estimatedLocation: true) para poder ubicarse en el mapa igual.
    let withLocation = deals.map(({ createdByAgentId, ...rest }) => {
      const hasCoords = typeof rest.latitude === 'number' && typeof rest.longitude === 'number';
      const centroid = !hasCoords && rest.zone ? zoneCentroid(rest.zone) : null;
      return {
        ...rest,
        latitude: hasCoords ? rest.latitude : centroid ? centroid[0] : rest.latitude,
        longitude: hasCoords ? rest.longitude : centroid ? centroid[1] : rest.longitude,
        estimatedLocation: !hasCoords && Boolean(centroid),
        canEdit: Boolean(session.agentId) && createdByAgentId === session.agentId,
      };
    });

    if (bbox) {
      withLocation = withLocation
        .filter((d) => typeof d.latitude === 'number' && typeof d.longitude === 'number')
        .filter((d) => d.latitude! >= bbox.south && d.latitude! <= bbox.north && d.longitude! >= bbox.west && d.longitude! <= bbox.east)
        .slice(0, limit);
    }

    return NextResponse.json({ deals: withLocation });
  } catch {
    return NextResponse.json({
      deals: listClosedDeals({ city, propertyType, viewerAgentId: session.agentId, bbox, limit }),
      fallback: true,
    });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = closedDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos invalidos.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;
  // Privacidad por diseno: redondeo a 3 decimales (~110m) antes de persistir, para que
  // ningun cierre sea rastreable a una direccion/casa especifica.
  if (typeof input.latitude === 'number') input.latitude = roundCoord(input.latitude);
  if (typeof input.longitude === 'number') input.longitude = roundCoord(input.longitude);

  const { errors } = validateClosedDeal({
    propertyType: input.propertyType,
    price: input.price,
    publicationPrice: input.publicationPrice,
    areaM2: input.areaM2,
    landAreaM2: input.landAreaM2,
    closedAt: input.closedAt,
    details: input.details,
  });
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Datos invalidos.', details: errors }, { status: 400 });
  }

  if (shouldUseMockStore()) {
    if (!requireActiveAgentOrAdmin(session)) {
      return NextResponse.json(
        { error: 'Solo agentes activos (trial vigente y teléfono verificado) pueden registrar cierres.' },
        { status: 403 },
      );
    }
    const deal = createClosedDeal({ ...input, city: input.city ?? 'Quito', createdByAgentId: session.agentId });
    const safeDeal: Record<string, unknown> = { ...deal };
    delete safeDeal.createdByAgentId;
    return NextResponse.json({ deal: { ...safeDeal, canEdit: true }, fallback: true }, { status: 201 });
  }

  try {
    if (session.role === 'agent' && session.agentId) {
      const dbAgent = await prisma.agent.findUnique({ where: { id: session.agentId } });
      if (!dbAgent || !isAgentEligible(dbAgent)) {
        return NextResponse.json(
          { error: 'Solo agentes activos (trial vigente y teléfono verificado) pueden registrar cierres.' },
          { status: 403 },
        );
      }
    }

    // createdByAgentId se guarda solo para permitir que el propio agente edite su registro
    // despues; nunca se devuelve en las respuestas de la API (ver GET arriba).
    const deal = await prisma.closedDeal.create({
      data: {
        operationType: input.operationType,
        propertyType: input.propertyType,
        city: input.city ?? 'Quito',
        zone: input.zone,
        sector: input.sector,
        microzona: input.microzona,
        antiguedad: input.antiguedad,
        estadoInmueble: input.estadoInmueble,
        details: input.details as never,
        latitude: input.latitude,
        longitude: input.longitude,
        price: input.price,
        publicationPrice: input.publicationPrice,
        currency: input.currency ?? 'USD',
        areaM2: input.areaM2,
        landAreaM2: input.landAreaM2,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        parkingSpaces: input.parkingSpaces,
        timeOnMarket: input.timeOnMarket,
        paymentMethod: input.paymentMethod,
        financialEntity: input.financialEntity,
        approvalDelayed: input.approvalDelayed,
        declaredAccurate: input.declaredAccurate,
        closedAt: new Date(input.closedAt),
        createdByAgentId: session.agentId,
      },
    });

    if (session.agentId) await awardClosingRegistered(session.agentId, deal.id);

    const safeDeal: Record<string, unknown> = { ...deal };
    delete safeDeal.createdByAgentId;
    return NextResponse.json({ deal: { ...safeDeal, canEdit: true } }, { status: 201 });
  } catch {
    const deal = createClosedDeal({ ...input, city: input.city ?? 'Quito', createdByAgentId: session.agentId });
    const safeDeal: Record<string, unknown> = { ...deal };
    delete safeDeal.createdByAgentId;
    return NextResponse.json({ deal: { ...safeDeal, canEdit: true }, fallback: true }, { status: 201 });
  }
}

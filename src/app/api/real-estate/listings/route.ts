import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAgentEligible } from '@/lib/real-estate/matching';
import {
  createListingAndMatch,
  findAgentById,
  isAgentActive,
  listListings,
  shouldUseMockStore,
} from '@/lib/real-estate/mock-store';
import { matchListingAgainstOpportunitiesPrisma } from '@/lib/real-estate/listing-match-prisma';
import { awardListingCreated } from '@/lib/real-estate/points-log';
import { redactListingOwnerInfo } from '@/lib/real-estate/privacy';

const listingSchema = z.object({
  title: z.string().trim().min(2, 'El titulo es obligatorio.'),
  operationType: z.enum(['SALE', 'RENT', 'BOTH']),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER']),
  city: z.string().trim().min(2, 'La ciudad es obligatoria.'),
  zone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  price: z.number().positive('El precio debe ser mayor a cero.'),
  currency: z.string().trim().optional(),
  areaM2: z.number().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  parkingSpaces: z.number().int().nonnegative().optional(),
  description: z.string().trim().optional(),
  // Campos condicionales por tipo (Fase 8, Bloque A) - todos opcionales, ver
  // src/lib/real-estate/listing-fields.ts para los valores permitidos de cada
  // enum-como-string. Nunca filtran ni ponderan el matching (Bloque B).
  esIndependiente: z.boolean().optional(),
  antiguedad: z.string().trim().optional(),
  amoblado: z.string().trim().optional(),
  alicuotaMensual: z.number().nonnegative().optional(),
  piso: z.number().int().optional(),
  tieneAscensor: z.boolean().optional(),
  areasComunales: z.boolean().optional(),
  esquineroOMedianero: z.string().trim().optional(),
  usoSueloTerreno: z.string().trim().optional(),
  pisosPermitidos: z.number().int().nonnegative().optional(),
  serviciosBasicos: z.string().trim().optional(),
  frenteM: z.number().positive().optional(),
  nivelLocal: z.string().trim().optional(),
  distribucionLocal: z.string().trim().optional(),
  estadoOcupacion: z.string().trim().optional(),
  canonMensualActual: z.number().nonnegative().optional(),
  alturaLibreM: z.number().positive().optional(),
  accesoCamion: z.boolean().optional(),
  terrenoTotalM2: z.number().positive().optional(),
  areaLibrePropiaM2: z.number().positive().optional(),
  terrenoLibreExclusivoM2: z.number().positive().optional(),
  // Espacios adicionales / medios banos / balcon (Fase 8, Bloque B, seccion 1.2).
  espaciosAdicionales: z.number().int().nonnegative().optional(),
  mediosBanos: z.number().int().nonnegative().optional(),
  balconOTerraza: z.boolean().optional(),
  ownerName: z.string().trim().max(120).optional(),
  ownerPhone: z.string().trim().max(40).optional(),
  commissionSharePercent: z.number().min(0).max(100).optional(),
  managingAgentId: z.string().optional(),
  referredByAgentId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const onlyMine = request.nextUrl.searchParams.get('mine') === 'true';
  const managingAgentId = onlyMine && session.role === 'agent' ? session.agentId : undefined;
  const viewerAgentId = session.agentId;

  if (shouldUseMockStore()) {
    const listings = listListings({ managingAgentId }).map((l) => redactListingOwnerInfo(l, viewerAgentId));
    return NextResponse.json({ listings, fallback: true });
  }

  try {
    const listings = await prisma.listing.findMany({
      where: managingAgentId ? { managingAgentId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        managingAgent: { select: { id: true, fullName: true, phone: true } },
        referredByAgent: { select: { id: true, fullName: true, phone: true } },
        matches: {
          orderBy: { score: 'desc' },
          include: { opportunity: true },
        },
      },
    });

    // El frontend espera estos campos "aplanados" directamente en cada match
    // (igual que el mock-store), no solo anidados bajo match.opportunity/.listing.
    const shaped = listings.map((listing) => ({
      ...redactListingOwnerInfo(listing, viewerAgentId),
      matches: listing.matches.map((match) => ({
        ...match,
        listingTitle: listing.title,
        managingAgentId: listing.managingAgentId,
        referredByAgentId: listing.referredByAgentId ?? undefined,
        opportunitySummary: match.opportunity?.summary,
        createdByAgentId: match.opportunity?.createdByAgentId ?? undefined,
      })),
    }));

    return NextResponse.json({ listings: shaped });
  } catch {
    const listings = listListings({ managingAgentId }).map((l) => redactListingOwnerInfo(l, viewerAgentId));
    return NextResponse.json({ listings, fallback: true });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos invalidos.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;

  let managingAgentId: string;
  let referredByAgentId: string | undefined;

  if (session.role === 'agent') {
    if (!session.agentId) {
      return NextResponse.json({ error: 'Sesion de agente invalida.' }, { status: 403 });
    }
    if (input.managingAgentId && input.managingAgentId !== session.agentId) {
      managingAgentId = input.managingAgentId;
      referredByAgentId = session.agentId;
    } else {
      managingAgentId = session.agentId;
      referredByAgentId = undefined;
    }
  } else {
    if (!input.managingAgentId) {
      return NextResponse.json({ error: 'managingAgentId es obligatorio para el admin.' }, { status: 400 });
    }
    managingAgentId = input.managingAgentId;
    referredByAgentId = input.referredByAgentId;
  }

  if (shouldUseMockStore()) {
    if (session.role === 'agent' && session.agentId) {
      const agent = findAgentById(session.agentId);
      if (!agent || !isAgentActive(agent)) {
        return NextResponse.json(
          { error: 'Tu cuenta debe estar activa (trial vigente o suscripción) para cargar inmuebles.' },
          { status: 403 },
        );
      }
    }

    const result = await createListingAndMatch({ ...input, managingAgentId, referredByAgentId });
    return NextResponse.json(
      { listing: result.listing, totalListingMatches: result.totalListingMatches, fallback: true },
      { status: 201 },
    );
  }

  try {
    if (session.role === 'agent' && session.agentId) {
      const dbAgent = await prisma.agent.findUnique({ where: { id: session.agentId } });
      if (!dbAgent || !isAgentEligible(dbAgent)) {
        return NextResponse.json(
          { error: 'Tu cuenta debe estar activa (trial vigente o suscripción) para cargar inmuebles.' },
          { status: 403 },
        );
      }
    }

    const listing = await prisma.listing.create({
      data: {
        title: input.title,
        operationType: input.operationType,
        propertyType: input.propertyType,
        city: input.city,
        zone: input.zone,
        address: input.address,
        price: input.price,
        currency: input.currency ?? 'USD',
        areaM2: input.areaM2,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        parkingSpaces: input.parkingSpaces,
        description: input.description,
        esIndependiente: input.esIndependiente,
        antiguedad: input.antiguedad,
        amoblado: input.amoblado,
        alicuotaMensual: input.alicuotaMensual,
        piso: input.piso,
        tieneAscensor: input.tieneAscensor,
        areasComunales: input.areasComunales,
        esquineroOMedianero: input.esquineroOMedianero,
        usoSueloTerreno: input.usoSueloTerreno,
        pisosPermitidos: input.pisosPermitidos,
        serviciosBasicos: input.serviciosBasicos,
        frenteM: input.frenteM,
        nivelLocal: input.nivelLocal,
        distribucionLocal: input.distribucionLocal,
        estadoOcupacion: input.estadoOcupacion,
        canonMensualActual: input.canonMensualActual,
        alturaLibreM: input.alturaLibreM,
        accesoCamion: input.accesoCamion,
        terrenoTotalM2: input.terrenoTotalM2,
        areaLibrePropiaM2: input.areaLibrePropiaM2,
        terrenoLibreExclusivoM2: input.terrenoLibreExclusivoM2,
        espaciosAdicionales: input.espaciosAdicionales,
        mediosBanos: input.mediosBanos,
        balconOTerraza: input.balconOTerraza,
        ownerName: input.ownerName,
        ownerPhone: input.ownerPhone,
        commissionSharePercent: input.commissionSharePercent ?? 0,
        managingAgentId,
        referredByAgentId,
      },
    });
    const totalListingMatches = await matchListingAgainstOpportunitiesPrisma(listing);
    await awardListingCreated(managingAgentId, listing.id);
    return NextResponse.json({ listing, totalListingMatches }, { status: 201 });
  } catch {
    const result = await createListingAndMatch({ ...input, managingAgentId, referredByAgentId });
    return NextResponse.json(
      { listing: result.listing, totalListingMatches: result.totalListingMatches, fallback: true },
      { status: 201 },
    );
  }
}

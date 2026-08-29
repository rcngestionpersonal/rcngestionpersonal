import { NextRequest, NextResponse } from 'next/server';
import { LeadStage, MatchStatus, SubscriptionStatus } from '@prisma/client';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAgentEligible, scoreAgentForOpportunity, shouldNotify } from '@/lib/real-estate/matching';
import {
  createOpportunityByAgent,
  findAgentById,
  isAgentActive,
  listOpportunities,
  shouldUseMockStore,
} from '@/lib/real-estate/mock-store';
import { matchOpportunityAgainstListingsPrisma } from '@/lib/real-estate/listing-match-prisma';
import { operationActionLabelEs, propertyTypeLabelEs } from '@/lib/real-estate/labels';
import { awardPedidoCreated } from '@/lib/real-estate/points-log';
import { redactOpportunityBuyerInfo } from '@/lib/real-estate/privacy';

const opportunitySchema = z.object({
  operationType: z.enum(['SALE', 'RENT', 'BOTH']),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER']),
  city: z.string().trim().min(2, 'La ciudad es obligatoria.'),
  zone: z.string().trim().optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  // "Al menos" (minimo deseado), nunca valor exacto - seccion 3.1. Reusan las
  // mismas columnas de Opportunity que ya existian pero nunca se exponian.
  areaM2: z.number().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  parkingSpaces: z.number().int().nonnegative().optional(),
  // Interruptores de preferencia (seccion 3.2): 'SI' | 'NO', ausente = indiferente.
  prefAreaVerdeAmplia: z.enum(['SI', 'NO']).optional(),
  prefAreasComunales: z.enum(['SI', 'NO']).optional(),
  prefAscensor: z.enum(['SI', 'NO']).optional(),
  prefAmoblado: z.enum(['SI', 'NO']).optional(),
  prefTodosLosServicios: z.enum(['SI', 'NO']).optional(),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const viewerAgentId = session?.agentId;
  const params = request.nextUrl.searchParams;
  const stage = params.get('stage') as LeadStage | null;
  const limit = Number(params.get('limit') ?? '20');

  try {
    if (shouldUseMockStore()) {
      const opportunities = listOpportunities(Number.isFinite(limit) ? limit : 20, stage).map((op) =>
        redactOpportunityBuyerInfo(op, viewerAgentId),
      );
      return NextResponse.json({ opportunities, fallback: true });
    }

    const opportunities = await prisma.opportunity.findMany({
      where: stage ? { stage } : undefined,
      take: Number.isFinite(limit) ? Math.min(limit, 100) : 20,
      orderBy: { createdAt: 'desc' },
      include: {
        claimedByAgent: true,
        matches: {
          orderBy: { score: 'desc' },
          include: { agent: true },
        },
        listingMatches: {
          orderBy: { score: 'desc' },
          include: { listing: true },
        },
      },
    });

    // El frontend espera estos campos "aplanados" directamente en cada listingMatch
    // (igual que el mock-store), no solo anidados bajo listingMatch.listing/.opportunity.
    const shaped = opportunities.map((op) => ({
      ...redactOpportunityBuyerInfo(op, viewerAgentId),
      listingMatches: op.listingMatches.map((lm) => ({
        ...lm,
        listingTitle: lm.listing?.title,
        managingAgentId: lm.listing?.managingAgentId,
        referredByAgentId: lm.listing?.referredByAgentId ?? undefined,
        opportunitySummary: op.summary,
        createdByAgentId: op.createdByAgentId ?? undefined,
      })),
    }));

    return NextResponse.json({ opportunities: shaped });
  } catch {
    const opportunities = listOpportunities(Number.isFinite(limit) ? limit : 20, stage).map((op) =>
      redactOpportunityBuyerInfo(op, viewerAgentId),
    );
    return NextResponse.json({ opportunities, fallback: true });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = opportunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos invalidos.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const createdByAgentId = session.role === 'agent' ? session.agentId : undefined;
  if (session.role === 'agent' && !createdByAgentId) {
    return NextResponse.json({ error: 'Sesion de agente invalida.' }, { status: 403 });
  }

  if (shouldUseMockStore()) {
    if (createdByAgentId) {
      const agent = findAgentById(createdByAgentId);
      if (!agent || !isAgentActive(agent)) {
        return NextResponse.json(
          { error: 'Tu cuenta debe estar activa (trial vigente o suscripción) para cargar pedidos.' },
          { status: 403 },
        );
      }
    }

    const result = await createOpportunityByAgent({ ...input, createdByAgentId });
    return NextResponse.json(
      {
        opportunity: result.opportunity,
        totalAgentMatches: result.totalAgentMatches,
        totalListingMatches: result.totalListingMatches,
        fallback: true,
      },
      { status: 201 },
    );
  }

  try {
    if (createdByAgentId) {
      const dbAgent = await prisma.agent.findUnique({ where: { id: createdByAgentId } });
      if (!dbAgent || !isAgentEligible(dbAgent)) {
        return NextResponse.json(
          { error: 'Tu cuenta debe estar activa (trial vigente o suscripción) para cargar pedidos.' },
          { status: 403 },
        );
      }
    }

    const summary = `Pedido cargado manualmente: busca ${operationActionLabelEs(input.operationType)} ${propertyTypeLabelEs(input.propertyType)} en ${input.city}${input.zone ? ` - ${input.zone}` : ''}.`;

    const opportunity = await prisma.opportunity.create({
      data: {
        operationType: input.operationType,
        propertyType: input.propertyType,
        city: input.city,
        zone: input.zone,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        areaM2: input.areaM2,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        parkingSpaces: input.parkingSpaces,
        prefAreaVerdeAmplia: input.prefAreaVerdeAmplia,
        prefAreasComunales: input.prefAreasComunales,
        prefAscensor: input.prefAscensor,
        prefAmoblado: input.prefAmoblado,
        prefTodosLosServicios: input.prefTodosLosServicios,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        summary,
        createdByAgentId,
        extractedData: { source: 'agent_manual' },
      },
    });

    const activeAgents = await prisma.agent.findMany({
      where: { isActive: true, subscriptionStatus: { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] } },
    });

    let totalAgentMatches = 0;
    for (const agent of activeAgents) {
      const { score, reasons } = scoreAgentForOpportunity(agent, opportunity);
      if (!shouldNotify(score)) continue;
      await prisma.agentMatch.create({
        data: { opportunityId: opportunity.id, agentId: agent.id, score, reasons, status: MatchStatus.CONTACTED },
      });
      totalAgentMatches += 1;
    }

    const totalListingMatches = await matchOpportunityAgainstListingsPrisma(opportunity);
    if (createdByAgentId) await awardPedidoCreated(createdByAgentId, opportunity.id);

    return NextResponse.json({ opportunity, totalAgentMatches, totalListingMatches }, { status: 201 });
  } catch {
    const result = await createOpportunityByAgent({ ...input, createdByAgentId });
    return NextResponse.json(
      {
        opportunity: result.opportunity,
        totalAgentMatches: result.totalAgentMatches,
        totalListingMatches: result.totalListingMatches,
        fallback: true,
      },
      { status: 201 },
    );
  }
}

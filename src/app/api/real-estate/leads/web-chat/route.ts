import { MatchStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { scoreAgentForOpportunity, shouldNotify } from '@/lib/real-estate/matching';
import { ingestWebChatLead, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { matchOpportunityAgainstListingsPrisma } from '@/lib/real-estate/listing-match-prisma';
import { operationActionLabelEs, propertyTypeLabelEs } from '@/lib/real-estate/labels';

const leadSchema = z.object({
  operationType: z.enum(['SALE', 'RENT', 'BOTH']),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER']),
  city: z.string().trim().min(2, 'La ciudad es obligatoria.'),
  zone: z.string().trim().min(1).optional(),
  budget: z.number().positive().optional(),
  contactName: z.string().trim().min(2, 'El nombre es obligatorio.'),
  contactPhone: z.string().trim().min(6, 'El teléfono es obligatorio.'),
  contactEmail: z.string().trim().email().optional(),
});

function summaryFor(input: z.infer<typeof leadSchema>): string {
  const zoneText = input.zone ? ` - ${input.zone}` : '';
  return `${input.contactName} busca ${operationActionLabelEs(input.operationType)} ${propertyTypeLabelEs(input.propertyType)} en ${input.city}${zoneText}.`;
}

function notificationTextForAgent(opportunitySummary: string, score: number): string {
  return [
    'Nuevo lead desde el chat web de Redinmo.',
    `Resumen: ${opportunitySummary}`,
    `Score de afinidad: ${score.toFixed(1)}%`,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos invalidos.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const budgetMin = input.budget;
  const budgetMax = input.budget;

  if (shouldUseMockStore()) {
    const result = await ingestWebChatLead({
      operationType: input.operationType,
      propertyType: input.propertyType,
      city: input.city,
      zone: input.zone,
      budgetMin,
      budgetMax,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
    });
    return NextResponse.json({
      success: true,
      matched: result.totalMatches > 0 || result.totalListingMatches > 0,
      fallback: true,
    });
  }

  try {
    const activeAgents = await prisma.agent.findMany({
      where: {
        isActive: true,
        subscriptionStatus: { in: ['TRIAL', 'ACTIVE'] },
      },
    });

    const opportunity = await prisma.opportunity.create({
      data: {
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        operationType: input.operationType,
        propertyType: input.propertyType,
        city: input.city,
        zone: input.zone,
        budgetMin,
        budgetMax,
        summary: summaryFor(input),
        extractedData: { source: 'web_chat', contactEmail: input.contactEmail ?? null },
      },
    });

    let totalMatches = 0;

    for (const agent of activeAgents) {
      const { score, reasons } = scoreAgentForOpportunity(agent, opportunity);
      if (!shouldNotify(score)) continue;

      const createdMatch = await prisma.agentMatch.create({
        data: {
          opportunityId: opportunity.id,
          agentId: agent.id,
          score,
          reasons,
          status: MatchStatus.CONTACTED,
        },
      });
      totalMatches += 1;

      const outboundBody = notificationTextForAgent(opportunity.summary, score);

      await prisma.notificationLog.create({
        data: {
          channel: 'app',
          content: outboundBody,
          status: 'SENT',
          sentAt: new Date(),
          agentId: agent.id,
          opportunityId: opportunity.id,
          matchId: createdMatch.id,
        },
      });
    }

    await prisma.eventLog.create({
      data: {
        entityType: 'opportunity',
        entityId: opportunity.id,
        eventType: 'created_from_web_chat',
        payload: { contactPhone: opportunity.contactPhone },
      },
    });

    const totalListingMatches = await matchOpportunityAgainstListingsPrisma(opportunity);

    return NextResponse.json({ success: true, matched: totalMatches > 0 || totalListingMatches > 0 });
  } catch {
    const result = await ingestWebChatLead({
      operationType: input.operationType,
      propertyType: input.propertyType,
      city: input.city,
      zone: input.zone,
      budgetMin,
      budgetMax,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
    });
    return NextResponse.json({
      success: true,
      matched: result.totalMatches > 0 || result.totalListingMatches > 0,
      fallback: true,
    });
  }
}

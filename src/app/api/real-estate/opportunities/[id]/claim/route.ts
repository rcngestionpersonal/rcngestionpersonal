import { NextRequest, NextResponse } from 'next/server';
import { LeadStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { claimOpportunity, findAgentById, isAgentActive, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { isAgentEligible } from '@/lib/real-estate/matching';
import { getSessionFromRequest } from '@/lib/auth';
import { redactOpportunityBuyerInfo } from '@/lib/real-estate/privacy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const body = (await request.json()) as {
      agentId?: string;
      referredByAgentId?: string;
      referralCommissionPercent?: number;
    };

    if (!body.agentId) {
      return NextResponse.json({ error: 'agentId es requerido.' }, { status: 400 });
    }

    if (session.role === 'agent' && session.agentId !== body.agentId) {
      return NextResponse.json({ error: 'Un agente solo puede reclamar para su propio usuario.' }, { status: 403 });
    }

    if (session.role === 'agent') {
      if (shouldUseMockStore()) {
        const agent = findAgentById(body.agentId);
        if (!agent || !isAgentActive(agent)) {
          return NextResponse.json(
            { error: 'Solo agentes activos (trial vigente y teléfono verificado) pueden reclamar pedidos.' },
            { status: 403 },
          );
        }
      } else {
        const dbAgent = await prisma.agent.findUnique({ where: { id: body.agentId } });
        if (!dbAgent || !isAgentEligible(dbAgent)) {
          return NextResponse.json(
            { error: 'Solo agentes activos (trial vigente y teléfono verificado) pueden reclamar pedidos.' },
            { status: 403 },
          );
        }
      }
    }

    const referredByAgentId = body.referredByAgentId && body.referredByAgentId !== body.agentId ? body.referredByAgentId : undefined;
    const referralCommissionPercent = referredByAgentId ? body.referralCommissionPercent : undefined;

    let opportunity;
    try {
      opportunity = await prisma.opportunity.update({
        where: { id },
        data: {
          claimedByAgentId: body.agentId,
          referredByAgentId,
          referralCommissionPercent,
          stage: LeadStage.ACTIVE_MATCH,
        },
        include: { claimedByAgent: true },
      });

      await prisma.interactionLog.create({
        data: {
          opportunityId: opportunity.id,
          agentId: body.agentId,
          type: 'opportunity_claimed',
          detail: referredByAgentId
            ? 'El agente tomo la oportunidad para seguimiento (referida por otro agente).'
            : 'El agente tomo la oportunidad para seguimiento.',
        },
      });
    } catch {
      opportunity = claimOpportunity(id, body.agentId, { referredByAgentId, referralCommissionPercent });
    }

    if (!opportunity) {
      return NextResponse.json({ error: 'Oportunidad no encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ opportunity: redactOpportunityBuyerInfo(opportunity, session.agentId) });
  } catch {
    return NextResponse.json({ error: 'No se pudo reclamar la oportunidad.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { LeadStage, MatchStatus, SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getDashboardData, shouldUseMockStore } from '@/lib/real-estate/mock-store';

export async function GET() {
  if (shouldUseMockStore()) {
    return NextResponse.json({ ...getDashboardData(), fallback: true });
  }

  try {
    const [
      totalMessages,
      totalMatches,
      activeAgents,
      opportunitiesByStage,
      responses,
      topZones,
      subscriptionBreakdown,
    ] = await Promise.all([
      prisma.opportunity.count(),
      prisma.agentMatch.count(),
      prisma.agent.count({ where: { isActive: true, isTestUser: false } }),
      prisma.opportunity.groupBy({ by: ['stage'], _count: true }),
      prisma.interactionLog.count({ where: { type: 'agent_response' } }),
      prisma.opportunity.groupBy({ by: ['city'], _count: true, orderBy: { _count: { city: 'desc' } }, take: 5 }),
      prisma.agent.groupBy({ by: ['subscriptionStatus'], _count: true }),
    ]);

    const activeMatches = opportunitiesByStage.find((x) => x.stage === LeadStage.ACTIVE_MATCH)?._count ?? 0;
    const closed = opportunitiesByStage.find((x) => x.stage === LeadStage.CLOSED)?._count ?? 0;
    const discarded = opportunitiesByStage.find((x) => x.stage === LeadStage.DISCARDED)?._count ?? 0;

    const responseRate = totalMatches > 0 ? Number(((responses / totalMatches) * 100).toFixed(2)) : 0;

    const trialAgents = subscriptionBreakdown.find((x) => x.subscriptionStatus === SubscriptionStatus.TRIAL)?._count ?? 0;
    const paidAgents = subscriptionBreakdown.find((x) => x.subscriptionStatus === SubscriptionStatus.ACTIVE)?._count ?? 0;
    const churnedAgents = subscriptionBreakdown.find((x) => x.subscriptionStatus === SubscriptionStatus.CANCELED)?._count ?? 0;

    const contactedMatches = await prisma.agentMatch.count({
      where: { status: MatchStatus.CONTACTED },
    });

    return NextResponse.json({
      metrics: {
        totalMessages,
        totalMatches,
        contactedMatches,
        responseRate,
        activeAgents,
        activeMatches,
        closed,
        discarded,
        trialAgents,
        paidAgents,
        churnedAgents,
      },
      topZones,
    });
  } catch {
    return NextResponse.json({ ...getDashboardData(), fallback: true });
  }
}

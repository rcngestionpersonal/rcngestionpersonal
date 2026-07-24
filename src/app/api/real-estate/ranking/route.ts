import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAgentRanking, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { buildRanking, milestonePoints } from '@/lib/real-estate/ranking';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (shouldUseMockStore()) {
    return NextResponse.json({ ranking: getAgentRanking(), fallback: true });
  }

  try {
    const [listings, opportunities, matches, closedDeals] = await Promise.all([
      prisma.listing.findMany({ select: { managingAgentId: true } }),
      prisma.opportunity.findMany({ select: { id: true, createdByAgentId: true } }),
      prisma.listingMatch.findMany({
        select: {
          opportunityId: true,
          contactedAt: true,
          infoSentAt: true,
          visitFollowUpAt: true,
          visitScheduledFor: true,
          visitCompletedAt: true,
          offerInProgressAt: true,
          closedWon: true,
          listing: { select: { managingAgentId: true } },
        },
      }),
      prisma.closedDeal.findMany({ select: { createdByAgentId: true } }),
    ]);

    const opportunityOwner = new Map<string, string>();
    for (const o of opportunities) if (o.createdByAgentId) opportunityOwner.set(o.id, o.createdByAgentId);

    const listingsCount = new Map<string, number>();
    for (const l of listings) listingsCount.set(l.managingAgentId, (listingsCount.get(l.managingAgentId) ?? 0) + 1);

    const pedidosCount = new Map<string, number>();
    for (const o of opportunities) {
      if (!o.createdByAgentId) continue;
      pedidosCount.set(o.createdByAgentId, (pedidosCount.get(o.createdByAgentId) ?? 0) + 1);
    }

    const matchesCount = new Map<string, number>();
    const milestonePointsByAgent = new Map<string, number>();
    for (const m of matches) {
      const managingAgentId = m.listing.managingAgentId;
      matchesCount.set(managingAgentId, (matchesCount.get(managingAgentId) ?? 0) + 1);
      const ownerAgentId = opportunityOwner.get(m.opportunityId);
      if (ownerAgentId) {
        if (ownerAgentId !== managingAgentId) {
          matchesCount.set(ownerAgentId, (matchesCount.get(ownerAgentId) ?? 0) + 1);
        }
        const pts = milestonePoints(m);
        if (pts > 0) milestonePointsByAgent.set(ownerAgentId, (milestonePointsByAgent.get(ownerAgentId) ?? 0) + pts);
      }
    }

    const closedDealsCount = new Map<string, number>();
    for (const d of closedDeals) {
      if (!d.createdByAgentId) continue;
      closedDealsCount.set(d.createdByAgentId, (closedDealsCount.get(d.createdByAgentId) ?? 0) + 1);
    }

    const agentIds = new Set<string>([
      ...listingsCount.keys(),
      ...pedidosCount.keys(),
      ...matchesCount.keys(),
      ...milestonePointsByAgent.keys(),
      ...closedDealsCount.keys(),
    ]);

    const agentRecords = await prisma.agent.findMany({
      where: { id: { in: [...agentIds] } },
      select: { id: true, fullName: true },
    });
    const nameOf = (id: string) => agentRecords.find((a) => a.id === id)?.fullName ?? id;

    const ranking = buildRanking(
      [...agentIds].map((agentId) => ({
        agentId,
        agentName: nameOf(agentId),
        listings: listingsCount.get(agentId) ?? 0,
        pedidos: pedidosCount.get(agentId) ?? 0,
        matches: matchesCount.get(agentId) ?? 0,
        milestonePoints: milestonePointsByAgent.get(agentId) ?? 0,
        closedDeals: closedDealsCount.get(agentId) ?? 0,
      })),
    );

    return NextResponse.json({ ranking });
  } catch {
    return NextResponse.json({ ranking: getAgentRanking(), fallback: true });
  }
}

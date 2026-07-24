import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlatformStats, shouldUseMockStore, type AgentStatEntry } from '@/lib/real-estate/mock-store';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador puede ver estas estadisticas.' }, { status: 403 });
  }

  if (shouldUseMockStore()) {
    return NextResponse.json({ stats: getPlatformStats(), fallback: true });
  }

  try {
    const [listings, opportunities, matches, totalClosedDeals] = await Promise.all([
      prisma.listing.findMany({ select: { managingAgentId: true } }),
      prisma.opportunity.findMany({ select: { id: true, createdByAgentId: true } }),
      prisma.listingMatch.findMany({
        select: { opportunityId: true, visitScheduledFor: true, closedWon: true, infoSentAt: true, contactedAt: true },
      }),
      prisma.closedDeal.count(),
    ]);

    const opportunityOwner = new Map<string, string>();
    for (const o of opportunities) if (o.createdByAgentId) opportunityOwner.set(o.id, o.createdByAgentId);

    const agentIds = new Set<string>();
    for (const l of listings) agentIds.add(l.managingAgentId);
    for (const o of opportunities) if (o.createdByAgentId) agentIds.add(o.createdByAgentId);

    const agentRecords = await prisma.agent.findMany({
      where: { id: { in: [...agentIds] } },
      select: { id: true, fullName: true },
    });
    const nameOf = (id: string) => agentRecords.find((a) => a.id === id)?.fullName ?? id;

    function topBy(counter: Map<string, number>, limit = 5): AgentStatEntry[] {
      return [...counter.entries()]
        .map(([agentId, value]) => ({ agentId, agentName: nameOf(agentId), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    }

    const listingsCount = new Map<string, number>();
    for (const l of listings) listingsCount.set(l.managingAgentId, (listingsCount.get(l.managingAgentId) ?? 0) + 1);

    const opportunitiesCount = new Map<string, number>();
    for (const o of opportunities) {
      if (!o.createdByAgentId) continue;
      opportunitiesCount.set(o.createdByAgentId, (opportunitiesCount.get(o.createdByAgentId) ?? 0) + 1);
    }

    const visitsCount = new Map<string, number>();
    const closesCount = new Map<string, number>();
    const infoSentDurations = new Map<string, number[]>();

    for (const m of matches) {
      const ownerAgentId = opportunityOwner.get(m.opportunityId);
      if (!ownerAgentId) continue;
      if (m.visitScheduledFor) visitsCount.set(ownerAgentId, (visitsCount.get(ownerAgentId) ?? 0) + 1);
      if (m.closedWon === true) closesCount.set(ownerAgentId, (closesCount.get(ownerAgentId) ?? 0) + 1);
      if (m.infoSentAt && m.contactedAt) {
        const hours = (m.infoSentAt.getTime() - m.contactedAt.getTime()) / (1000 * 60 * 60);
        if (hours >= 0) {
          const list = infoSentDurations.get(ownerAgentId) ?? [];
          list.push(hours);
          infoSentDurations.set(ownerAgentId, list);
        }
      }
    }

    const masRapidoInfo = [...infoSentDurations.entries()]
      .map(([agentId, durations]) => ({
        agentId,
        agentName: nameOf(agentId),
        avgHours: durations.reduce((a, b) => a + b, 0) / durations.length,
      }))
      .sort((a, b) => a.avgHours - b.avgHours)
      .slice(0, 5);

    return NextResponse.json({
      stats: {
        masInmuebles: topBy(listingsCount),
        masPedidos: topBy(opportunitiesCount),
        masRapidoInfo,
        masVisitas: topBy(visitsCount),
        masCierres: topBy(closesCount),
        totalClosedDeals,
      },
    });
  } catch {
    return NextResponse.json({ stats: getPlatformStats(), fallback: true });
  }
}

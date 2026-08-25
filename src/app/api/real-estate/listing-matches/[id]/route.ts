import { NextRequest, NextResponse } from 'next/server';
import { MatchStatus } from '@prisma/client';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { buildMilestoneEmail } from '@/lib/real-estate/email-templates';
import {
  findAgentById,
  findListingMatchById,
  isAgentPartOfListingMatch,
  isAgentResponsibleForListingMatch,
  shouldUseMockStore,
  updateListingMatchProgress,
  type ListingMatchProgressPatch,
} from '@/lib/real-estate/mock-store';
import { getAppUrl } from '@/lib/real-estate/subscription-config';
import { awardMatchContacted, awardVisitScheduled } from '@/lib/real-estate/points-log';

const progressSchema = z.object({
  markContacted: z.boolean().optional(),
  infoSent: z.boolean().optional(),
  visitFollowUp: z.boolean().optional(),
  visitScheduledFor: z.string().nullable().optional(),
  visitOutcome: z.enum(['SATISFACTORIA', 'DESCARTADA']).nullable().optional(),
  offerInProgress: z.boolean().optional(),
  closedWon: z.boolean().nullable().optional(),
});

function describeMilestone(patch: ListingMatchProgressPatch): { key: string; detail?: string } | null {
  if (patch.markContacted) return { key: 'contacted' };
  if (typeof patch.infoSent === 'boolean') return patch.infoSent ? { key: 'infoSent' } : null;
  if (typeof patch.visitFollowUp === 'boolean') return patch.visitFollowUp ? { key: 'visitFollowUp' } : null;
  if (patch.visitScheduledFor !== undefined) {
    if (!patch.visitScheduledFor) return null;
    const formatted = new Date(patch.visitScheduledFor).toLocaleString('es-EC', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return { key: 'visitScheduled', detail: formatted };
  }
  if (patch.visitOutcome !== undefined) {
    if (!patch.visitOutcome) return { key: 'reopened' };
    return patch.visitOutcome === 'SATISFACTORIA' ? { key: 'visitCompletedOk' } : { key: 'visitCompletedNo' };
  }
  if (typeof patch.offerInProgress === 'boolean') return patch.offerInProgress ? { key: 'offerInProgress' } : null;
  if (patch.closedWon !== undefined) {
    if (patch.closedWon === null) return { key: 'reopened' };
    return patch.closedWon ? { key: 'closedWon' } : { key: 'closedLost' };
  }
  return null;
}

async function notifyMilestone(
  matchDescription: string,
  actorAgentId: string,
  recipientAgentIds: Set<string>,
  milestoneKey: string,
  detail: string | undefined,
  lookupAgent: (id: string) => Promise<{ fullName: string; email: string | null } | null> | { fullName: string; email?: string } | null,
) {
  const actor = await lookupAgent(actorAgentId);
  if (!actor) return;

  for (const recipientId of recipientAgentIds) {
    if (recipientId === actorAgentId) continue;
    const recipient = await lookupAgent(recipientId);
    if (!recipient?.email) continue;

    const emailContent = buildMilestoneEmail({
      recipientName: recipient.fullName,
      actorName: actor.fullName,
      milestoneKey,
      matchDescription,
      detail,
      appUrl: getAppUrl(),
    });
    void sendEmailNotification({ to: recipient.email, ...emailContent });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos invalidos.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const patch = parsed.data;
  const milestone = describeMilestone(patch);

  if (shouldUseMockStore()) {
    const existing = findListingMatchById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Match no encontrado.' }, { status: 404 });
    }
    if (session.role === 'agent') {
      if (!session.agentId || !isAgentPartOfListingMatch(existing, session.agentId)) {
        return NextResponse.json({ error: 'No tienes acceso a este match.' }, { status: 403 });
      }
      const onlyMarkingContact = Object.keys(patch).every((k) => k === 'markContacted');
      if (!onlyMarkingContact && !isAgentResponsibleForListingMatch(existing, session.agentId)) {
        return NextResponse.json({ error: 'Solo el agente responsable del pedido puede actualizar este seguimiento.' }, { status: 403 });
      }
    }

    const updated = updateListingMatchProgress(id, session.agentId ?? existing.managingAgentId, patch);

    if (milestone && updated) {
      const recipients = new Set<string>([updated.managingAgentId]);
      if (updated.referredByAgentId) recipients.add(updated.referredByAgentId);
      if (updated.createdByAgentId) recipients.add(updated.createdByAgentId);
      const matchDescription = `${updated.listingTitle} ↔ ${updated.opportunitySummary}`;
      await notifyMilestone(
        matchDescription,
        session.agentId ?? updated.managingAgentId,
        recipients,
        milestone.key,
        milestone.detail,
        (agentId) => findAgentById(agentId) ?? null,
      );
    }

    return NextResponse.json({ match: updated, fallback: true });
  }

  try {
    const existing = await prisma.listingMatch.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Match no encontrado.' }, { status: 404 });
    }

    const [opportunity, listing] = await Promise.all([
      prisma.opportunity.findUnique({ where: { id: existing.opportunityId } }),
      prisma.listing.findUnique({ where: { id: existing.listingId } }),
    ]);

    const involvedAgentIds = new Set<string>();
    if (listing) {
      involvedAgentIds.add(listing.managingAgentId);
      if (listing.referredByAgentId) involvedAgentIds.add(listing.referredByAgentId);
    }
    if (opportunity?.createdByAgentId) involvedAgentIds.add(opportunity.createdByAgentId);

    if (session.role === 'agent') {
      if (!session.agentId || !involvedAgentIds.has(session.agentId)) {
        return NextResponse.json({ error: 'No tienes acceso a este match.' }, { status: 403 });
      }
      const onlyMarkingContact = Object.keys(patch).every((k) => k === 'markContacted');
      if (!onlyMarkingContact && session.agentId !== opportunity?.createdByAgentId) {
        return NextResponse.json({ error: 'Solo el agente responsable del pedido puede actualizar este seguimiento.' }, { status: 403 });
      }
    }

    const data: Record<string, unknown> = {};
    if (patch.markContacted && !existing.contactedAt) {
      data.contactedAt = new Date();
      if (existing.status === MatchStatus.PENDING) data.status = MatchStatus.CONTACTED;
    }
    if (typeof patch.infoSent === 'boolean') data.infoSentAt = patch.infoSent ? new Date() : null;
    if (typeof patch.visitFollowUp === 'boolean') data.visitFollowUpAt = patch.visitFollowUp ? new Date() : null;
    if (patch.visitScheduledFor !== undefined) {
      data.visitScheduledFor = patch.visitScheduledFor ? new Date(patch.visitScheduledFor) : null;
    }
    if (patch.visitOutcome !== undefined) {
      data.visitOutcome = patch.visitOutcome;
      data.visitCompletedAt = patch.visitOutcome ? new Date() : null;
      if (!patch.visitOutcome) data.offerInProgressAt = null;
    }
    if (typeof patch.offerInProgress === 'boolean') data.offerInProgressAt = patch.offerInProgress ? new Date() : null;
    if (patch.closedWon !== undefined) {
      data.closedWon = patch.closedWon;
      data.closedAt = patch.closedWon !== null ? new Date() : null;
      data.status = patch.closedWon === true ? MatchStatus.WON : patch.closedWon === false ? MatchStatus.LOST : MatchStatus.INTERESTED;
    }

    const updated = await prisma.listingMatch.update({ where: { id }, data });

    if (session.agentId) {
      if (patch.markContacted) await awardMatchContacted(session.agentId, id);
      if (patch.visitScheduledFor) await awardVisitScheduled(session.agentId, id);
    }

    if (milestone) {
      const matchDescription = `${listing?.title ?? ''} ↔ ${opportunity?.summary ?? ''}`;
      await notifyMilestone(
        matchDescription,
        session.agentId ?? '',
        involvedAgentIds,
        milestone.key,
        milestone.detail,
        async (agentId) => {
          const a = await prisma.agent.findUnique({ where: { id: agentId } });
          return a ? { fullName: a.fullName, email: a.email } : null;
        },
      );
    }

    return NextResponse.json({ match: updated });
  } catch {
    const updated = updateListingMatchProgress(id, session.agentId ?? '', patch);
    return NextResponse.json({ match: updated, fallback: true });
  }
}

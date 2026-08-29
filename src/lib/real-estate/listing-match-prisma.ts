import { LeadStage, ListingStatus, MatchStatus, OperationType, PropertyType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { buildMatchCreatedEmail } from '@/lib/real-estate/email-templates';
import { meetsListingMatchThreshold, scoreListingForOpportunity } from '@/lib/real-estate/matching';
import { getAppUrl } from '@/lib/real-estate/subscription-config';
import { awardMatchReceived } from '@/lib/real-estate/points-log';

type ListingLike = {
  id: string;
  title: string;
  operationType: OperationType;
  propertyType: PropertyType;
  city: string;
  zone: string | null;
  price: number;
  managingAgentId: string;
  referredByAgentId: string | null;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  antiguedad: string | null;
  espaciosAdicionales: number | null;
  mediosBanos: number | null;
  tieneAscensor: boolean | null;
  areasComunales: boolean | null;
  amoblado: string | null;
  serviciosBasicos: string | null;
  terrenoTotalM2: number | null;
  areaLibrePropiaM2: number | null;
  terrenoLibreExclusivoM2: number | null;
};

type OpportunityLike = {
  id: string;
  summary: string;
  operationType: OperationType;
  propertyType: PropertyType;
  city: string;
  zone: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  createdByAgentId: string | null;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  aceptaEspaciosAdicionales: boolean | null;
  prefAreaVerdeAmplia: string | null;
  prefAreasComunales: string | null;
  prefAscensor: string | null;
  prefAmoblado: string | null;
  prefTodosLosServicios: string | null;
};

async function notifyAgentForListingMatch(
  agentId: string,
  opportunity: OpportunityLike,
  listing: ListingLike,
  score: number,
  listingMatchId: string,
): Promise<void> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return;

  await prisma.notificationLog.create({
    data: {
      channel: 'app',
      content: `Nuevo match (score ${score.toFixed(0)}%) entre pedido e inmueble: ${opportunity.summary} <-> ${listing.title}`,
      status: 'SENT',
      sentAt: new Date(),
      agentId,
      opportunityId: opportunity.id,
      listingMatchId,
    },
  });

  if (!agent.email) return;

  const isRequestSide = agentId === opportunity.createdByAgentId;
  const counterpartAgent = isRequestSide
    ? await prisma.agent.findUnique({ where: { id: listing.managingAgentId } })
    : opportunity.createdByAgentId
      ? await prisma.agent.findUnique({ where: { id: opportunity.createdByAgentId } })
      : null;

  const emailContent = buildMatchCreatedEmail({
    recipientName: agent.fullName,
    counterpartName: counterpartAgent?.fullName ?? 'otro agente',
    myDescription: isRequestSide ? opportunity.summary : listing.title,
    counterpartDescription: isRequestSide ? listing.title : opportunity.summary,
    score,
    appUrl: getAppUrl(),
  });

  const result = await sendEmailNotification({ to: agent.email, ...emailContent });

  await prisma.notificationLog.create({
    data: {
      channel: 'email',
      content: `Email a ${agent.email}: match pedido/inmueble score ${score.toFixed(0)}%`,
      status: result.delivered ? 'SENT' : result.attempted ? 'FAILED' : 'QUEUED',
      sentAt: result.delivered ? new Date() : undefined,
      errorDetail: result.error,
      agentId,
      opportunityId: opportunity.id,
      listingMatchId,
    },
  });
}

async function createMatchAndNotify(opportunity: OpportunityLike, listing: ListingLike): Promise<boolean> {
  // Un agente no puede hacer match con su propio pedido: el objetivo es conectar
  // colegas distintos, no generar un "match" contra uno mismo.
  if (opportunity.createdByAgentId && opportunity.createdByAgentId === listing.managingAgentId) return false;

  const existing = await prisma.listingMatch
    .findUnique({ where: { opportunityId_listingId: { opportunityId: opportunity.id, listingId: listing.id } } })
    .catch(() => null);
  if (existing) return false;

  const { score, reasons } = scoreListingForOpportunity(
    {
      operationType: listing.operationType,
      propertyType: listing.propertyType,
      city: listing.city,
      zone: listing.zone,
      price: listing.price,
      areaM2: listing.areaM2,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      parkingSpaces: listing.parkingSpaces,
      antiguedad: listing.antiguedad,
      espaciosAdicionales: listing.espaciosAdicionales,
      mediosBanos: listing.mediosBanos,
      tieneAscensor: listing.tieneAscensor,
      areasComunales: listing.areasComunales,
      amoblado: listing.amoblado,
      serviciosBasicos: listing.serviciosBasicos,
      terrenoTotalM2: listing.terrenoTotalM2,
      areaLibrePropiaM2: listing.areaLibrePropiaM2,
      terrenoLibreExclusivoM2: listing.terrenoLibreExclusivoM2,
    },
    {
      city: opportunity.city,
      zone: opportunity.zone,
      propertyType: opportunity.propertyType,
      operationType: opportunity.operationType,
      budgetMin: opportunity.budgetMin,
      budgetMax: opportunity.budgetMax,
      areaM2: opportunity.areaM2,
      bedrooms: opportunity.bedrooms,
      bathrooms: opportunity.bathrooms,
      parkingSpaces: opportunity.parkingSpaces,
      aceptaEspaciosAdicionales: opportunity.aceptaEspaciosAdicionales,
      prefAreaVerdeAmplia: opportunity.prefAreaVerdeAmplia,
      prefAreasComunales: opportunity.prefAreasComunales,
      prefAscensor: opportunity.prefAscensor,
      prefAmoblado: opportunity.prefAmoblado,
      prefTodosLosServicios: opportunity.prefTodosLosServicios,
    },
  );
  if (!meetsListingMatchThreshold(score)) return false;

  const match = await prisma.listingMatch.create({
    data: {
      opportunityId: opportunity.id,
      listingId: listing.id,
      score,
      reasons,
      status: MatchStatus.CONTACTED,
    },
  });

  const targets = new Set<string>([listing.managingAgentId]);
  if (listing.referredByAgentId) targets.add(listing.referredByAgentId);
  if (opportunity.createdByAgentId) targets.add(opportunity.createdByAgentId);

  for (const agentId of targets) {
    await notifyAgentForListingMatch(agentId, opportunity, listing, score, match.id);
  }

  // "Recibir un match" premia a los dos agentes directamente involucrados: quien
  // gestiona el inmueble y quien cargo el pedido (no al referido del inmueble).
  await awardMatchReceived(listing.managingAgentId, match.id);
  if (opportunity.createdByAgentId) await awardMatchReceived(opportunity.createdByAgentId, match.id);

  return true;
}

export async function matchOpportunityAgainstListingsPrisma(opportunity: OpportunityLike): Promise<number> {
  const listings = await prisma.listing.findMany({ where: { status: ListingStatus.ACTIVE } });
  let created = 0;
  for (const listing of listings) {
    if (await createMatchAndNotify(opportunity, listing)) created += 1;
  }
  return created;
}

export async function matchListingAgainstOpportunitiesPrisma(listing: ListingLike): Promise<number> {
  const opportunities = await prisma.opportunity.findMany({
    where: { stage: { in: [LeadStage.NEW, LeadStage.PROCESSING, LeadStage.ACTIVE_MATCH] } },
  });
  let created = 0;
  for (const opportunity of opportunities) {
    if (await createMatchAndNotify(opportunity, listing)) created += 1;
  }
  return created;
}

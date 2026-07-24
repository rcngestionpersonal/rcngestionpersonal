import { OperationType, PropertyType } from '@prisma/client';

type ScoreResult = {
  score: number;
  reasons: string[];
};

export type AgentScoringInput = {
  zones: string[];
  propertyTypesInterest: PropertyType[];
  specialty: OperationType;
  minBudget?: number | null;
  maxBudget?: number | null;
};

export type OpportunityScoringInput = {
  city: string;
  zone?: string | null;
  propertyType: PropertyType;
  operationType: OperationType;
  budgetMin?: number | null;
  budgetMax?: number | null;
};

function overlapsBudget(
  opportunityMin?: number | null,
  opportunityMax?: number | null,
  agentMin?: number | null,
  agentMax?: number | null,
): boolean {
  if (!opportunityMin && !opportunityMax) return true;
  if (!agentMin && !agentMax) return true;

  const oppMin = opportunityMin ?? opportunityMax ?? 0;
  const oppMax = opportunityMax ?? opportunityMin ?? Number.MAX_SAFE_INTEGER;
  const agMin = agentMin ?? agentMax ?? 0;
  const agMax = agentMax ?? agentMin ?? Number.MAX_SAFE_INTEGER;

  return oppMin <= agMax && agMin <= oppMax;
}

export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function zoneMatches(agentZones: string[], city: string, zone?: string | null): boolean {
  if (agentZones.length === 0) return true;
  const haystack = [city, zone ?? ''].filter(Boolean).map(normalize);
  return agentZones.some((z) => {
    const needle = normalize(z);
    return haystack.some((h) => h.includes(needle));
  });
}

function specialtyMatches(agentSpecialty: OperationType, operationType: OperationType): boolean {
  if (agentSpecialty === OperationType.BOTH) return true;
  if (operationType === OperationType.BOTH) return true;
  return agentSpecialty === operationType;
}

function propertyMatches(agentInterest: PropertyType[], propertyType: PropertyType): boolean {
  if (agentInterest.length === 0) return true;
  return agentInterest.includes(propertyType) || agentInterest.includes(PropertyType.OTHER);
}

export function scoreAgentForOpportunity(agent: AgentScoringInput, opportunity: OpportunityScoringInput): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (zoneMatches(agent.zones, opportunity.city, opportunity.zone)) {
    score += 35;
    reasons.push('Zona compatible');
  }

  if (propertyMatches(agent.propertyTypesInterest, opportunity.propertyType)) {
    score += 30;
    reasons.push('Tipo de inmueble compatible');
  }

  if (specialtyMatches(agent.specialty, opportunity.operationType)) {
    score += 20;
    reasons.push('Especialidad operativa alineada');
  }

  if (overlapsBudget(opportunity.budgetMin, opportunity.budgetMax, agent.minBudget, agent.maxBudget)) {
    score += 15;
    reasons.push('Rango de presupuesto compatible');
  }

  return { score, reasons };
}

export function shouldNotify(score: number): boolean {
  return score >= 45;
}

export function isAgentEligible(agent: {
  isActive: boolean;
  subscriptionStatus: string;
  phoneVerifiedAt?: Date | string | null;
}): boolean {
  return (
    agent.isActive &&
    (agent.subscriptionStatus === 'TRIAL' || agent.subscriptionStatus === 'ACTIVE') &&
    Boolean(agent.phoneVerifiedAt)
  );
}

export type ListingScoringInput = {
  operationType: OperationType;
  propertyType: PropertyType;
  city: string;
  zone?: string | null;
  price: number;
};

function locationMatches(
  aCity: string,
  aZone: string | null | undefined,
  bCity: string,
  bZone: string | null | undefined,
): boolean {
  if (normalize(aCity) !== normalize(bCity)) return false;
  if (!aZone || !bZone) return true;

  const na = normalize(aZone);
  const nb = normalize(bZone);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function operationCompatible(a: OperationType, b: OperationType): boolean {
  if (a === OperationType.BOTH || b === OperationType.BOTH) return true;
  return a === b;
}

function propertyTypeCompatible(a: PropertyType, b: PropertyType): boolean {
  return a === b || a === PropertyType.OTHER || b === PropertyType.OTHER;
}

function priceWithinBudget(price: number, budgetMin?: number | null, budgetMax?: number | null): boolean {
  if (!budgetMin && !budgetMax) return true;
  const tolerance = 0.1;
  const min = budgetMin ?? 0;
  const max = budgetMax ?? Number.MAX_SAFE_INTEGER;
  return price >= min * (1 - tolerance) && price <= max * (1 + tolerance);
}

export function scoreListingForOpportunity(listing: ListingScoringInput, opportunity: OpportunityScoringInput): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (locationMatches(listing.city, listing.zone, opportunity.city, opportunity.zone)) {
    score += 35;
    reasons.push('Zona compatible');
  }

  if (propertyTypeCompatible(listing.propertyType, opportunity.propertyType)) {
    score += 30;
    reasons.push('Tipo de inmueble compatible');
  }

  if (operationCompatible(listing.operationType, opportunity.operationType)) {
    score += 20;
    reasons.push('Misma operacion (venta/alquiler)');
  }

  if (priceWithinBudget(listing.price, opportunity.budgetMin, opportunity.budgetMax)) {
    score += 15;
    reasons.push('Precio dentro del presupuesto');
  }

  return { score, reasons };
}

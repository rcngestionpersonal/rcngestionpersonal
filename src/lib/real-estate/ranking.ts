// Sistema de puntos de gestion: recompensa a los agentes por alimentar la plataforma
// (inmuebles, pedidos, matches) y por avanzar la gestion de cada match (seguimiento,
// visita, negociacion, cierre). Los aportes al mapa de precios de cierre suman puntos
// individuales pero nunca exponen que agente cargo cada cierre especifico (se mantiene
// el anonimato del mapa; solo se conoce el conteo agregado por agente).
export const RANKING_POINTS = {
  LISTING: 10,
  PEDIDO: 10,
  MATCH: 5,
  CONTACTED: 5,
  INFO_SENT: 10,
  VISIT_FOLLOWUP: 10,
  VISIT_SCHEDULED: 15,
  VISIT_COMPLETED: 15,
  OFFER_IN_PROGRESS: 20,
  CLOSED_WON: 50,
  CLOSED_DEAL_MAP: 15,
} as const;

export type AgentRankingBreakdown = {
  listings: number;
  pedidos: number;
  matches: number;
  seguimientos: number;
  cierresMapa: number;
};

export type AgentRankingEntry = {
  agentId: string;
  agentName: string;
  score: number;
  breakdown: AgentRankingBreakdown;
  rank: number;
};

export type AgentRankingRawInput = {
  agentId: string;
  agentName: string;
  listings: number;
  pedidos: number;
  matches: number;
  milestonePoints: number;
  closedDeals: number;
};

export function buildRanking(raw: AgentRankingRawInput[]): AgentRankingEntry[] {
  const scored = raw.map((r) => {
    const listings = r.listings * RANKING_POINTS.LISTING;
    const pedidos = r.pedidos * RANKING_POINTS.PEDIDO;
    const matches = r.matches * RANKING_POINTS.MATCH;
    const cierresMapa = r.closedDeals * RANKING_POINTS.CLOSED_DEAL_MAP;
    const score = listings + pedidos + matches + r.milestonePoints + cierresMapa;
    return {
      agentId: r.agentId,
      agentName: r.agentName,
      score,
      breakdown: { listings, pedidos, matches, seguimientos: r.milestonePoints, cierresMapa },
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, idx) => ({ ...s, rank: idx + 1 }));
}

export type MilestoneFields = {
  contactedAt?: string | Date | null;
  infoSentAt?: string | Date | null;
  visitFollowUpAt?: string | Date | null;
  visitScheduledFor?: string | Date | null;
  visitCompletedAt?: string | Date | null;
  offerInProgressAt?: string | Date | null;
  closedWon?: boolean | null;
};

export function milestonePoints(match: MilestoneFields): number {
  let pts = 0;
  if (match.contactedAt) pts += RANKING_POINTS.CONTACTED;
  if (match.infoSentAt) pts += RANKING_POINTS.INFO_SENT;
  if (match.visitFollowUpAt) pts += RANKING_POINTS.VISIT_FOLLOWUP;
  if (match.visitScheduledFor) pts += RANKING_POINTS.VISIT_SCHEDULED;
  if (match.visitCompletedAt) pts += RANKING_POINTS.VISIT_COMPLETED;
  if (match.offerInProgressAt) pts += RANKING_POINTS.OFFER_IN_PROGRESS;
  if (match.closedWon === true) pts += RANKING_POINTS.CLOSED_WON;
  return pts;
}

// Puntos que un unico hito recien marcado le suma al agente responsable (para el
// feedback de "+N pts" en la linea de tiempo del match).
export function pointsForMilestoneKey(key: string): number {
  switch (key) {
    case 'markContacted':
      return RANKING_POINTS.CONTACTED;
    case 'infoSent':
      return RANKING_POINTS.INFO_SENT;
    case 'visitFollowUp':
      return RANKING_POINTS.VISIT_FOLLOWUP;
    case 'visitScheduledFor':
      return RANKING_POINTS.VISIT_SCHEDULED;
    case 'visitCompleted':
      return RANKING_POINTS.VISIT_COMPLETED;
    case 'offerInProgress':
      return RANKING_POINTS.OFFER_IN_PROGRESS;
    case 'closedWon':
      return RANKING_POINTS.CLOSED_WON;
    default:
      return 0;
  }
}

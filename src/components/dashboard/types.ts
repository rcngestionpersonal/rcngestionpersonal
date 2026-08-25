export type DashboardMetrics = {
  totalMessages: number;
  totalMatches: number;
  contactedMatches: number;
  responseRate: number;
  activeAgents: number;
  activeMatches: number;
  closed: number;
  discarded: number;
  trialAgents: number;
  paidAgents: number;
  churnedAgents: number;
};

export type TopZone = {
  city: string;
  _count: { city: number };
};

export type MatchItem = {
  id: string;
  score: number;
  status?: 'PENDING' | 'CONTACTED' | 'INTERESTED' | 'REJECTED' | 'WON' | 'LOST';
  reasons?: string[];
  agent: { id?: string; fullName: string };
};

export type ListingMatchItem = {
  id: string;
  score: number;
  status?: 'PENDING' | 'CONTACTED' | 'INTERESTED' | 'REJECTED' | 'WON' | 'LOST';
  reasons?: string[];
  contactedAt?: string | null;
  infoSentAt?: string | null;
  visitFollowUpAt?: string | null;
  visitScheduledFor?: string | null;
  visitCompletedAt?: string | null;
  visitOutcome?: 'SATISFACTORIA' | 'DESCARTADA' | null;
  offerInProgressAt?: string | null;
  closedWon?: boolean | null;
  closedAt?: string | null;
  createdAt: string;
  opportunitySummary?: string;
  listingTitle?: string;
  managingAgentId?: string;
  referredByAgentId?: string;
  createdByAgentId?: string;
  notifiedAgents?: Array<{ agentId: string; fullName: string; hasEmail: boolean; emailAttempted: boolean; emailDelivered: boolean }>;
  opportunity?: { id: string; summary: string; city?: string; zone?: string };
  listing?: { id: string; title: string; city?: string; zone?: string };
};

export type ProgressPatch = {
  markContacted?: boolean;
  infoSent?: boolean;
  visitFollowUp?: boolean;
  visitScheduledFor?: string | null;
  visitOutcome?: 'SATISFACTORIA' | 'DESCARTADA' | null;
  offerInProgress?: boolean;
  closedWon?: boolean | null;
};

export type OpportunityItem = {
  id: string;
  summary: string;
  city: string;
  zone?: string;
  claimedByAgentId?: string;
  referredByAgentId?: string;
  referralCommissionPercent?: number;
  createdByAgentId?: string;
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  budgetMin?: number;
  budgetMax?: number;
  contactName?: string;
  contactPhone?: string;
  matches: MatchItem[];
  listingMatches?: ListingMatchItem[];
  createdAt: string;
};

export type AgentItem = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  photoUrl?: string | null;
  specializationZones?: string[];
  carnetMessage?: string | null;
  carnetSlug?: string | null;
  company?: string;
  zones: string[];
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE';
  idNumber?: string;
  licenseNumber?: string;
  yearsExperience?: number | null;
  phoneVerifiedAt?: string | null;
  rankingAlias?: string | null;
  useRankingAlias?: boolean;
  trialEndsAt?: string;
  subscriptionPaidUntil?: string | null;
  referredByAgentId?: string | null;
  createdAt?: string;
};

export function isAgentVerified(agent?: Pick<AgentItem, 'idNumber' | 'phoneVerifiedAt'>): boolean {
  return Boolean(agent?.idNumber) && Boolean(agent?.phoneVerifiedAt);
}

export type ListingItem = {
  id: string;
  title: string;
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  price: number;
  currency: string;
  commissionSharePercent: number;
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'RENTED' | 'INACTIVE';
  managingAgentId: string;
  referredByAgentId?: string;
  // Datos del cliente propietario/arrendador: el backend los redacta salvo para el
  // propio agente que gestiona el inmueble (ver src/lib/real-estate/privacy.ts).
  ownerName?: string;
  ownerPhone?: string;
  coverPhotoUrl?: string;
  matches?: ListingMatchItem[];
  createdAt: string;
};

export type ClosedDealItem = {
  id: string;
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  sector?: string;
  microzona?: string;
  antiguedad?: string;
  estadoInmueble?: string;
  details?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  estimatedLocation?: boolean;
  price: number;
  publicationPrice?: number;
  currency: string;
  areaM2?: number;
  landAreaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  ageYears?: number;
  timeOnMarket?: string;
  paymentMethod?: string;
  financialEntity?: string;
  approvalDelayed?: boolean;
  declaredAccurate?: boolean;
  closedAt: string;
  canEdit?: boolean;
};

export type AgentStatEntry = { agentId: string; agentName: string; value: number };

export type { AgentRankingEntry, AgentRankingBreakdown } from '@/lib/real-estate/ranking';

export type PlatformStats = {
  masInmuebles: AgentStatEntry[];
  masPedidos: AgentStatEntry[];
  masRapidoInfo: Array<{ agentId: string; agentName: string; avgHours: number }>;
  masVisitas: AgentStatEntry[];
  masCierres: AgentStatEntry[];
  totalClosedDeals: number;
};

export type PointActionKeyClient =
  | 'PROFILE_COMPLETE'
  | 'LISTING_CREATED'
  | 'PEDIDO_CREATED'
  | 'MATCH_RECEIVED'
  | 'MATCH_CONTACTED'
  | 'VISIT_SCHEDULED'
  | 'CLOSING_REGISTERED'
  | 'FIRST_MATCH_OF_MONTH_BONUS'
  | 'STREAK_3_MONTHS_BONUS'
  | 'REFERRAL_SIGNUP'
  | 'REFERRAL_ACTIVATED_BONUS';

export type RankingLevelClient = {
  key: string;
  labelEs: string;
  labelEn: string;
  min: number;
  max: number;
  badge: string | null;
  featured?: boolean;
};

export type PointsHistoryEntryClient = {
  eventType: PointActionKeyClient;
  points: number;
  createdAt: string;
  refId?: string;
};

export type PointsSummaryClient = {
  totalPoints: number;
  level: RankingLevelClient;
  nextLevel: RankingLevelClient | null;
  pointsToNext: number | null;
  recentEvents: PointsHistoryEntryClient[];
};

export type PointsRankingEntry = {
  agentId: string;
  displayName: string;
  totalPoints: number;
  level: RankingLevelClient;
  rank: number;
  photoUrl: string | null;
};

export type TypeBreakdown = { total: number; byType: Array<{ propertyType: string; count: number }> };

export type SeguimientosBreakdown = { total: number; byType: Array<{ key: string; count: number }> };

// Desglose de Inmuebles/Pedidos: lista de registros individuales (no solo conteos),
// para que el agente vea de un vistazo "Casa en Venta en Cumbayá de Juan Pérez".
export type ItemBreakdown = { total: number; items: Array<{ id: string; label: string }> };

export type RecentClosedDeal = {
  id: string;
  description: string;
  agentIds: string[];
  agentNames: string[];
  closedAt: string;
};

export type AgentDashboardBreakdown = {
  inmuebles: ItemBreakdown;
  pedidos: ItemBreakdown;
  matches: ItemBreakdown;
  seguimientos: SeguimientosBreakdown;
  mapaPreciosTotal: number;
  // Inmuebles propios con status ACTIVE - usado en la version "Clientes" del
  // Carnet de Agente (nunca puntos/posicion, ver BrokerCard.tsx).
  listingsActive: number;
};

export type ChurnMonth = {
  month: string;
  label: string;
  activeAtStart: number;
  altas: number;
  bajasVoluntary: number;
  bajasInvoluntary: number;
  bajas: number;
  netGrowth: number;
  churnPct: number | null;
  mrr: number;
  hasActivity: boolean;
};

export type AuthUser = {
  role: 'admin' | 'agent';
  agentId?: string;
  tenantId: string;
  email?: string;
};

export type DashboardTab = 'resumen' | 'ranking' | 'suscripcion' | 'inmuebles' | 'pedidos' | 'matches' | 'registrocierre' | 'cierres' | 'invitar' | 'metricas';

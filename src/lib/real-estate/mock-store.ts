import { OperationType, PropertyType } from '@prisma/client';
import { hashPassword } from '@/lib/auth';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { buildMatchCreatedEmail } from '@/lib/real-estate/email-templates';
import { operationActionLabelEs, propertyTypeLabelEs } from '@/lib/real-estate/labels';
import { getAppUrl, getBillingCycleMs, TRIAL_DAYS } from '@/lib/real-estate/subscription-config';
import type { PlanTipo } from '@/config/planes';
import { buildRanking, milestonePoints, type AgentRankingEntry } from '@/lib/real-estate/ranking';
import { zoneCentroid } from '@/lib/real-estate/quito-zones';
import {
  AgentScoringInput,
  OpportunityScoringInput,
  meetsListingMatchThreshold,
  normalize,
  scoreAgentForOpportunity,
  scoreListingForOpportunity,
  shouldNotify,
} from '@/lib/real-estate/matching';

type AgentRecord = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  pendingEmail?: string;
  passwordHash?: string;
  photoUrl?: string;
  company?: string;
  idNumber?: string;
  licenseNumber?: string;
  direccion?: string;
  referenciaDireccion?: string;
  ciudad?: string;
  provincia?: string;
  codigoPostal?: string;
  phoneVerifiedAt?: string;
  otpCode?: string;
  otpExpiresAt?: string;
  referredByAgentId?: string;
  specializationZones?: string[];
  carnetMessage?: string;
  carnetSlug?: string;
  yearsExperience?: number;
  zones: string[];
  propertyTypesInterest: string[];
  minBudget?: number;
  maxBudget?: number;
  specialty: 'SALE' | 'RENT' | 'BOTH';
  isActive: boolean;
  trialEndsAt: string;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE';
  paypalSubscriptionId?: string;
  paypalPayerId?: string;
  lastPaymentProvider?: string;
  payphoneTransactionId?: string;
  subscriptionPaidUntil?: string;
  plan: PlanTipo;
  planDesde?: string;
  planSiguiente?: PlanTipo;
  precioFundadorBasico?: number | null;
  themePreference: 'LIGHT' | 'DARK' | 'SYSTEM';
  createdAt: string;
  updatedAt: string;
};

export function isAgentVerified(agent: Pick<AgentRecord, 'idNumber' | 'phoneVerifiedAt'>): boolean {
  return Boolean(agent.idNumber) && Boolean(agent.phoneVerifiedAt);
}

export function sanitizeAgent<T extends Record<string, unknown>>(
  agent: T,
): Omit<T, 'passwordHash' | 'otpCode' | 'otpExpiresAt'> {
  const safe: Record<string, unknown> = { ...agent };
  delete safe.passwordHash;
  delete safe.otpCode;
  delete safe.otpExpiresAt;
  return safe as Omit<T, 'passwordHash' | 'otpCode' | 'otpExpiresAt'>;
}

type MatchRecord = {
  id: string;
  agentId: string;
  score: number;
  reasons: string[];
  status: 'PENDING' | 'CONTACTED' | 'INTERESTED' | 'REJECTED' | 'WON' | 'LOST';
  agent: Pick<AgentRecord, 'id' | 'fullName' | 'phone' | 'company'>;
};

type ListingMatchNotifiedAgent = {
  agentId: string;
  fullName: string;
  hasEmail: boolean;
  emailAttempted: boolean;
  emailDelivered: boolean;
};

type ListingMatchRecord = {
  id: string;
  opportunityId: string;
  listingId: string;
  score: number;
  reasons: string[];
  status: 'PENDING' | 'CONTACTED' | 'INTERESTED' | 'REJECTED' | 'WON' | 'LOST';
  contactedAt?: string;
  infoSentAt?: string;
  visitFollowUpAt?: string;
  visitScheduledFor?: string;
  visitCompletedAt?: string;
  visitOutcome?: 'SATISFACTORIA' | 'DESCARTADA' | null;
  offerInProgressAt?: string;
  closedWon?: boolean | null;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  opportunitySummary: string;
  listingTitle: string;
  managingAgentId: string;
  referredByAgentId?: string;
  createdByAgentId?: string;
  notifiedAgents: ListingMatchNotifiedAgent[];
};

type OpportunityRecord = {
  id: string;
  contactName?: string;
  contactPhone?: string;
  summary: string;
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  budgetMin?: number;
  budgetMax?: number;
  areaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  prefAreaVerdeAmplia?: string;
  prefAreasComunales?: string;
  prefAscensor?: string;
  prefAmoblado?: string;
  prefTodosLosServicios?: string;
  aceptaEspaciosAdicionales?: boolean;
  stage: 'NEW' | 'PROCESSING' | 'ACTIVE_MATCH' | 'CLOSED' | 'DISCARDED';
  claimedByAgentId?: string;
  referredByAgentId?: string;
  referralCommissionPercent?: number;
  createdByAgentId?: string;
  createdAt: string;
  updatedAt: string;
  matches: MatchRecord[];
};

type ListingRecord = {
  id: string;
  title: string;
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  address?: string;
  price: number;
  currency: string;
  areaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  description?: string;
  esIndependiente?: boolean;
  antiguedad?: string;
  amoblado?: string;
  alicuotaMensual?: number;
  piso?: number;
  tieneAscensor?: boolean;
  areasComunales?: boolean;
  esquineroOMedianero?: string;
  usoSueloTerreno?: string;
  pisosPermitidos?: number;
  serviciosBasicos?: string;
  frenteM?: number;
  nivelLocal?: string;
  distribucionLocal?: string;
  estadoOcupacion?: string;
  canonMensualActual?: number;
  alturaLibreM?: number;
  accesoCamion?: boolean;
  terrenoTotalM2?: number;
  areaLibrePropiaM2?: number;
  terrenoLibreExclusivoM2?: number;
  espaciosAdicionales?: number;
  mediosBanos?: number;
  balconOTerraza?: boolean;
  ownerName?: string;
  ownerPhone?: string;
  coverPhotoUrl?: string;
  commissionSharePercent: number;
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'RENTED' | 'INACTIVE';
  managingAgentId: string;
  referredByAgentId?: string;
  createdAt: string;
  updatedAt: string;
};

// Galeria de fotos del inmueble (Fase 4) - espejo en memoria de ListingPhoto
// (ver prisma/schema.prisma). ownerAgentId no existe aqui a proposito: la
// autorizacion de cada ruta ya resuelve el Listing dueno via listingId.
type ListingPhotoRecord = {
  id: string;
  listingId: string;
  url: string;
  orden: number;
  esPortada: boolean;
  createdAt: string;
};

type ClosedDealRecord = {
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
  createdByAgentId?: string;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
};

type PasswordResetTokenRecord = {
  id: string;
  agentId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
  requestIp?: string;
};

type EmailChangeTokenRecord = {
  id: string;
  agentId: string;
  newEmail: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

// Espejo en memoria de Transaccion (ver prisma/schema.prisma) - historial de
// pagos del agente (Fase 7-bis, seccion 3.1). Solo lectura desde la API;
// se crea una fila por cada activacion/renovacion exitosa via Payphone.
export type TransaccionRecord = {
  id: string;
  agentId: string;
  plan: PlanTipo;
  provider: 'PAYPHONE' | 'PAYPAL';
  amountCents: number;
  taxCents: number;
  totalCents: number;
  providerTransactionId: string;
  authorizationCode?: string;
  createdAt: string;
};

// Aviso de cambio de precio (Fase 7, seccion 9.5) - ver src/lib/real-estate/price-schedule.ts.
export type ScheduledPriceChangeRecord = {
  id: string;
  plan: PlanTipo;
  newTotalCents: number;
  effectiveAt: string;
  notifiedAt?: string;
  appliedAt?: string;
  createdAt: string;
};

type Store = {
  agents: AgentRecord[];
  opportunities: OpportunityRecord[];
  listings: ListingRecord[];
  listingPhotos: ListingPhotoRecord[];
  listingMatches: ListingMatchRecord[];
  closedDeals: ClosedDealRecord[];
  paypalEvents: Set<string>;
  passwordResetTokens: PasswordResetTokenRecord[];
  emailChangeTokens: EmailChangeTokenRecord[];
  scheduledPriceChanges: ScheduledPriceChangeRecord[];
  transacciones: TransaccionRecord[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// Hash PBKDF2 precalculado para DEMO_AGENT_PASSWORD ('demo1234') con una sal fija
// (no aleatoria a proposito: permite sembrar los agentes demo de forma sincrona
// al crear el store, sin depender de Web Crypto async en este punto). Se genero
// una sola vez con el mismo algoritmo de src/lib/auth.ts y se verifico que valida
// correctamente contra 'demo1234'.
const DEMO_AGENT_PASSWORD_HASH = 'AAECAwQFBgcICQoLDA0ODw.3kFvFN3FYZo-L-tTMitfrpUve1Um_OWMA093fPOxtRM';

function seedDemoAgentsSync(store: Store): void {
  if (store.agents.length > 0) return;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const demoAgents: Array<Pick<AgentRecord, 'fullName' | 'phone' | 'email' | 'company' | 'zones' | 'propertyTypesInterest' | 'minBudget' | 'maxBudget' | 'specialty'>> = [
    {
      fullName: 'Sofia Paredes',
      phone: '+593998881111',
      email: 'sofia@brokerhub.ai',
      company: 'Andes Realty',
      zones: ['Quito', 'Cumbaya', 'Tumbaco'],
      propertyTypesInterest: ['HOUSE', 'APARTMENT'],
      minBudget: 70000,
      maxBudget: 250000,
      specialty: 'SALE',
    },
    {
      fullName: 'Carlos Mena',
      phone: '+593997772222',
      email: 'carlos@brokerhub.ai',
      company: 'Metro Brokers',
      zones: ['Guayaquil', 'Samborondon'],
      propertyTypesInterest: ['OFFICE', 'COMMERCIAL'],
      minBudget: 500,
      maxBudget: 2500,
      specialty: 'RENT',
    },
    {
      fullName: 'Valeria Alvarado',
      phone: '+593996663333',
      email: 'valeria@brokerhub.ai',
      company: 'Pacific Partners',
      zones: ['Cuenca', 'Quito'],
      propertyTypesInterest: ['SUITE', 'APARTMENT', 'OTHER'],
      minBudget: 40000,
      maxBudget: 180000,
      specialty: 'BOTH',
    },
  ];

  const createdAt = new Date().toISOString();
  for (const data of demoAgents) {
    store.agents.push({
      id: uid('agent'),
      ...data,
      passwordHash: DEMO_AGENT_PASSWORD_HASH,
      isActive: true,
      trialEndsAt,
      subscriptionStatus: 'TRIAL',
      plan: 'BASICO',
      themePreference: 'LIGHT',
      createdAt,
      updatedAt: createdAt,
    });
  }
}

function getStore(): Store {
  const globalStore = globalThis as unknown as { __realEstateMockStore?: Store };
  if (!globalStore.__realEstateMockStore) {
    globalStore.__realEstateMockStore = {
      agents: [],
      opportunities: [],
      listings: [],
      listingPhotos: [],
      listingMatches: [],
      closedDeals: [],
      paypalEvents: new Set<string>(),
      passwordResetTokens: [],
      emailChangeTokens: [],
      scheduledPriceChanges: [],
      transacciones: [],
    };
    // El modo mock existe para poder probar la plataforma sin configurar nada:
    // se siembran los agentes demo de una vez, sin depender de que un admin
    // dispare /api/real-estate/bootstrap manualmente antes de poder usar
    // "Usar demo" en el login.
    seedDemoAgentsSync(globalStore.__realEstateMockStore);
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).paypalEvents) {
    globalStore.__realEstateMockStore.paypalEvents = new Set<string>();
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).listings) {
    globalStore.__realEstateMockStore.listings = [];
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).listingPhotos) {
    globalStore.__realEstateMockStore.listingPhotos = [];
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).listingMatches) {
    globalStore.__realEstateMockStore.listingMatches = [];
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).closedDeals) {
    globalStore.__realEstateMockStore.closedDeals = [];
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).passwordResetTokens) {
    globalStore.__realEstateMockStore.passwordResetTokens = [];
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).emailChangeTokens) {
    globalStore.__realEstateMockStore.emailChangeTokens = [];
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).scheduledPriceChanges) {
    globalStore.__realEstateMockStore.scheduledPriceChanges = [];
  }

  if (!(globalStore.__realEstateMockStore as Partial<Store>).transacciones) {
    globalStore.__realEstateMockStore.transacciones = [];
  }

  return globalStore.__realEstateMockStore;
}

export function shouldUseMockStore(): boolean {
  return process.env.USE_REAL_ESTATE_MOCK === 'true';
}

// "Activo" para poder usar los modulos operativos (inmuebles, pedidos, matches, cierres):
// requiere telefono verificado por WhatsApp/SMS ademas de trial vigente o suscripcion paga.
// PAST_DUE cuenta como activo a proposito (pedido de recurrencias, seccion 5:
// "durante PAST_DUE el agente conserva el servicio completo" mientras el
// cron de cobro reintenta) - ver la misma nota en access.ts/tieneAcceso().
export function isAgentActive(
  agent: Pick<AgentRecord, 'isActive' | 'subscriptionStatus' | 'phoneVerifiedAt'>,
): boolean {
  return (
    agent.isActive &&
    (agent.subscriptionStatus === 'TRIAL' || agent.subscriptionStatus === 'ACTIVE' || agent.subscriptionStatus === 'PAST_DUE') &&
    Boolean(agent.phoneVerifiedAt)
  );
}

export function registerPaypalEvent(eventId: string): boolean {
  const store = getStore();
  if (store.paypalEvents.has(eventId)) return false;
  store.paypalEvents.add(eventId);
  return true;
}

export function listAgents(onlyActive: boolean): AgentRecord[] {
  const store = getStore();
  return store.agents
    .filter((a) => (onlyActive ? a.isActive : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findAgentById(agentId: string): AgentRecord | null {
  const store = getStore();
  return store.agents.find((a) => a.id === agentId) ?? null;
}

export function findAgentBySlug(slug: string): AgentRecord | null {
  const store = getStore();
  return store.agents.find((a) => a.carnetSlug === slug) ?? null;
}

export function findAgentByPhone(phone: string): AgentRecord | null {
  const store = getStore();
  return store.agents.find((a) => a.phone === phone) ?? null;
}

export function findAgentByEmail(email: string): AgentRecord | null {
  const store = getStore();
  const target = email.trim().toLowerCase();
  return store.agents.find((a) => a.email?.toLowerCase() === target) ?? null;
}

export async function createAgent(input: {
  fullName: string;
  phone: string;
  email?: string;
  password?: string;
  company?: string;
  idNumber?: string;
  licenseNumber?: string;
  direccion?: string;
  referenciaDireccion?: string;
  ciudad?: string;
  provincia?: string;
  codigoPostal?: string;
  zones?: string[];
  propertyTypesInterest?: string[];
  minBudget?: number;
  maxBudget?: number;
  specialty?: 'SALE' | 'RENT' | 'BOTH';
  referredByAgentId?: string;
}): Promise<AgentRecord> {
  const store = getStore();
  const createdAt = nowIso();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const agent: AgentRecord = {
    id: uid('agent'),
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    passwordHash: input.password ? await hashPassword(input.password) : undefined,
    company: input.company,
    idNumber: input.idNumber,
    licenseNumber: input.licenseNumber,
    direccion: input.direccion,
    referenciaDireccion: input.referenciaDireccion,
    ciudad: input.ciudad,
    provincia: input.provincia,
    codigoPostal: input.codigoPostal,
    referredByAgentId: input.referredByAgentId,
    zones: input.zones ?? [],
    propertyTypesInterest: input.propertyTypesInterest ?? [],
    minBudget: input.minBudget,
    maxBudget: input.maxBudget,
    specialty: input.specialty ?? 'BOTH',
    isActive: true,
    trialEndsAt,
    subscriptionStatus: 'TRIAL',
    plan: 'BASICO',
    themePreference: 'LIGHT',
    createdAt,
    updatedAt: createdAt,
  };
  store.agents.push(agent);
  return agent;
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestPhoneOtp(agentId: string): Promise<{ code: string; agent: AgentRecord } | null> {
  const agent = findAgentById(agentId);
  if (!agent) return null;

  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const updated = updateAgent(agentId, { otpCode: code, otpExpiresAt });
  if (!updated) return null;

  if (updated.email) {
    await sendEmailNotification({
      to: updated.email,
      subject: 'Tu codigo de verificacion - Redinmo.io',
      text: `Hola ${updated.fullName}, tu codigo de verificacion de telefono es: ${code}. Vence en 10 minutos.`,
    });
  }

  return { code, agent: updated };
}

export function confirmPhoneOtp(agentId: string, code: string): { success: boolean; error?: string } {
  const agent = findAgentById(agentId);
  if (!agent) return { success: false, error: 'Agente no encontrado.' };
  if (!agent.otpCode || !agent.otpExpiresAt) return { success: false, error: 'Solicita un código primero.' };
  if (new Date(agent.otpExpiresAt).getTime() < Date.now()) return { success: false, error: 'El código expiró, solicita uno nuevo.' };
  if (agent.otpCode !== code.trim()) return { success: false, error: 'Código incorrecto.' };

  updateAgent(agentId, { phoneVerifiedAt: nowIso(), otpCode: undefined, otpExpiresAt: undefined });
  return { success: true };
}

export function updateAgent(agentId: string, patch: Record<string, unknown>): AgentRecord | null {
  const store = getStore();
  const idx = store.agents.findIndex((a) => a.id === agentId);
  if (idx < 0) return null;
  const updated = {
    ...store.agents[idx],
    ...patch,
    updatedAt: nowIso(),
  } as AgentRecord;
  store.agents[idx] = updated;
  return updated;
}

export function deactivateAgent(agentId: string): boolean {
  const updated = updateAgent(agentId, { isActive: false });
  return Boolean(updated);
}

// Espejo en memoria de PasswordResetToken (ver prisma/schema.prisma) para que el
// flujo de recuperacion de contrasena sea probable end-to-end en modo mock, sin
// depender de la conexion real a Neon.
export function createMockResetToken(input: { agentId: string; tokenHash: string; expiresAt: string; requestIp?: string }): PasswordResetTokenRecord {
  const store = getStore();
  const record: PasswordResetTokenRecord = {
    id: uid('prt'),
    agentId: input.agentId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    createdAt: nowIso(),
    requestIp: input.requestIp,
  };
  store.passwordResetTokens.push(record);
  return record;
}

export function findMockResetTokenByHash(tokenHash: string): PasswordResetTokenRecord | null {
  const store = getStore();
  return store.passwordResetTokens.find((t) => t.tokenHash === tokenHash) ?? null;
}

export function countMockResetTokensForAgentSince(agentId: string, since: Date): number {
  const store = getStore();
  return store.passwordResetTokens.filter((t) => t.agentId === agentId && new Date(t.createdAt) >= since).length;
}

export function markMockResetTokenUsed(tokenHash: string): void {
  const store = getStore();
  const record = store.passwordResetTokens.find((t) => t.tokenHash === tokenHash);
  if (record) record.usedAt = nowIso();
}

// Al consumir un token exitosamente, se invalidan (marcan usados) todos los demas
// tokens sin usar de ese agente - nunca deben quedar dos enlaces vigentes a la vez.
export function invalidateOtherMockResetTokens(agentId: string, exceptTokenHash: string): void {
  const store = getStore();
  const now = nowIso();
  for (const t of store.passwordResetTokens) {
    if (t.agentId === agentId && t.tokenHash !== exceptTokenHash && !t.usedAt) {
      t.usedAt = now;
    }
  }
}

// Espejo en memoria de EmailChangeToken (ver prisma/schema.prisma) - mismo
// patron que los tokens de recuperacion de contrasena de arriba.
export function createMockEmailChangeToken(input: { agentId: string; newEmail: string; tokenHash: string; expiresAt: string }): EmailChangeTokenRecord {
  const store = getStore();
  const record: EmailChangeTokenRecord = {
    id: uid('ect'),
    agentId: input.agentId,
    newEmail: input.newEmail,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    createdAt: nowIso(),
  };
  store.emailChangeTokens.push(record);
  return record;
}

export function findMockEmailChangeTokenByHash(tokenHash: string): EmailChangeTokenRecord | null {
  const store = getStore();
  return store.emailChangeTokens.find((t) => t.tokenHash === tokenHash) ?? null;
}

export function markMockEmailChangeTokenUsed(tokenHash: string): void {
  const store = getStore();
  const record = store.emailChangeTokens.find((t) => t.tokenHash === tokenHash);
  if (record) record.usedAt = nowIso();
}

export function invalidateOtherMockEmailChangeTokens(agentId: string, exceptTokenHash: string): void {
  const store = getStore();
  const now = nowIso();
  for (const t of store.emailChangeTokens) {
    if (t.agentId === agentId && t.tokenHash !== exceptTokenHash && !t.usedAt) {
      t.usedAt = now;
    }
  }
}

// Espejo en memoria de ScheduledPriceChange (ver prisma/schema.prisma y
// src/lib/real-estate/price-schedule.ts) - aviso de cambio de precio, Fase 7 seccion 9.5.
export function createMockScheduledPriceChange(input: { plan: PlanTipo; newTotalCents: number; effectiveAt: string }): ScheduledPriceChangeRecord {
  const store = getStore();
  const record: ScheduledPriceChangeRecord = {
    id: uid('spc'),
    plan: input.plan,
    newTotalCents: input.newTotalCents,
    effectiveAt: input.effectiveAt,
    createdAt: nowIso(),
  };
  store.scheduledPriceChanges.push(record);
  return record;
}

export function listMockScheduledPriceChanges(): ScheduledPriceChangeRecord[] {
  return [...getStore().scheduledPriceChanges].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// El aviso "activo" para un plan: el mas proximo aun no aplicado (independiente
// de si ya se notifico) - es lo que se muestra en el panel del agente y lo que
// el cron marca como aplicado cuando llega la fecha.
export function getActiveMockScheduledPriceChangeForPlan(plan: PlanTipo): ScheduledPriceChangeRecord | null {
  const candidates = getStore().scheduledPriceChanges.filter((c) => c.plan === plan && !c.appliedAt);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime())[0];
}

export function markMockScheduledPriceChangeNotified(id: string): void {
  const store = getStore();
  const record = store.scheduledPriceChanges.find((c) => c.id === id);
  if (record) record.notifiedAt = nowIso();
}

export function markMockScheduledPriceChangeApplied(id: string): void {
  const store = getStore();
  const record = store.scheduledPriceChanges.find((c) => c.id === id);
  if (record) record.appliedAt = nowIso();
}

// Espejo en memoria de Transaccion - historial de pagos (Fase 7-bis, seccion 3.1).
export function createMockTransaccion(input: {
  agentId: string;
  plan: PlanTipo;
  provider: 'PAYPHONE' | 'PAYPAL';
  amountCents: number;
  taxCents: number;
  totalCents: number;
  providerTransactionId: string;
  authorizationCode?: string;
}): TransaccionRecord {
  const store = getStore();
  const record: TransaccionRecord = { id: uid('txn'), createdAt: nowIso(), ...input };
  store.transacciones.push(record);
  return record;
}

export function listMockTransaccionesByAgent(agentId: string): TransaccionRecord[] {
  return getStore()
    .transacciones.filter((t) => t.agentId === agentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const DEMO_AGENT_PASSWORD = 'demo1234';

export async function bootstrapDemoAgents(): Promise<number> {
  const store = getStore();
  if (store.agents.length > 0) return 0;

  await createAgent({
    fullName: 'Sofia Paredes',
    phone: '+593998881111',
    email: 'sofia@brokerhub.ai',
    password: DEMO_AGENT_PASSWORD,
    company: 'Andes Realty',
    zones: ['Quito', 'Cumbaya', 'Tumbaco'],
    propertyTypesInterest: ['HOUSE', 'APARTMENT'],
    minBudget: 70000,
    maxBudget: 250000,
    specialty: 'SALE',
  });
  await createAgent({
    fullName: 'Carlos Mena',
    phone: '+593997772222',
    email: 'carlos@brokerhub.ai',
    password: DEMO_AGENT_PASSWORD,
    company: 'Metro Brokers',
    zones: ['Guayaquil', 'Samborondon'],
    propertyTypesInterest: ['OFFICE', 'COMMERCIAL'],
    minBudget: 500,
    maxBudget: 2500,
    specialty: 'RENT',
  });
  await createAgent({
    fullName: 'Valeria Alvarado',
    phone: '+593996663333',
    email: 'valeria@brokerhub.ai',
    password: DEMO_AGENT_PASSWORD,
    company: 'Pacific Partners',
    zones: ['Cuenca', 'Quito'],
    propertyTypesInterest: ['SUITE', 'APARTMENT', 'OTHER'],
    minBudget: 40000,
    maxBudget: 180000,
    specialty: 'BOTH',
  });

  return 3;
}

function attachListingMatches(store: Store, opportunityId: string): ListingMatchRecord[] {
  return store.listingMatches
    .filter((m) => m.opportunityId === opportunityId)
    .sort((a, b) => b.score - a.score);
}

function attachOpportunityMatches(store: Store, listingId: string): ListingMatchRecord[] {
  return store.listingMatches
    .filter((m) => m.listingId === listingId)
    .sort((a, b) => b.score - a.score);
}

export function listOpportunities(limit: number, stage?: string | null): Array<OpportunityRecord & { listingMatches: ListingMatchRecord[] }> {
  const store = getStore();
  return store.opportunities
    .filter((o) => (stage ? o.stage === stage : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.min(limit, 100))
    .map((o) => ({ ...o, listingMatches: attachListingMatches(store, o.id) }));
}

export function findOpportunityById(opportunityId: string): OpportunityRecord | null {
  const store = getStore();
  return store.opportunities.find((o) => o.id === opportunityId) ?? null;
}

export function updateOpportunity(opportunityId: string, patch: Record<string, unknown>): OpportunityRecord | null {
  const store = getStore();
  const idx = store.opportunities.findIndex((o) => o.id === opportunityId);
  if (idx < 0) return null;
  const updated = { ...store.opportunities[idx], ...patch, updatedAt: nowIso() } as OpportunityRecord;
  store.opportunities[idx] = updated;
  return updated;
}

export function deleteOpportunity(opportunityId: string, createdByAgentId?: string): boolean {
  const store = getStore();
  const idx = store.opportunities.findIndex(
    (o) => o.id === opportunityId && (!createdByAgentId || o.createdByAgentId === createdByAgentId),
  );
  if (idx < 0) return false;
  store.opportunities.splice(idx, 1);
  return true;
}

export function claimOpportunity(
  opportunityId: string,
  agentId: string,
  referral?: { referredByAgentId?: string; referralCommissionPercent?: number },
): OpportunityRecord | null {
  const store = getStore();
  const idx = store.opportunities.findIndex((o) => o.id === opportunityId);
  if (idx < 0) return null;
  const updated = {
    ...store.opportunities[idx],
    claimedByAgentId: agentId,
    referredByAgentId: referral?.referredByAgentId,
    referralCommissionPercent: referral?.referralCommissionPercent,
    stage: 'ACTIVE_MATCH' as const,
    updatedAt: nowIso(),
  };
  store.opportunities[idx] = updated;
  return updated;
}

function attachListingPhotos(store: Store, listingId: string): ListingPhotoRecord[] {
  return store.listingPhotos.filter((p) => p.listingId === listingId).sort((a, b) => a.orden - b.orden);
}

export function listListings(filter?: { managingAgentId?: string }): Array<ListingRecord & { matches: ListingMatchRecord[]; photos: ListingPhotoRecord[] }> {
  const store = getStore();
  return store.listings
    .filter((l) => (filter?.managingAgentId ? l.managingAgentId === filter.managingAgentId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((l) => ({ ...l, matches: attachOpportunityMatches(store, l.id), photos: attachListingPhotos(store, l.id) }));
}

export function findListingById(listingId: string): ListingRecord | null {
  const store = getStore();
  return store.listings.find((l) => l.id === listingId) ?? null;
}

export function createListing(input: {
  title: string;
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  address?: string;
  price: number;
  currency?: string;
  areaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  description?: string;
  esIndependiente?: boolean;
  antiguedad?: string;
  amoblado?: string;
  alicuotaMensual?: number;
  piso?: number;
  tieneAscensor?: boolean;
  areasComunales?: boolean;
  esquineroOMedianero?: string;
  usoSueloTerreno?: string;
  pisosPermitidos?: number;
  serviciosBasicos?: string;
  frenteM?: number;
  nivelLocal?: string;
  distribucionLocal?: string;
  estadoOcupacion?: string;
  canonMensualActual?: number;
  alturaLibreM?: number;
  accesoCamion?: boolean;
  terrenoTotalM2?: number;
  areaLibrePropiaM2?: number;
  terrenoLibreExclusivoM2?: number;
  espaciosAdicionales?: number;
  mediosBanos?: number;
  balconOTerraza?: boolean;
  ownerName?: string;
  ownerPhone?: string;
  commissionSharePercent?: number;
  managingAgentId: string;
  referredByAgentId?: string;
}): ListingRecord {
  const store = getStore();
  const createdAt = nowIso();
  const listing: ListingRecord = {
    id: uid('listing'),
    title: input.title,
    operationType: input.operationType,
    propertyType: input.propertyType,
    city: input.city,
    zone: input.zone,
    address: input.address,
    price: input.price,
    currency: input.currency ?? 'USD',
    areaM2: input.areaM2,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    parkingSpaces: input.parkingSpaces,
    description: input.description,
    esIndependiente: input.esIndependiente,
    antiguedad: input.antiguedad,
    amoblado: input.amoblado,
    alicuotaMensual: input.alicuotaMensual,
    piso: input.piso,
    tieneAscensor: input.tieneAscensor,
    areasComunales: input.areasComunales,
    esquineroOMedianero: input.esquineroOMedianero,
    usoSueloTerreno: input.usoSueloTerreno,
    pisosPermitidos: input.pisosPermitidos,
    serviciosBasicos: input.serviciosBasicos,
    frenteM: input.frenteM,
    nivelLocal: input.nivelLocal,
    distribucionLocal: input.distribucionLocal,
    estadoOcupacion: input.estadoOcupacion,
    canonMensualActual: input.canonMensualActual,
    alturaLibreM: input.alturaLibreM,
    accesoCamion: input.accesoCamion,
    terrenoTotalM2: input.terrenoTotalM2,
    areaLibrePropiaM2: input.areaLibrePropiaM2,
    terrenoLibreExclusivoM2: input.terrenoLibreExclusivoM2,
    espaciosAdicionales: input.espaciosAdicionales,
    mediosBanos: input.mediosBanos,
    balconOTerraza: input.balconOTerraza,
    ownerName: input.ownerName,
    ownerPhone: input.ownerPhone,
    commissionSharePercent: input.commissionSharePercent ?? 0,
    status: 'ACTIVE',
    managingAgentId: input.managingAgentId,
    referredByAgentId: input.referredByAgentId,
    createdAt,
    updatedAt: createdAt,
  };
  store.listings.push(listing);
  return listing;
}

export function updateListing(listingId: string, patch: Record<string, unknown>): ListingRecord | null {
  const store = getStore();
  const idx = store.listings.findIndex((l) => l.id === listingId);
  if (idx < 0) return null;
  const updated = { ...store.listings[idx], ...patch, updatedAt: nowIso() } as ListingRecord;
  store.listings[idx] = updated;
  return updated;
}

export function deleteListing(listingId: string, managingAgentId?: string): boolean {
  const store = getStore();
  const idx = store.listings.findIndex(
    (l) => l.id === listingId && (!managingAgentId || l.managingAgentId === managingAgentId),
  );
  if (idx < 0) return false;
  store.listings.splice(idx, 1);
  // Sin FK real en memoria: hay que purgar la galeria a mano (Prisma lo hace
  // solo via onDelete: Cascade).
  store.listingPhotos = store.listingPhotos.filter((p) => p.listingId !== listingId);
  return true;
}

// --- Galeria de fotos (Fase 4) ---------------------------------------------
// Invariante: como mucho una ListingPhoto por listing tiene esPortada=true, y
// Listing.coverPhotoUrl siempre refleja esa foto (o queda vacio si no hay
// ninguna) - syncCoverPhotoUrl() es el UNICO lugar que lo escribe.

function syncCoverPhotoUrl(listingId: string): void {
  const store = getStore();
  const photos = attachListingPhotos(store, listingId);
  const cover = photos.find((p) => p.esPortada) ?? photos[0] ?? null;
  updateListing(listingId, { coverPhotoUrl: cover?.url });
}

export function listListingPhotos(listingId: string): ListingPhotoRecord[] {
  return attachListingPhotos(getStore(), listingId);
}

export function countListingPhotos(listingId: string): number {
  return listListingPhotos(listingId).length;
}

export function addListingPhoto(listingId: string, url: string): ListingPhotoRecord {
  const store = getStore();
  const existing = attachListingPhotos(store, listingId);
  const photo: ListingPhotoRecord = {
    id: uid('photo'),
    listingId,
    url,
    orden: existing.length,
    // La primera foto que sube el agente queda de portada por defecto.
    esPortada: existing.length === 0,
    createdAt: nowIso(),
  };
  store.listingPhotos.push(photo);
  syncCoverPhotoUrl(listingId);
  return photo;
}

export function deleteListingPhoto(photoId: string): { listingId: string } | null {
  const store = getStore();
  const idx = store.listingPhotos.findIndex((p) => p.id === photoId);
  if (idx < 0) return null;
  const { listingId } = store.listingPhotos[idx];
  store.listingPhotos.splice(idx, 1);
  // Renumera para que "orden" siga siendo 0..n-1 contiguo, y si se borro la
  // portada, la foto que quede primera la hereda.
  const remaining = attachListingPhotos(store, listingId);
  const hadCover = !remaining.some((p) => p.esPortada);
  remaining.forEach((p, i) => {
    p.orden = i;
    if (hadCover && i === 0) p.esPortada = true;
  });
  syncCoverPhotoUrl(listingId);
  return { listingId };
}

export function reorderListingPhotos(listingId: string, orderedPhotoIds: string[]): boolean {
  const store = getStore();
  const byId = new Map(attachListingPhotos(store, listingId).map((p) => [p.id, p]));
  if (byId.size !== orderedPhotoIds.length || orderedPhotoIds.some((id) => !byId.has(id))) return false;
  orderedPhotoIds.forEach((id, i) => {
    byId.get(id)!.orden = i;
  });
  return true;
}

export function setListingPhotoCover(listingId: string, photoId: string): boolean {
  const store = getStore();
  const photos = attachListingPhotos(store, listingId);
  if (!photos.some((p) => p.id === photoId)) return false;
  for (const p of store.listingPhotos) {
    if (p.listingId === listingId) p.esPortada = p.id === photoId;
  }
  syncCoverPhotoUrl(listingId);
  return true;
}

// Activacion manual (override del admin, sin pasar por Payphone) - siempre
// deja al agente en Basico; no hay selector de plan en este flujo.
export function activateSubscription(agentId: string): AgentRecord | null {
  const subscriptionPaidUntil = new Date(Date.now() + getBillingCycleMs()).toISOString();
  return updateAgent(agentId, {
    subscriptionStatus: 'ACTIVE',
    subscriptionPaidUntil,
    lastPaymentProvider: 'MANUAL',
    plan: 'BASICO',
    planDesde: new Date().toISOString(),
    planSiguiente: undefined,
  });
}

export function setPaypalForAgent(
  agentId: string,
  paypalSubscriptionId?: string,
  paypalPayerId?: string,
): AgentRecord | null {
  const patch: Record<string, unknown> = {};
  if (paypalSubscriptionId) patch.paypalSubscriptionId = paypalSubscriptionId;
  if (paypalPayerId) patch.paypalPayerId = paypalPayerId;
  return updateAgent(agentId, patch);
}

export function updateSubscriptionByPaypalId(
  paypalSubscriptionId: string,
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE',
): AgentRecord | null {
  const store = getStore();
  const target = store.agents.find((a) => a.paypalSubscriptionId === paypalSubscriptionId);
  if (!target) return null;
  return updateAgent(target.id, { subscriptionStatus: status });
}

function matchOpportunityToAgents(store: Store, op: OpportunityRecord): number {
  let newMatches = 0;

  for (const agent of store.agents.filter((a) => a.isActive && ['TRIAL', 'ACTIVE'].includes(a.subscriptionStatus))) {
    const scored = scoreAgentForOpportunity(
      {
        zones: agent.zones,
        propertyTypesInterest: agent.propertyTypesInterest as PropertyType[],
        specialty: agent.specialty as OperationType,
        minBudget: agent.minBudget,
        maxBudget: agent.maxBudget,
      } as AgentScoringInput,
      {
        city: op.city,
        zone: op.zone,
        propertyType: op.propertyType as PropertyType,
        operationType: op.operationType as OperationType,
        budgetMin: op.budgetMin,
        budgetMax: op.budgetMax,
      } as OpportunityScoringInput,
    );
    if (!shouldNotify(scored.score)) continue;

    const match: MatchRecord = {
      id: uid('match'),
      agentId: agent.id,
      score: scored.score,
      reasons: scored.reasons,
      status: 'CONTACTED',
      agent: {
        id: agent.id,
        fullName: agent.fullName,
        phone: agent.phone,
        company: agent.company,
      },
    };
    op.matches.push(match);
    newMatches += 1;
  }

  return newMatches;
}

async function notifyListingMatchAgents(
  match: ListingMatchRecord,
  opportunity: OpportunityRecord,
  listing: ListingRecord,
): Promise<void> {
  const targetIds = new Set<string>();
  targetIds.add(listing.managingAgentId);
  if (listing.referredByAgentId) targetIds.add(listing.referredByAgentId);
  if (opportunity.createdByAgentId) targetIds.add(opportunity.createdByAgentId);

  const createdByAgentName = opportunity.createdByAgentId
    ? findAgentById(opportunity.createdByAgentId)?.fullName
    : undefined;
  const managingAgentName = findAgentById(listing.managingAgentId)?.fullName;

  for (const agentId of targetIds) {
    const agent = findAgentById(agentId);
    if (!agent) continue;

    let emailAttempted = false;
    let emailDelivered = false;

    if (agent.email) {
      const isRequestSide = agentId === opportunity.createdByAgentId;
      const emailContent = buildMatchCreatedEmail({
        recipientName: agent.fullName,
        counterpartName: (isRequestSide ? managingAgentName : createdByAgentName) ?? 'otro agente',
        myDescription: isRequestSide ? opportunity.summary : listing.title,
        counterpartDescription: isRequestSide ? listing.title : opportunity.summary,
        score: match.score,
        appUrl: getAppUrl(),
      });
      const result = await sendEmailNotification({ to: agent.email, ...emailContent });
      emailAttempted = result.attempted;
      emailDelivered = result.delivered;
    }

    match.notifiedAgents.push({
      agentId,
      fullName: agent.fullName,
      hasEmail: Boolean(agent.email),
      emailAttempted,
      emailDelivered,
    });
  }
}

async function crossMatchOpportunityAndListing(
  store: Store,
  opportunity: OpportunityRecord,
  listing: ListingRecord,
): Promise<ListingMatchRecord | null> {
  // Un agente no puede hacer match con su propio pedido (ver mismo criterio en
  // listing-match-prisma.ts para el modo con base de datos real).
  if (opportunity.createdByAgentId && opportunity.createdByAgentId === listing.managingAgentId) return null;

  const already = store.listingMatches.some(
    (m) => m.opportunityId === opportunity.id && m.listingId === listing.id,
  );
  if (already) return null;

  const { score, reasons } = scoreListingForOpportunity(
    {
      operationType: listing.operationType as OperationType,
      propertyType: listing.propertyType as PropertyType,
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
      propertyType: opportunity.propertyType as PropertyType,
      operationType: opportunity.operationType as OperationType,
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
  if (!meetsListingMatchThreshold(score)) return null;

  const createdAt = nowIso();
  const match: ListingMatchRecord = {
    id: uid('lmatch'),
    opportunityId: opportunity.id,
    listingId: listing.id,
    score,
    reasons,
    status: 'CONTACTED',
    closedWon: null,
    createdAt,
    updatedAt: createdAt,
    opportunitySummary: opportunity.summary,
    listingTitle: listing.title,
    managingAgentId: listing.managingAgentId,
    referredByAgentId: listing.referredByAgentId,
    createdByAgentId: opportunity.createdByAgentId,
    notifiedAgents: [],
  };

  await notifyListingMatchAgents(match, opportunity, listing);
  store.listingMatches.push(match);
  return match;
}

const OPEN_OPPORTUNITY_STAGES = ['NEW', 'PROCESSING', 'ACTIVE_MATCH'];

export async function matchOpportunityToListings(opportunity: OpportunityRecord): Promise<number> {
  const store = getStore();
  let created = 0;

  for (const listing of store.listings.filter((l) => l.status === 'ACTIVE')) {
    const match = await crossMatchOpportunityAndListing(store, opportunity, listing);
    if (match) created += 1;
  }

  return created;
}

export async function matchListingToOpportunities(listing: ListingRecord): Promise<number> {
  const store = getStore();
  let created = 0;

  for (const opportunity of store.opportunities.filter((o) => OPEN_OPPORTUNITY_STAGES.includes(o.stage))) {
    const match = await crossMatchOpportunityAndListing(store, opportunity, listing);
    if (match) created += 1;
  }

  return created;
}

export async function createListingAndMatch(input: Parameters<typeof createListing>[0]): Promise<{
  listing: ListingRecord;
  totalListingMatches: number;
}> {
  const listing = createListing(input);
  const totalListingMatches = await matchListingToOpportunities(listing);
  return { listing, totalListingMatches };
}

export function findListingMatchById(matchId: string): ListingMatchRecord | null {
  const store = getStore();
  return store.listingMatches.find((m) => m.id === matchId) ?? null;
}

export function isAgentPartOfListingMatch(match: ListingMatchRecord, agentId: string): boolean {
  return (
    match.managingAgentId === agentId ||
    match.referredByAgentId === agentId ||
    match.createdByAgentId === agentId
  );
}

// Solo el agente que cargo el pedido (quien maneja al cliente) puede avanzar el
// seguimiento del match. El agente del inmueble solo puede ver el progreso.
export function isAgentResponsibleForListingMatch(match: ListingMatchRecord, agentId: string): boolean {
  return Boolean(match.createdByAgentId) && match.createdByAgentId === agentId;
}

export type ListingMatchProgressPatch = {
  markContacted?: boolean;
  infoSent?: boolean;
  visitFollowUp?: boolean;
  visitScheduledFor?: string | null;
  visitOutcome?: 'SATISFACTORIA' | 'DESCARTADA' | null;
  offerInProgress?: boolean;
  closedWon?: boolean | null;
};

export function updateListingMatchProgress(
  matchId: string,
  agentId: string,
  patch: ListingMatchProgressPatch,
): ListingMatchRecord | null {
  const store = getStore();
  const idx = store.listingMatches.findIndex((m) => m.id === matchId);
  if (idx < 0) return null;

  const existing = store.listingMatches[idx];
  const isPart = isAgentPartOfListingMatch(existing, agentId);
  const isResponsible = isAgentResponsibleForListingMatch(existing, agentId);
  if (!isPart) return null;

  const updated: ListingMatchRecord = {
    ...existing,
    updatedAt: nowIso(),
  };

  if (patch.markContacted && !updated.contactedAt) {
    updated.contactedAt = nowIso();
    if (updated.status === 'PENDING') updated.status = 'CONTACTED';
  }

  if (!isResponsible) {
    store.listingMatches[idx] = updated;
    return updated;
  }

  if (typeof patch.infoSent === 'boolean') {
    updated.infoSentAt = patch.infoSent ? nowIso() : undefined;
  }
  if (typeof patch.visitFollowUp === 'boolean') {
    updated.visitFollowUpAt = patch.visitFollowUp ? nowIso() : undefined;
  }
  if (patch.visitScheduledFor !== undefined) {
    updated.visitScheduledFor = patch.visitScheduledFor ?? undefined;
  }
  if (patch.visitOutcome !== undefined) {
    updated.visitOutcome = patch.visitOutcome;
    updated.visitCompletedAt = patch.visitOutcome ? nowIso() : undefined;
    if (!patch.visitOutcome) {
      updated.offerInProgressAt = undefined;
    }
  }
  if (typeof patch.offerInProgress === 'boolean') {
    updated.offerInProgressAt = patch.offerInProgress ? nowIso() : undefined;
  }
  if (patch.closedWon !== undefined) {
    updated.closedWon = patch.closedWon;
    updated.closedAt = patch.closedWon !== null ? nowIso() : undefined;
    updated.status = patch.closedWon === true ? 'WON' : patch.closedWon === false ? 'LOST' : 'INTERESTED';
  }

  store.listingMatches[idx] = updated;
  return updated;
}

export async function ingestWebChatLead(input: {
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  budgetMin?: number;
  budgetMax?: number;
  contactName: string;
  contactPhone: string;
}): Promise<{ opportunityId: string; totalMatches: number; totalListingMatches: number }> {
  const store = getStore();

  const summary = `${input.contactName} busca ${operationActionLabelEs(input.operationType)} ${propertyTypeLabelEs(input.propertyType)} en ${input.city}${input.zone ? ` - ${input.zone}` : ''}.`;

  const op: OpportunityRecord = {
    id: uid('opp'),
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    summary,
    operationType: input.operationType,
    propertyType: input.propertyType,
    city: input.city,
    zone: input.zone,
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    stage: 'NEW',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    matches: [],
  };

  const totalMatches = matchOpportunityToAgents(store, op);
  store.opportunities.push(op);
  const totalListingMatches = await matchOpportunityToListings(op);

  return { opportunityId: op.id, totalMatches, totalListingMatches };
}

export async function createOpportunityByAgent(input: {
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  budgetMin?: number;
  budgetMax?: number;
  areaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  prefAreaVerdeAmplia?: string;
  prefAreasComunales?: string;
  prefAscensor?: string;
  prefAmoblado?: string;
  prefTodosLosServicios?: string;
  aceptaEspaciosAdicionales?: boolean;
  contactName?: string;
  contactPhone?: string;
  createdByAgentId?: string;
}): Promise<{ opportunity: OpportunityRecord; totalAgentMatches: number; totalListingMatches: number }> {
  const store = getStore();
  const summary = `Pedido cargado manualmente: busca ${operationActionLabelEs(input.operationType)} ${propertyTypeLabelEs(input.propertyType)} en ${input.city}${input.zone ? ` - ${input.zone}` : ''}.`;

  const createdAt = nowIso();
  const op: OpportunityRecord = {
    id: uid('opp'),
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    summary,
    operationType: input.operationType,
    propertyType: input.propertyType,
    city: input.city,
    zone: input.zone,
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    areaM2: input.areaM2,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    parkingSpaces: input.parkingSpaces,
    prefAreaVerdeAmplia: input.prefAreaVerdeAmplia,
    prefAreasComunales: input.prefAreasComunales,
    prefAscensor: input.prefAscensor,
    prefAmoblado: input.prefAmoblado,
    prefTodosLosServicios: input.prefTodosLosServicios,
    aceptaEspaciosAdicionales: input.aceptaEspaciosAdicionales,
    stage: 'NEW',
    createdByAgentId: input.createdByAgentId,
    createdAt,
    updatedAt: createdAt,
    matches: [],
  };

  const totalAgentMatches = matchOpportunityToAgents(store, op);
  store.opportunities.push(op);
  const totalListingMatches = await matchOpportunityToListings(op);

  return { opportunity: op, totalAgentMatches, totalListingMatches };
}

export type ClosedDealInput = {
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city?: string;
  zone?: string;
  sector?: string;
  microzona?: string;
  antiguedad?: string;
  estadoInmueble?: string;
  details?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  price: number;
  publicationPrice?: number;
  currency?: string;
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
  createdByAgentId?: string;
};

export function createClosedDeal(input: ClosedDealInput): ClosedDealRecord {
  const store = getStore();
  const now = nowIso();
  const deal: ClosedDealRecord = {
    id: uid('deal'),
    operationType: input.operationType,
    propertyType: input.propertyType,
    city: input.city ?? 'Quito',
    zone: input.zone,
    sector: input.sector,
    microzona: input.microzona,
    antiguedad: input.antiguedad,
    estadoInmueble: input.estadoInmueble,
    details: input.details,
    latitude: input.latitude,
    longitude: input.longitude,
    price: input.price,
    publicationPrice: input.publicationPrice,
    currency: input.currency ?? 'USD',
    areaM2: input.areaM2,
    landAreaM2: input.landAreaM2,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    parkingSpaces: input.parkingSpaces,
    ageYears: input.ageYears,
    timeOnMarket: input.timeOnMarket,
    paymentMethod: input.paymentMethod,
    financialEntity: input.financialEntity,
    approvalDelayed: input.approvalDelayed,
    declaredAccurate: input.declaredAccurate ?? true,
    createdByAgentId: input.createdByAgentId,
    closedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  store.closedDeals.push(deal);
  return deal;
}

export function findClosedDealById(dealId: string): ClosedDealRecord | null {
  const store = getStore();
  return store.closedDeals.find((d) => d.id === dealId) ?? null;
}

export function updateClosedDeal(
  dealId: string,
  agentId: string,
  patch: Partial<ClosedDealInput>,
): ClosedDealRecord | null {
  const store = getStore();
  const idx = store.closedDeals.findIndex((d) => d.id === dealId);
  if (idx < 0) return null;
  if (store.closedDeals[idx].createdByAgentId !== agentId) return null;

  const updated: ClosedDealRecord = { ...store.closedDeals[idx], ...patch, updatedAt: nowIso() };
  store.closedDeals[idx] = updated;
  return updated;
}

export function deleteClosedDeal(dealId: string, agentId: string): boolean {
  const store = getStore();
  const idx = store.closedDeals.findIndex((d) => d.id === dealId);
  if (idx < 0) return false;
  if (store.closedDeals[idx].createdByAgentId !== agentId) return false;
  store.closedDeals.splice(idx, 1);
  return true;
}

// Cierres legacy sin coordenadas (registrados antes del mapa geografico) reciben el
// centroide aproximado de su sector/zona, marcado con estimatedLocation para que la
// ficha del pin muestre el badge "ubicacion estimada".
function resolveDealLocation(deal: ClosedDealRecord): { latitude?: number; longitude?: number; estimatedLocation: boolean } {
  if (typeof deal.latitude === 'number' && typeof deal.longitude === 'number') {
    return { latitude: deal.latitude, longitude: deal.longitude, estimatedLocation: false };
  }
  const centroid = deal.zone ? zoneCentroid(deal.zone) : null;
  if (!centroid) return { estimatedLocation: false };
  return { latitude: centroid[0], longitude: centroid[1], estimatedLocation: true };
}

// El campo createdByAgentId nunca se expone tal cual: solo se usa para calcular
// canEdit (true si el viewerAgentId coincide con el creador de ese registro).
export function listClosedDeals(
  filter?: {
    city?: string;
    propertyType?: string;
    viewerAgentId?: string;
    bbox?: { south: number; west: number; north: number; east: number };
    limit?: number;
  },
): Array<Omit<ClosedDealRecord, 'createdByAgentId'> & { canEdit: boolean; estimatedLocation?: boolean }> {
  const store = getStore();
  return store.closedDeals
    .filter((d) => (filter?.city ? normalize(d.city) === normalize(filter.city) : true))
    .filter((d) => (filter?.propertyType ? d.propertyType === filter.propertyType : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((d) => {
      const { createdByAgentId, ...rest } = d;
      const { latitude, longitude, estimatedLocation } = resolveDealLocation(d);
      return {
        ...rest,
        latitude,
        longitude,
        estimatedLocation,
        canEdit: Boolean(filter?.viewerAgentId) && createdByAgentId === filter?.viewerAgentId,
      };
    })
    .filter((d) => {
      if (!filter?.bbox) return true;
      if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') return false;
      const b = filter.bbox;
      return d.latitude >= b.south && d.latitude <= b.north && d.longitude >= b.west && d.longitude <= b.east;
    })
    .slice(0, filter?.limit ?? 1000);
}

export function getDashboardData() {
  const store = getStore();
  const totalMatches = store.opportunities.reduce((acc, op) => acc + op.matches.length, 0);
  const contactedMatches = store.opportunities.reduce(
    (acc, op) => acc + op.matches.filter((m) => m.status === 'CONTACTED').length,
    0,
  );

  const activeAgents = store.agents.filter((a) => a.isActive).length;
  const stageCount = (stage: OpportunityRecord['stage']) => store.opportunities.filter((o) => o.stage === stage).length;

  const zoneMap = new Map<string, number>();
  for (const op of store.opportunities) {
    zoneMap.set(op.city, (zoneMap.get(op.city) ?? 0) + 1);
  }
  const topZones = [...zoneMap.entries()]
    .map(([city, count]) => ({ city, _count: { city: count } }))
    .sort((a, b) => b._count.city - a._count.city)
    .slice(0, 5);

  return {
    metrics: {
      totalMessages: store.opportunities.length,
      totalMatches,
      contactedMatches,
      responseRate: 0,
      activeAgents,
      activeMatches: stageCount('ACTIVE_MATCH'),
      closed: stageCount('CLOSED'),
      discarded: stageCount('DISCARDED'),
      trialAgents: store.agents.filter((a) => a.subscriptionStatus === 'TRIAL').length,
      paidAgents: store.agents.filter((a) => a.subscriptionStatus === 'ACTIVE').length,
      churnedAgents: store.agents.filter((a) => a.subscriptionStatus === 'CANCELED').length,
      listingMatches: store.listingMatches.length,
      closedDeals: store.closedDeals.length,
    },
    topZones,
  };
}

export type AgentStatEntry = { agentId: string; agentName: string; value: number };

export function getPlatformStats(): {
  masInmuebles: AgentStatEntry[];
  masPedidos: AgentStatEntry[];
  masRapidoInfo: Array<{ agentId: string; agentName: string; avgHours: number }>;
  masVisitas: AgentStatEntry[];
  masCierres: AgentStatEntry[];
  totalClosedDeals: number;
} {
  const store = getStore();
  const agentName = (id: string) => store.agents.find((a) => a.id === id)?.fullName ?? id;

  function topBy(counter: Map<string, number>, limit = 5): AgentStatEntry[] {
    return [...counter.entries()]
      .map(([agentId, value]) => ({ agentId, agentName: agentName(agentId), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  const listingsCount = new Map<string, number>();
  for (const listing of store.listings) {
    listingsCount.set(listing.managingAgentId, (listingsCount.get(listing.managingAgentId) ?? 0) + 1);
  }

  const opportunitiesCount = new Map<string, number>();
  for (const op of store.opportunities) {
    if (!op.createdByAgentId) continue;
    opportunitiesCount.set(op.createdByAgentId, (opportunitiesCount.get(op.createdByAgentId) ?? 0) + 1);
  }

  const visitsCount = new Map<string, number>();
  const closesCount = new Map<string, number>();
  const infoSentDurations = new Map<string, number[]>();

  for (const match of store.listingMatches) {
    if (!match.createdByAgentId) continue;

    if (match.visitScheduledFor) {
      visitsCount.set(match.createdByAgentId, (visitsCount.get(match.createdByAgentId) ?? 0) + 1);
    }
    if (match.closedWon === true) {
      closesCount.set(match.createdByAgentId, (closesCount.get(match.createdByAgentId) ?? 0) + 1);
    }
    if (match.infoSentAt && match.contactedAt) {
      const hours = (new Date(match.infoSentAt).getTime() - new Date(match.contactedAt).getTime()) / (1000 * 60 * 60);
      if (hours >= 0) {
        const list = infoSentDurations.get(match.createdByAgentId) ?? [];
        list.push(hours);
        infoSentDurations.set(match.createdByAgentId, list);
      }
    }
  }

  const masRapidoInfo = [...infoSentDurations.entries()]
    .map(([agentId, durations]) => ({
      agentId,
      agentName: agentName(agentId),
      avgHours: durations.reduce((a, b) => a + b, 0) / durations.length,
    }))
    .sort((a, b) => a.avgHours - b.avgHours)
    .slice(0, 5);

  return {
    masInmuebles: topBy(listingsCount),
    masPedidos: topBy(opportunitiesCount),
    masRapidoInfo,
    masVisitas: topBy(visitsCount),
    masCierres: topBy(closesCount),
    totalClosedDeals: store.closedDeals.length,
  };
}

export function getAgentRanking(): AgentRankingEntry[] {
  const store = getStore();
  const agentName = (id: string) => store.agents.find((a) => a.id === id)?.fullName ?? id;

  const listingsCount = new Map<string, number>();
  for (const listing of store.listings) {
    listingsCount.set(listing.managingAgentId, (listingsCount.get(listing.managingAgentId) ?? 0) + 1);
  }

  const pedidosCount = new Map<string, number>();
  for (const op of store.opportunities) {
    if (!op.createdByAgentId) continue;
    pedidosCount.set(op.createdByAgentId, (pedidosCount.get(op.createdByAgentId) ?? 0) + 1);
  }

  const matchesCount = new Map<string, number>();
  const milestonePointsByAgent = new Map<string, number>();
  for (const match of store.listingMatches) {
    matchesCount.set(match.managingAgentId, (matchesCount.get(match.managingAgentId) ?? 0) + 1);
    if (match.createdByAgentId) {
      if (match.createdByAgentId !== match.managingAgentId) {
        matchesCount.set(match.createdByAgentId, (matchesCount.get(match.createdByAgentId) ?? 0) + 1);
      }
      const pts = milestonePoints(match);
      if (pts > 0) {
        milestonePointsByAgent.set(match.createdByAgentId, (milestonePointsByAgent.get(match.createdByAgentId) ?? 0) + pts);
      }
    }
  }

  const closedDealsCount = new Map<string, number>();
  for (const deal of store.closedDeals) {
    if (!deal.createdByAgentId) continue;
    closedDealsCount.set(deal.createdByAgentId, (closedDealsCount.get(deal.createdByAgentId) ?? 0) + 1);
  }

  const agentIds = new Set<string>([
    ...listingsCount.keys(),
    ...pedidosCount.keys(),
    ...matchesCount.keys(),
    ...milestonePointsByAgent.keys(),
    ...closedDealsCount.keys(),
  ]);

  return buildRanking(
    [...agentIds].map((agentId) => ({
      agentId,
      agentName: agentName(agentId),
      listings: listingsCount.get(agentId) ?? 0,
      pedidos: pedidosCount.get(agentId) ?? 0,
      matches: matchesCount.get(agentId) ?? 0,
      milestonePoints: milestonePointsByAgent.get(agentId) ?? 0,
      closedDeals: closedDealsCount.get(agentId) ?? 0,
    })),
  );
}

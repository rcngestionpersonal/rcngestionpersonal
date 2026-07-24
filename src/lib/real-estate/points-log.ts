import { prisma } from '@/lib/prisma';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';
import {
  POINT_ACTIONS,
  RANKING_LEVELS,
  levelForPoints,
  monthKeyOf,
  nextLevelForPoints,
  type PointActionKey,
  type RankingLevelDef,
} from '@/lib/real-estate/points';

// Reutilizamos la tabla generica EventLog (mismo patron que churn y activacion de
// suscripcion) como historial de puntos: cada fila es un evento individual
// (agente, tipo de accion, puntos, fecha) - nunca un contador acumulado - para que
// el total y el nivel se puedan recalcular siempre desde el historial.
const ENTITY_TYPE = 'agent_points';

// Entidad SEPARADA para "subio de nivel": nunca debe mezclarse con el historial
// de puntos (que alimenta directamente "Tu semana" en Gestion), o un evento
// LEVEL_UP terminaria apareciendo ahi como una fila rara sin traduccion.
const LEVEL_ENTITY_TYPE = 'agent_level';

type PointsPayload = { points: number; refId?: string };
type LevelPayload = { levelKey?: string };

// Compara el nivel antes/despues de otorgar puntos; si el agente cruzo un
// umbral, deja una fila para que la celebracion (ver getUnseenLevelUp) la
// recoja la proxima vez que abra el dashboard. Nunca debe romper el
// otorgamiento real de puntos si algo falla aqui.
async function recordLevelUpIfCrossed(agentId: string, totalBefore: number, totalAfter: number): Promise<void> {
  try {
    const levelBefore = levelForPoints(totalBefore);
    const levelAfter = levelForPoints(totalAfter);
    if (levelBefore.key === levelAfter.key) return;
    await prisma.eventLog.create({
      data: { entityType: LEVEL_ENTITY_TYPE, entityId: agentId, eventType: 'LEVEL_UP', payload: { levelKey: levelAfter.key } satisfies LevelPayload },
    });
  } catch {
    // secundario: nunca debe interrumpir el flujo que otorga los puntos reales
  }
}

// La celebracion se muestra UNA vez por subida de nivel; si el agente subio
// varios niveles entre sesiones, se celebra solo el mas alto alcanzado (marcar
// ese como visto vuelve moot cualquier LEVEL_UP anterior/mas bajo).
export async function getUnseenLevelUp(agentId: string): Promise<{ level: RankingLevelDef } | null> {
  if (shouldUseMockStore()) return null;
  try {
    const [levelUps, seen] = await Promise.all([
      prisma.eventLog.findMany({ where: { entityType: LEVEL_ENTITY_TYPE, entityId: agentId, eventType: 'LEVEL_UP' }, select: { payload: true } }),
      prisma.eventLog.findMany({ where: { entityType: LEVEL_ENTITY_TYPE, entityId: agentId, eventType: 'LEVEL_UP_SEEN' }, select: { payload: true } }),
    ]);
    if (levelUps.length === 0) return null;

    const rankOf = (key: string) => RANKING_LEVELS.findIndex((l) => l.key === key);
    const highestKey = levelUps
      .map((e) => (e.payload as LevelPayload | null)?.levelKey)
      .filter((k): k is string => Boolean(k))
      .sort((a, b) => rankOf(b) - rankOf(a))[0];
    if (!highestKey) return null;

    const alreadySeen = seen.some((e) => (e.payload as LevelPayload | null)?.levelKey === highestKey);
    if (alreadySeen) return null;

    const level = RANKING_LEVELS.find((l) => l.key === highestKey);
    return level ? { level } : null;
  } catch {
    return null;
  }
}

export async function markLevelUpSeen(agentId: string, levelKey: string): Promise<void> {
  if (shouldUseMockStore()) return;
  try {
    await prisma.eventLog.create({
      data: { entityType: LEVEL_ENTITY_TYPE, entityId: agentId, eventType: 'LEVEL_UP_SEEN', payload: { levelKey } satisfies LevelPayload },
    });
  } catch {
    // no critico
  }
}

// El sistema de puntos solo corre contra la base de datos real (igual que el
// dashboard de churn): en modo mock no hay historial persistente confiable, asi
// que se omite silenciosamente sin romper la accion real que lo dispara.
export async function awardPoints(agentId: string, action: PointActionKey, refId?: string): Promise<boolean> {
  if (shouldUseMockStore()) return false;
  try {
    const def = POINT_ACTIONS[action];

    if (def.oncePerAgent) {
      const existing = await prisma.eventLog.findFirst({
        where: { entityType: ENTITY_TYPE, entityId: agentId, eventType: action },
      });
      if (existing) return false;
    } else if (refId) {
      const rows = await prisma.eventLog.findMany({
        where: { entityType: ENTITY_TYPE, entityId: agentId, eventType: action },
        select: { payload: true },
      });
      const duplicate = rows.some((r) => (r.payload as PointsPayload | null)?.refId === refId);
      if (duplicate) return false;
    }

    const priorEvents = await prisma.eventLog.findMany({
      where: { entityType: ENTITY_TYPE, entityId: agentId },
      select: { payload: true },
    });
    const totalBefore = priorEvents.reduce((sum, e) => sum + ((e.payload as PointsPayload | null)?.points ?? 0), 0);

    await prisma.eventLog.create({
      data: { entityType: ENTITY_TYPE, entityId: agentId, eventType: action, payload: { points: def.points, refId } },
    });

    await recordLevelUpIfCrossed(agentId, totalBefore, totalBefore + def.points);
    return true;
  } catch {
    return false;
  }
}

export async function awardListingCreated(agentId: string, listingId: string): Promise<void> {
  await awardPoints(agentId, 'LISTING_CREATED', listingId);
  await checkReferralActivation(agentId);
}

export async function awardPedidoCreated(agentId: string, opportunityId: string): Promise<void> {
  await awardPoints(agentId, 'PEDIDO_CREATED', opportunityId);
  await checkReferralActivation(agentId);
}

export async function awardProfileComplete(agentId: string): Promise<void> {
  await awardPoints(agentId, 'PROFILE_COMPLETE');
}

export async function awardClosingRegistered(agentId: string, dealId: string): Promise<void> {
  await awardPoints(agentId, 'CLOSING_REGISTERED', dealId);
}

// Una sola vez por inmueble (refId = listingId): si el agente cambia la foto despues,
// no se vuelve a sumar.
export async function awardListingPhotoAdded(agentId: string, listingId: string): Promise<void> {
  await awardPoints(agentId, 'LISTING_PHOTO_ADDED', listingId);
}

export async function awardMatchContacted(agentId: string, matchId: string): Promise<void> {
  await awardPoints(agentId, 'MATCH_CONTACTED', matchId);
}

export async function awardVisitScheduled(agentId: string, matchId: string): Promise<void> {
  await awardPoints(agentId, 'VISIT_SCHEDULED', matchId);
}

// "Recibir un match" premia a cada agente involucrado (el que gestiona el inmueble
// y el que cargo el pedido); ademas detecta si es su primer match del mes para el
// bono correspondiente.
export async function awardMatchReceived(agentId: string, matchId: string): Promise<void> {
  const awarded = await awardPoints(agentId, 'MATCH_RECEIVED', `${matchId}:${agentId}`);
  if (!awarded || shouldUseMockStore()) return;
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const matchesThisMonth = await prisma.eventLog.count({
      where: { entityType: ENTITY_TYPE, entityId: agentId, eventType: 'MATCH_RECEIVED', createdAt: { gte: monthStart } },
    });
    if (matchesThisMonth === 1) {
      await awardPoints(agentId, 'FIRST_MATCH_OF_MONTH_BONUS', monthKeyOf(now));
    }
  } catch {
    // el bono es secundario: no debe interrumpir el flujo real del match
  }
}

export async function awardReferralSignup(referrerAgentId: string, newAgentId: string): Promise<void> {
  await awardPoints(referrerAgentId, 'REFERRAL_SIGNUP', newAgentId);
}

// Se llama cada vez que un agente carga su primer inmueble o pedido: si tiene un
// referidor, ese referidor recibe el bono de "referido activado" (una sola vez).
async function checkReferralActivation(agentId: string): Promise<void> {
  if (shouldUseMockStore()) return;
  try {
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { referredByAgentId: true } });
    if (!agent?.referredByAgentId) return;
    await awardPoints(agent.referredByAgentId, 'REFERRAL_ACTIVATED_BONUS', agentId);
  } catch {
    // no bloquear la carga real del inmueble/pedido por esto
  }
}

// Racha de 3 meses consecutivos con al menos una accion puntuable: se evalua de
// forma perezosa (al consultar el resumen de puntos) porque no hay infraestructura
// de tareas programadas en la app.
async function checkStreakBonus(agentId: string): Promise<void> {
  if (shouldUseMockStore()) return;
  try {
    const now = new Date();
    const monthKeys = [0, 1, 2].map((i) => monthKeyOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
    const earliestStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
    const events = await prisma.eventLog.findMany({
      where: { entityType: ENTITY_TYPE, entityId: agentId, createdAt: { gte: earliestStart } },
      select: { createdAt: true, eventType: true },
    });
    const activeMonths = new Set(
      events.filter((e) => e.eventType !== 'STREAK_3_MONTHS_BONUS').map((e) => monthKeyOf(e.createdAt)),
    );
    const hasStreak = monthKeys.every((m) => activeMonths.has(m));
    if (hasStreak) {
      await awardPoints(agentId, 'STREAK_3_MONTHS_BONUS', monthKeys[0]);
    }
  } catch {
    // bono secundario, no interrumpe la consulta del resumen
  }
}

export type PointsHistoryEntry = {
  eventType: PointActionKey;
  points: number;
  createdAt: string;
  refId?: string;
};

export type PointsSummary = {
  totalPoints: number;
  level: RankingLevelDef;
  nextLevel: RankingLevelDef | null;
  pointsToNext: number | null;
  recentEvents: PointsHistoryEntry[];
};

export async function getAgentPointsSummary(agentId: string): Promise<PointsSummary> {
  if (shouldUseMockStore()) {
    const level = levelForPoints(0);
    return { totalPoints: 0, level, nextLevel: nextLevelForPoints(0), pointsToNext: nextLevelForPoints(0)?.min ?? null, recentEvents: [] };
  }

  await checkStreakBonus(agentId);

  const events = await prisma.eventLog.findMany({
    where: { entityType: ENTITY_TYPE, entityId: agentId },
    orderBy: { createdAt: 'desc' },
  });

  const totalPoints = events.reduce((sum, e) => sum + ((e.payload as PointsPayload | null)?.points ?? 0), 0);
  const level = levelForPoints(totalPoints);
  const next = nextLevelForPoints(totalPoints);

  return {
    totalPoints,
    level,
    nextLevel: next,
    pointsToNext: next ? Math.max(0, next.min - totalPoints) : null,
    // 30 en vez de 10: le da a "Tu semana" (ultimos 7 dias) suficiente margen para un
    // agente activo, sin necesitar un endpoint de historial completo aparte.
    recentEvents: events.slice(0, 30).map((e) => ({
      eventType: e.eventType as PointActionKey,
      points: (e.payload as PointsPayload | null)?.points ?? 0,
      createdAt: e.createdAt.toISOString(),
      refId: (e.payload as PointsPayload | null)?.refId,
    })),
  };
}

export type RankingEntry = {
  agentId: string;
  displayName: string;
  totalPoints: number;
  level: RankingLevelDef;
  rank: number;
  photoUrl: string | null;
};

export async function getAgentRankingList(): Promise<RankingEntry[]> {
  if (shouldUseMockStore()) return [];

  const [events, agentsRaw] = await Promise.all([
    prisma.eventLog.findMany({ where: { entityType: ENTITY_TYPE }, select: { entityId: true, payload: true } }),
    // Los agentes de prueba (QA) quedan fuera del ranking publico y de su conteo "de N
    // agentes", pero conservan su historial de puntos internamente.
    prisma.agent.findMany({ where: { isTestUser: false }, select: { id: true, fullName: true, rankingAlias: true, useRankingAlias: true, photoUrl: true } }),
  ]);

  const totals = new Map<string, number>();
  for (const e of events) {
    const pts = (e.payload as PointsPayload | null)?.points ?? 0;
    totals.set(e.entityId, (totals.get(e.entityId) ?? 0) + pts);
  }

  const list = agentsRaw.map((a) => {
    const totalPoints = totals.get(a.id) ?? 0;
    return {
      agentId: a.id,
      displayName: a.useRankingAlias && a.rankingAlias ? a.rankingAlias : a.fullName,
      totalPoints,
      level: levelForPoints(totalPoints),
      // Si el agente eligio mostrarse con alias, tambien ocultamos su foto real -
      // seria inconsistente esconder el nombre pero exponer la cara.
      photoUrl: a.useRankingAlias ? null : a.photoUrl,
    };
  });

  list.sort((a, b) => b.totalPoints - a.totalPoints);
  return list.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

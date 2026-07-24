import { prisma } from '@/lib/prisma';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';

const PLAN_PRICE_USD = 8.99;

// Reutilizamos la tabla generica EventLog (ya usada para eventos de PayPal y de
// activacion) en vez de agregar un modelo nuevo: entityType='agent' + estos
// eventType representan el historial de altas/bajas de suscripcion, con
// createdAt como fecha del cambio de estado.
export const SUBSCRIPTION_EVENT = {
  ACTIVATED: 'subscription_activated',
  REACTIVATED: 'subscription_reactivated',
  CANCELED_VOLUNTARY: 'subscription_canceled_voluntary',
  CANCELED_INVOLUNTARY: 'subscription_canceled_involuntary',
} as const;

const CHURN_EVENT_TYPES = Object.values(SUBSCRIPTION_EVENT);

type RawSubscriptionEvent = {
  agentId: string;
  type: (typeof SUBSCRIPTION_EVENT)[keyof typeof SUBSCRIPTION_EVENT];
  occurredAt: Date;
};

// Registra el alta o la reactivacion de una suscripcion. Si el agente tiene una
// cancelacion previa (voluntaria o involuntaria) sin una reactivacion posterior,
// se registra como reactivacion; caso contrario, como alta nueva.
//
// Es idempotente a proposito: tanto la confirmacion del boton de PayPal (cliente)
// como el webhook de PayPal (servidor) pueden disparar una activacion para el
// mismo evento real; si el ultimo evento registrado ya es un alta/reactivacion,
// no se duplica.
export async function logSubscriptionActivation(agentId: string): Promise<void> {
  if (shouldUseMockStore()) return;
  try {
    const lastEvent = await prisma.eventLog.findFirst({
      where: { entityType: 'agent', entityId: agentId, eventType: { in: CHURN_EVENT_TYPES } },
      orderBy: { createdAt: 'desc' },
    });
    const alreadyActive =
      lastEvent?.eventType === SUBSCRIPTION_EVENT.ACTIVATED || lastEvent?.eventType === SUBSCRIPTION_EVENT.REACTIVATED;
    if (alreadyActive) return;

    const wasCanceled =
      lastEvent?.eventType === SUBSCRIPTION_EVENT.CANCELED_VOLUNTARY ||
      lastEvent?.eventType === SUBSCRIPTION_EVENT.CANCELED_INVOLUNTARY;

    await prisma.eventLog.create({
      data: {
        entityType: 'agent',
        entityId: agentId,
        eventType: wasCanceled ? SUBSCRIPTION_EVENT.REACTIVATED : SUBSCRIPTION_EVENT.ACTIVATED,
      },
    });
  } catch {
    // El churn es una metrica de lectura secundaria: si el log falla, no debe
    // romper la activacion real de la suscripcion.
  }
}

export async function logSubscriptionCancellation(
  agentId: string,
  reason: 'VOLUNTARY' | 'INVOLUNTARY',
): Promise<void> {
  if (shouldUseMockStore()) return;
  try {
    await prisma.eventLog.create({
      data: {
        entityType: 'agent',
        entityId: agentId,
        eventType: reason === 'VOLUNTARY' ? SUBSCRIPTION_EVENT.CANCELED_VOLUNTARY : SUBSCRIPTION_EVENT.CANCELED_INVOLUNTARY,
      },
    });
  } catch {
    // idem: no bloquear el flujo real por un fallo de log.
  }
}

export type ChurnMonth = {
  month: string; // "2026-07"
  label: string; // "Jul 2026"
  activeAtStart: number;
  altas: number;
  bajasVoluntary: number;
  bajasInvoluntary: number;
  bajas: number;
  netGrowth: number;
  churnPct: number | null; // null = sin datos suficientes (activeAtStart === 0)
  mrr: number;
  hasActivity: boolean;
};

const MONTH_LABELS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return `${MONTH_LABELS_ES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

// Simula el historial completo evento por evento y va tomando una fotografia al
// cierre de cada limite de mes, para poder calcular activos al inicio, altas,
// bajas (netas de reactivaciones dentro del mismo mes) y churn % por mes.
export function computeMonthlyChurn(events: RawSubscriptionEvent[], monthsBack = 12): ChurnMonth[] {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const boundaries: Date[] = [];
  for (let i = monthsBack; i >= 0; i--) {
    boundaries.push(new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - i, 1)));
  }

  const status = new Map<string, 'ACTIVE' | 'CHURNED'>();
  let pointer = 0;
  const results: ChurnMonth[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];

    const activeAtStart = [...status.values()].filter((s) => s === 'ACTIVE').length;

    let altas = 0;
    const canceledThisMonth = new Map<string, 'VOLUNTARY' | 'INVOLUNTARY'>();
    const reactivatedAfterCancelThisMonth = new Set<string>();
    let anyEventThisMonth = false;

    while (pointer < sorted.length && sorted[pointer].occurredAt < end) {
      const event = sorted[pointer];
      if (event.occurredAt >= start) {
        anyEventThisMonth = true;
        if (event.type === SUBSCRIPTION_EVENT.ACTIVATED) {
          if (status.get(event.agentId) !== 'ACTIVE') altas += 1;
          status.set(event.agentId, 'ACTIVE');
          canceledThisMonth.delete(event.agentId);
        } else if (event.type === SUBSCRIPTION_EVENT.REACTIVATED) {
          status.set(event.agentId, 'ACTIVE');
          if (canceledThisMonth.has(event.agentId)) reactivatedAfterCancelThisMonth.add(event.agentId);
        } else if (
          event.type === SUBSCRIPTION_EVENT.CANCELED_VOLUNTARY ||
          event.type === SUBSCRIPTION_EVENT.CANCELED_INVOLUNTARY
        ) {
          status.set(event.agentId, 'CHURNED');
          canceledThisMonth.set(event.agentId, event.type === SUBSCRIPTION_EVENT.CANCELED_VOLUNTARY ? 'VOLUNTARY' : 'INVOLUNTARY');
          reactivatedAfterCancelThisMonth.delete(event.agentId);
        }
      }
      pointer += 1;
    }

    let bajasVoluntary = 0;
    let bajasInvoluntary = 0;
    for (const [agentId, reason] of canceledThisMonth) {
      if (reactivatedAfterCancelThisMonth.has(agentId)) continue;
      if (reason === 'VOLUNTARY') bajasVoluntary += 1;
      else bajasInvoluntary += 1;
    }
    const bajas = bajasVoluntary + bajasInvoluntary;
    const activeAtEnd = [...status.values()].filter((s) => s === 'ACTIVE').length;

    results.push({
      month: monthKey(start),
      label: monthLabel(start),
      activeAtStart,
      altas,
      bajasVoluntary,
      bajasInvoluntary,
      bajas,
      netGrowth: altas - bajas,
      churnPct: activeAtStart > 0 ? Number(((bajas / activeAtStart) * 100).toFixed(1)) : null,
      mrr: Number((activeAtEnd * PLAN_PRICE_USD).toFixed(2)),
      hasActivity: anyEventThisMonth || activeAtStart > 0 || activeAtEnd > 0,
    });
  }

  return results;
}

export async function getChurnDashboard(): Promise<ChurnMonth[]> {
  if (shouldUseMockStore()) {
    return computeMonthlyChurn([]);
  }
  try {
    const rows = await prisma.eventLog.findMany({
      where: { entityType: 'agent', eventType: { in: CHURN_EVENT_TYPES } },
      select: { entityId: true, eventType: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const events: RawSubscriptionEvent[] = rows.map((r) => ({
      agentId: r.entityId,
      type: r.eventType as RawSubscriptionEvent['type'],
      occurredAt: r.createdAt,
    }));
    return computeMonthlyChurn(events);
  } catch {
    return computeMonthlyChurn([]);
  }
}

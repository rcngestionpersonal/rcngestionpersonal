// Aviso previo de cambio de precio (Fase 7, seccion 9.5) - los Terminos y
// Condiciones comprometen 30 dias de aviso antes de cualquier aumento. Este
// modulo es el MECANISMO de aviso: programar un cambio (ScheduledPriceChange),
// notificar por correo a los agentes afectados (nunca a los que tengan
// precioFundadorBasico vigente) y exponer el aviso para el panel del agente.
//
// Decision de alcance (a divulgar): el precio efectivo de cada plan sigue
// viviendo en src/config/planes.ts (constantes en tiempo de compilacion), asi
// que este mecanismo programa y COMUNICA el cambio - no reescribe el precio
// vigente automaticamente. Cuando llega la fecha efectiva, el cron marca el
// aviso como aplicado (audit trail) pero actualizar PLANES.{plan}.precioBase
// todavia requiere un deploy. Esto cumple la parte legal (el aviso de 30 dias)
// sin fingir una infraestructura de precios 100% dinamica que nadie pidio
// fuera de este mecanismo de aviso.
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { buildPriceChangeNoticeEmail } from '@/lib/real-estate/email-templates';
import {
  createMockScheduledPriceChange,
  getActiveMockScheduledPriceChangeForPlan,
  listAgents,
  listMockScheduledPriceChanges,
  markMockScheduledPriceChangeApplied,
  markMockScheduledPriceChangeNotified,
  shouldUseMockStore,
  type ScheduledPriceChangeRecord,
} from '@/lib/real-estate/mock-store';
import { getAppUrl } from '@/lib/real-estate/subscription-config';
import { formatUsd, PLANES, type PlanTipo } from '@/config/planes';

export type PriceChangeNotice = {
  id: string;
  plan: PlanTipo;
  newTotalCents: number;
  effectiveAt: string;
};

function planNombre(plan: PlanTipo): string {
  return plan === 'PRO' ? 'Pro' : 'Básico';
}

// Programa el cambio y notifica de inmediato a los agentes afectados (el
// aviso legal es "avisar con 30 dias de anticipacion", no "avisar el dia
// del cambio") - excluyendo, para Basico, a quienes tengan precio fundador
// vigente (ellos no se ven afectados en absoluto).
export async function scheduleAndNotifyPriceChange(input: {
  plan: PlanTipo;
  newTotalCents: number;
  effectiveAt: Date;
}): Promise<{ id: string; notifiedCount: number }> {
  let scheduledId: string;

  if (shouldUseMockStore()) {
    const record = createMockScheduledPriceChange({
      plan: input.plan,
      newTotalCents: input.newTotalCents,
      effectiveAt: input.effectiveAt.toISOString(),
    });
    scheduledId = record.id;
  } else {
    const created = await prisma.scheduledPriceChange.create({
      data: { plan: input.plan, newTotalCents: input.newTotalCents, effectiveAt: input.effectiveAt },
    });
    scheduledId = created.id;
  }

  const notifiedCount = await notifyAffectedAgents({
    plan: input.plan,
    newTotalCents: input.newTotalCents,
    effectiveAt: input.effectiveAt,
  });

  if (shouldUseMockStore()) {
    markMockScheduledPriceChangeNotified(scheduledId);
  } else {
    await prisma.scheduledPriceChange.update({ where: { id: scheduledId }, data: { notifiedAt: new Date() } });
  }

  return { id: scheduledId, notifiedCount };
}

async function notifyAffectedAgents(input: { plan: PlanTipo; newTotalCents: number; effectiveAt: Date }): Promise<number> {
  if (!isEmailConfigured()) return 0;

  const appUrl = getAppUrl();
  const effectiveDateStr = input.effectiveAt.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
  const newTotalUsd = formatUsd(input.newTotalCents);

  const affected = shouldUseMockStore()
    ? listAgents(false)
        .filter((a) => a.plan === input.plan && a.email)
        .filter((a) => !(input.plan === 'BASICO' && a.precioFundadorBasico))
        .map((a) => ({ id: a.id, fullName: a.fullName, email: a.email as string }))
    : await prisma.agent.findMany({
        where: {
          plan: input.plan,
          email: { not: null },
          ...(input.plan === 'BASICO' ? { precioFundadorBasico: null } : {}),
        },
        select: { id: true, fullName: true, email: true },
      });

  let notifiedCount = 0;
  for (const agent of affected) {
    if (!agent.email) continue;
    const { subject, text, html } = buildPriceChangeNoticeEmail({
      agentName: agent.fullName,
      planNombre: planNombre(input.plan),
      newTotalUsd,
      effectiveDateStr,
      appUrl,
    });
    const result = await sendEmailNotification({ to: agent.email, subject, text, html });
    if (result.delivered) notifiedCount += 1;
  }
  return notifiedCount;
}

export async function listScheduledPriceChanges(): Promise<PriceChangeNotice[]> {
  if (shouldUseMockStore()) {
    return listMockScheduledPriceChanges().map(toNotice);
  }
  const rows = await prisma.scheduledPriceChange.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toNotice);
}

function toNotice(row: ScheduledPriceChangeRecord | { id: string; plan: PlanTipo; newTotalCents: number; effectiveAt: Date }): PriceChangeNotice {
  return {
    id: row.id,
    plan: row.plan,
    newTotalCents: row.newTotalCents,
    effectiveAt: typeof row.effectiveAt === 'string' ? row.effectiveAt : row.effectiveAt.toISOString(),
  };
}

// Aviso aplicable a ESTE agente para su panel: null si no hay ningun cambio
// programado para su plan, o si el agente tiene precio fundador vigente en
// Basico (a el no le afecta, no se le muestra nada).
export async function getUpcomingPriceChangeNoticeForAgent(agent: {
  plan: PlanTipo;
  precioFundadorBasico?: number | null;
}): Promise<PriceChangeNotice | null> {
  if (agent.plan === 'BASICO' && agent.precioFundadorBasico) return null;

  if (shouldUseMockStore()) {
    const record = getActiveMockScheduledPriceChangeForPlan(agent.plan);
    return record ? toNotice(record) : null;
  }

  const row = await prisma.scheduledPriceChange.findFirst({
    where: { plan: agent.plan, appliedAt: null },
    orderBy: { effectiveAt: 'asc' },
  });
  return row ? toNotice(row) : null;
}

// Cron: cuando llega la fecha efectiva, marca el aviso como aplicado (audit
// trail). El valor de PLANES.{plan}.precioBase sigue requiriendo un cambio de
// codigo - ver nota de alcance al inicio del archivo.
export async function applyDuePriceChanges(): Promise<number> {
  if (shouldUseMockStore()) {
    const due = listMockScheduledPriceChanges().filter((c) => !c.appliedAt && new Date(c.effectiveAt).getTime() <= Date.now());
    for (const row of due) markMockScheduledPriceChangeApplied(row.id);
    return due.length;
  }

  const due = await prisma.scheduledPriceChange.findMany({
    where: { appliedAt: null, effectiveAt: { lte: new Date() } },
  });
  for (const row of due) {
    await prisma.scheduledPriceChange.update({ where: { id: row.id }, data: { appliedAt: new Date() } });
  }
  return due.length;
}

export function currentVigentTotalCents(plan: PlanTipo): number {
  return PLANES[plan].total;
}

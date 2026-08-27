import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { buildTrialReminderEmail } from '@/lib/real-estate/email-templates';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { getAppUrl } from '@/lib/real-estate/subscription-config';
import { applyDuePriceChanges } from '@/lib/real-estate/price-schedule';

// Job diario (ver vercel.json) con cuatro responsabilidades:
// 1) Avisar por correo en los dias 23/28/30 del trial (7/2/0 dias restantes) -
//    idempotente via EventLog, para no reenviar el mismo aviso si el cron
//    corre mas de una vez el mismo dia.
// 2) Aplicar el cambio de plan programado (planSiguiente) justo cuando el
//    periodo pagado vence - "la proxima renovacion" de la seccion 7 del
//    pedido de arquitectura de planes - y luego limpiarlo.
// 3) Housekeeping: pasar a 'INACTIVE' los trials/pagos ya vencidos que nadie
//    haya leido todavia (la lectura normal ya calcula esto al vuelo via
//    resolveEffectiveSubscriptionStatus, pero sin este barrido la base nunca
//    reflejaria el cambio si el agente no vuelve a entrar).
// 4) Marcar como aplicados los avisos de cambio de precio (Fase 7, seccion
//    9.5) cuya fecha efectiva ya llego - ver price-schedule.ts para la nota
//    de alcance sobre por que esto no reescribe PLANES.{plan}.precioBase.
const REMINDER_DAYS = [7, 2, 0] as const;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sin CRON_SECRET configurado, no bloqueamos (dev/mock)
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  if (shouldUseMockStore()) {
    return NextResponse.json({ skipped: true, reason: 'mock store' });
  }

  const appUrl = getAppUrl();
  const payUrl = `${appUrl}/agentes/suscripcion/pagar`;
  const now = Date.now();
  let emailsSent = 0;
  let flippedToInactive = 0;

  try {
    // --- 1) Avisos de trial por correo ---
    if (isEmailConfigured()) {
      const trialAgents = await prisma.agent.findMany({
        where: { subscriptionStatus: 'TRIAL', email: { not: null } },
        select: { id: true, fullName: true, email: true, trialEndsAt: true },
      });

      for (const agent of trialAgents) {
        const daysLeft = Math.ceil((new Date(agent.trialEndsAt).getTime() - now) / (24 * 60 * 60 * 1000));
        const milestone = REMINDER_DAYS.find((d) => d === daysLeft);
        if (milestone === undefined || !agent.email) continue;

        const eventType = `trial_reminder_${milestone}`;
        const already = await prisma.eventLog.findFirst({
          where: { entityType: 'agent', entityId: agent.id, eventType },
        });
        if (already) continue;

        const { subject, text, html } = buildTrialReminderEmail(agent.fullName, milestone as 7 | 2 | 0, payUrl);
        const result = await sendEmailNotification({ to: agent.email, subject, text, html });
        await prisma.eventLog.create({
          data: { entityType: 'agent', entityId: agent.id, eventType, payload: { daysLeft: milestone, delivered: result.delivered } },
        });
        if (result.delivered) emailsSent += 1;
      }
    }

    // --- 2) y 3) Renovacion vencida: aplicar planSiguiente (si hay) y pasar a
    // INACTIVE. Una fila a la vez porque el nuevo valor de "plan" depende del
    // planSiguiente de cada agente - updateMany no puede copiar una columna a
    // otra por fila.
    const expiredTrials = await prisma.agent.updateMany({
      where: { subscriptionStatus: 'TRIAL', trialEndsAt: { lte: new Date(now) } },
      data: { subscriptionStatus: 'INACTIVE' },
    });

    const dueForRenewal = await prisma.agent.findMany({
      where: { subscriptionStatus: 'ACTIVE', subscriptionPaidUntil: { lte: new Date(now) } },
      select: { id: true, planSiguiente: true },
    });
    for (const due of dueForRenewal) {
      await prisma.agent.update({
        where: { id: due.id },
        data: {
          subscriptionStatus: 'INACTIVE',
          ...(due.planSiguiente ? { plan: due.planSiguiente, planSiguiente: null } : {}),
        },
      });
    }
    flippedToInactive = expiredTrials.count + dueForRenewal.length;

    const priceChangesApplied = await applyDuePriceChanges();

    return NextResponse.json({ success: true, emailsSent, flippedToInactive, priceChangesApplied });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error en el cron de trial.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

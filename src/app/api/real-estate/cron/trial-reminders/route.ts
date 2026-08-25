import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { buildTrialReminderEmail } from '@/lib/real-estate/email-templates';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { getAppUrl } from '@/lib/real-estate/subscription-config';

// Job diario (ver vercel.json) con dos responsabilidades:
// 1) Avisar por correo en los dias 23/28/30 del trial (7/2/0 dias restantes) -
//    idempotente via EventLog, para no reenviar el mismo aviso si el cron
//    corre mas de una vez el mismo dia.
// 2) Housekeeping: pasar a 'INACTIVE' los trials/pagos ya vencidos que nadie
//    haya leido todavia (la lectura normal ya calcula esto al vuelo via
//    resolveEffectiveSubscriptionStatus, pero sin este barrido la base nunca
//    reflejaria el cambio si el agente no vuelve a entrar).
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

    // --- 2) Housekeeping: marcar vencidos como INACTIVE ---
    const expiredTrials = await prisma.agent.updateMany({
      where: { subscriptionStatus: 'TRIAL', trialEndsAt: { lte: new Date(now) } },
      data: { subscriptionStatus: 'INACTIVE' },
    });
    const expiredPaid = await prisma.agent.updateMany({
      where: { subscriptionStatus: 'ACTIVE', subscriptionPaidUntil: { lte: new Date(now) } },
      data: { subscriptionStatus: 'INACTIVE' },
    });
    flippedToInactive = expiredTrials.count + expiredPaid.count;

    return NextResponse.json({ success: true, emailsSent, flippedToInactive });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error en el cron de trial.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

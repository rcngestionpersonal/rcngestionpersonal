import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { getPaymentGateway, type PaymentGateway } from '@/lib/real-estate/payments/gateway';
import {
  processSubscriptionCharge,
  sendUpcomingChargeReminders,
  simulateSubscriptionCharge,
  type DryRunOutcome,
  type ProcessOutcome,
} from '@/lib/real-estate/subscription-engine';

// Job diario (ver vercel.json) - cobra por token a cada Subscription vencida
// (seccion 4 del pedido de recurrencias). Corre a las 12:00 UTC, ANTES del
// cron viejo de trial-reminders (13:00 UTC): asi, si hoy toca cobrar a un
// agente, este cron ya actualizo su Agent.subscriptionStatus/
// subscriptionPaidUntil para cuando el otro cron revise "quien sigue
// vencido" - ademas de eso, trial-reminders ya excluye explicitamente a los
// agentes con tarjeta guardada de su corte inmediato (ver el filtro
// `subscription: null` que se le agrego ahi), asi que el orden es una
// segunda capa de seguridad, no la unica. La maquina de estados en si
// (reintentos, EXPIRED, cancelacion) vive en subscription-engine.ts - un
// route.ts de App Router solo debe exportar handlers HTTP.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SUBSCRIPTIONS_PER_RUN = 50;
// Si una fila quedo "reclamada" (claimedAt seteado) por mas de esto, se
// asume que esa ejecucion se cayo a mitad de camino (timeout de funcion,
// deploy, etc.) y se permite reclamarla de nuevo - sin esto, un crash deja la
// fila bloqueada para siempre.
const CLAIM_STALE_MS = 10 * 60 * 1000;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sin CRON_SECRET configurado, no bloqueamos (dev/mock)
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  // Interruptor general (fase de cierre, punto 1.1): apagado por defecto -
  // hay que setear BILLING_ENABLED="true" a mano en Vercel para que este cron
  // pueda cobrar algo alguna vez. Va arriba del todo, antes de CUALQUIER
  // lectura a la base (ni siquiera shouldUseMockStore, que es solo un env
  // read pero conceptualmente pertenece despues de este gate).
  if (process.env.BILLING_ENABLED !== 'true') {
    console.log('[billing] deshabilitado por BILLING_ENABLED');
    return NextResponse.json({ skipped: true, reason: 'disabled' });
  }

  if (shouldUseMockStore()) {
    return NextResponse.json({ skipped: true, reason: 'mock store' });
  }

  // Modo simulacion (punto 1.2): por defecto ON - hay que setear
  // BILLING_DRY_RUN="false" a mano para que un cobro real llegue a Payphone.
  // En dry run no hace falta un PaymentGateway real (ver simulateSubscriptionCharge,
  // nunca llama a gateway.charge), asi que ni siquiera se inicializa uno.
  const dryRun = process.env.BILLING_DRY_RUN !== 'false';

  let gateway: PaymentGateway | null = null;
  if (!dryRun) {
    try {
      gateway = getPaymentGateway();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'No se pudo inicializar la pasarela de pago.';
      return NextResponse.json({ error: detail }, { status: 500 });
    }
  }

  const now = new Date();
  const staleClaimBefore = new Date(now.getTime() - CLAIM_STALE_MS);

  // Aviso previo (seccion 6 del pedido) - se revisa ANTES de cobrar, no
  // depende de ningun Charge de esta corrida: es para suscripciones cuyo
  // cobro cae DENTRO DE 3 DIAS, no hoy. Se salta en dry run: son emails
  // reales a agentes reales, y no tiene sentido avisar de un cobro que hoy
  // no esta habilitado.
  const reminders = dryRun ? { sent: 0, skipped: 0 } : await sendUpcomingChargeReminders(now);

  const candidates = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      nextChargeAt: { lte: now },
      OR: [{ claimedAt: null }, { claimedAt: { lt: staleClaimBefore } }],
      // Las cuentas de prueba nunca se cobran, pase lo que pase con su
      // suscripcion. Se excluyen aca, en la seleccion de candidatos, y no mas
      // abajo en el bucle: asi ni siquiera llegan a reclamarse ni a generar un
      // Charge. Ver la nota de isTestAccount en schema.prisma sobre por que es
      // un campo distinto de isTestUser.
      agent: { isTestAccount: false },
    },
    take: MAX_SUBSCRIPTIONS_PER_RUN,
    orderBy: { nextChargeAt: 'asc' },
  });

  const outcomes: Record<ProcessOutcome, number> = {
    approved: 0,
    declined: 0,
    expired: 0,
    canceled: 0,
    duplicate: 0,
    unknown_error: 0,
    unknown_exhausted: 0,
    no_payment_method: 0,
    skipped_already_resolved: 0,
  };
  const dryRunOutcomes: Record<DryRunOutcome, number> = {
    would_charge: 0,
    would_cancel: 0,
    skipped_no_payment_method: 0,
    skipped_already_resolved: 0,
  };
  let claimedElsewhere = 0;

  for (const sub of candidates) {
    // Reclamo por compare-and-swap (seccion 4, punto 2 del pedido): solo
    // avanza si claimedAt sigue siendo el mismo valor que se leyo arriba -
    // si otra ejecucion del cron ya la reclamo entre el findMany y aca, este
    // updateMany afecta 0 filas y se salta la suscripcion sin cobrarla dos
    // veces. Esto reemplaza al advisory lock de Postgres (que Prisma no
    // expone directo) con una columna comun.
    const claim = await prisma.subscription.updateMany({
      where: { id: sub.id, claimedAt: sub.claimedAt },
      data: { claimedAt: now },
    });
    if (claim.count === 0) {
      claimedElsewhere++;
      continue;
    }

    try {
      if (dryRun) {
        const preview = await simulateSubscriptionCharge(sub, now);
        dryRunOutcomes[preview]++;
      } else {
        const outcome = await processSubscriptionCharge(sub, gateway as PaymentGateway, now);
        outcomes[outcome]++;
      }
    } catch (err) {
      console.error('[cron/billing] error inesperado procesando suscripcion', { subscriptionId: sub.id, err });
    } finally {
      await prisma.subscription.update({ where: { id: sub.id }, data: { claimedAt: null } });
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    reminders,
    candidates: candidates.length,
    claimedElsewhere,
    outcomes: dryRun ? dryRunOutcomes : outcomes,
  });
}

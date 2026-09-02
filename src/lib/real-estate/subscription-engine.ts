// Maquina de estados y logica de cobro del motor de recurrencias (pedido de
// recurrencias, secciones 4 y 5). Vive fuera de app/api/.../route.ts a
// proposito: Next.js valida que un route.ts de App Router solo exporte
// handlers HTTP (GET/POST/...) y unas pocas constantes de configuracion
// (runtime, dynamic, etc.) - exportar funciones de ayuda desde ahi para
// poder probarlas por separado (paso 9) arriesga romper esa validacion. Aca
// no hay esa restriccion.
import type { Prisma, Subscription } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptAtRest } from '@/lib/real-estate/payments/encryption';
import { buildBillToFromAgent } from '@/lib/real-estate/payments/payphone';
import {
  ChargeUnknownError,
  buildRecurringClientTransactionId,
  type ChargeRequest,
  type ChargeResult,
  type PaymentGateway,
} from '@/lib/real-estate/payments/gateway';
import { getBillingCycleMs } from '@/lib/real-estate/subscription-config';
import { formatUsd, getCheckoutAmountsInCents, getCheckoutReference, getPlan } from '@/config/planes';
import { notify } from '@/lib/real-estate/notifications/notify';

function formatDateEs(date: Date): string {
  return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Reintentos en los dias 0, 3 y 7 desde el PRIMER rechazo de este periodo (el
// intento 1, que ademas es el que marca "dia 0") - el indice de este array es
// (attempt - 1). Al fallar el intento 3 (dia 7), EXPIRED de inmediato: el
// pedido tiene una inconsistencia menor entre el diagrama (que dice "dia
// 10") y el texto ("dia 0, 3 y 7... al tercer fallo, EXPIRED") - se sigue el
// texto por ser mas especifico, y queda senalado en el reporte del paso 6.
export const RETRY_OFFSETS_DAYS = [0, 3, 7] as const;
export const MAX_ATTEMPTS = RETRY_OFFSETS_DAYS.length;

export type ProcessOutcome =
  | 'approved'
  | 'declined'
  | 'expired'
  | 'canceled'
  | 'duplicate'
  | 'unknown_error'
  | 'no_payment_method'
  | 'skipped_already_resolved';

// Reintento programado o primer intento del periodo, segun el estado del
// ultimo Charge que exista para (subscriptionId, periodKey):
// - No existe -> intento 1 (esto es "dia 0").
// - PENDING -> recuperacion de timeout: se reintenta CON EL MISMO
//   clientTransactionId (nunca uno nuevo, ver buildRecurringClientTransactionId).
// - DECLINED o ERROR -> si llegamos hasta aca es porque nextChargeAt ya dice
//   que toca el siguiente intento programado (scheduleNextAttemptOrExpire lo
//   dejo asi) - se crea un intento nuevo con un clientTransactionId nuevo.
// - APPROVED -> este periodo ya esta pagado; red de seguridad por si
//   nextChargeAt quedo desactualizado, no deberia pasar en circunstancias
//   normales.
export async function findOrCreateChargeForPeriod(subscriptionId: string, periodKey: string) {
  const ultimoIntento = await prisma.charge.findFirst({
    where: { subscriptionId, periodKey },
    orderBy: { attempt: 'desc' },
  });

  if (!ultimoIntento) {
    const attempt = 1;
    const clientTransactionId = buildRecurringClientTransactionId(subscriptionId, periodKey, attempt);
    const charge = await prisma.charge.create({
      data: { subscriptionId, periodKey, attempt, clientTransactionId, amountCents: 0, status: 'PENDING' },
    });
    return { charge, isNewAttempt: true };
  }
  if (ultimoIntento.status === 'PENDING') {
    return { charge: ultimoIntento, isNewAttempt: false };
  }
  if (ultimoIntento.status === 'APPROVED') {
    return { charge: ultimoIntento, isNewAttempt: false, alreadyApproved: true };
  }
  const attempt = ultimoIntento.attempt + 1;
  const clientTransactionId = buildRecurringClientTransactionId(subscriptionId, periodKey, attempt);
  const charge = await prisma.charge.create({
    data: { subscriptionId, periodKey, attempt, clientTransactionId, amountCents: 0, status: 'PENDING' },
  });
  return { charge, isNewAttempt: true };
}

// Decide el proximo paso tras un fallo (rechazo, error, o sin tarjeta) del
// intento `attempt` de este periodo: programa el siguiente reintento (dia 3
// o dia 7, anclados al momento del intento 1 - "dia 0" - para que la
// ventana total de gracia sea siempre de 7 dias corridos) o, si este era el
// tercer intento, pasa a EXPIRED (INACTIVE) en modo lectura.
export async function scheduleNextAttemptOrExpire(sub: Subscription, attempt: number, periodKey: string, now: Date): Promise<'past_due' | 'expired'> {
  const agent = await prisma.agent.findUnique({ where: { id: sub.agentId } });

  if (attempt < MAX_ATTEMPTS) {
    const primerIntento = await prisma.charge.findFirst({ where: { subscriptionId: sub.id, periodKey, attempt: 1 } });
    const anchor = primerIntento?.createdAt ?? now;
    const nextRetryAt = new Date(anchor.getTime() + RETRY_OFFSETS_DAYS[attempt] * 24 * 60 * 60 * 1000);
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PAST_DUE', nextChargeAt: nextRetryAt, graceEndsAt: nextRetryAt } }),
      prisma.agent.update({ where: { id: sub.agentId }, data: { subscriptionStatus: 'PAST_DUE' } }),
    ]);
    // "Ultimo aviso" (seccion 6 del pedido): se dispara al programar el
    // intento QUE VA A SER el ultimo (attempt+1 === MAX_ATTEMPTS), no en
    // cada rechazo - eso ya lo cubre la notificacion "charge_declined" que
    // manda processSubscriptionCharge.
    if (agent && attempt + 1 === MAX_ATTEMPTS) {
      await notify(agent, { name: 'past_due_final_notice', data: { planNombre: getPlan(sub.plan).nombre, finalRetryDateStr: formatDateEs(nextRetryAt) } });
    }
    return 'past_due';
  }

  // Tercer fallo: EXPIRED (INACTIVE en nuestro enum, ver la nota de
  // integracion en access.ts/tieneAcceso() sobre por que se reusa este enum
  // en vez de uno nuevo). Por decision explicita de alcance (ver reporte del
  // paso 6), esto SOLO bloquea features de pago (mismo tratamiento que hoy)
  // - no implementa todavia la exclusion de matching nuevo / directorio de
  // colegas que tambien pide "modo lectura" (seccion 5 del pedido), eso
  // queda para un paso aparte. La notificacion de "modo lectura" en si SI
  // se manda: es la unica de las tres exclusiones que es puramente un aviso
  // (no requiere tocar matching.ts ni el directorio).
  await prisma.$transaction([
    prisma.subscription.update({ where: { id: sub.id }, data: { status: 'INACTIVE', nextChargeAt: null } }),
    prisma.agent.update({ where: { id: sub.agentId }, data: { subscriptionStatus: 'INACTIVE' } }),
    prisma.subscriptionEvent.create({ data: { subscriptionId: sub.id, type: 'subscription_expired', payload: { periodKey, afterAttempts: attempt } } }),
  ]);
  if (agent) {
    await notify(agent, { name: 'subscription_expired', data: {} });
  }
  return 'expired';
}

// Aviso previo (seccion 6 del pedido, fila "Aviso previo"): NO es opcional -
// es el aviso que se declaro ante Payphone al pedir la tokenizacion y lo que
// evita reclamos al banco por un cargo "sorpresa". Se dispara para
// suscripciones ACTIVE (no PAST_DUE - esas ya tienen su propio calendario de
// avisos via scheduleNextAttemptOrExpire) cuyo proximo cobro cae exactamente
// dentro de 3 dias. Idempotente por dia: revisa si ya existe un evento
// "payment_reminder_sent" para este nextChargeAt exacto antes de mandar otro
// (dos corridas el mismo dia, o el cron reintentado, no duplican el aviso).
export async function sendUpcomingChargeReminders(now: Date): Promise<{ sent: number; skipped: number }> {
  const windowStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

  const dueSoon = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', nextChargeAt: { gte: windowStart, lt: windowEnd }, paymentMethodId: { not: null } },
    include: { paymentMethod: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const sub of dueSoon) {
    if (!sub.paymentMethod) {
      skipped++;
      continue;
    }
    const already = await prisma.subscriptionEvent.findFirst({
      where: { subscriptionId: sub.id, type: 'payment_reminder_sent', payload: { path: ['nextChargeAt'], equals: sub.nextChargeAt!.toISOString() } },
    });
    if (already) {
      skipped++;
      continue;
    }

    const agent = await prisma.agent.findUnique({ where: { id: sub.agentId } });
    if (!agent) {
      skipped++;
      continue;
    }

    const founderTotalCents = sub.priceLocked ? sub.amountCents + sub.taxCents : null;
    const amounts = getCheckoutAmountsInCents(sub.plan, founderTotalCents);
    await notify(agent, {
      name: 'payment_reminder',
      data: {
        planNombre: getPlan(sub.plan).nombre,
        totalUsd: formatUsd(amounts.amount),
        chargeDateStr: formatDateEs(sub.nextChargeAt!),
        lastDigits: sub.paymentMethod.lastDigits,
      },
    });
    await prisma.subscriptionEvent.create({
      data: { subscriptionId: sub.id, type: 'payment_reminder_sent', payload: { nextChargeAt: sub.nextChargeAt!.toISOString() } },
    });
    sent++;
  }

  return { sent, skipped };
}

export async function processSubscriptionCharge(sub: Subscription, gateway: PaymentGateway, now: Date): Promise<ProcessOutcome> {
  // Cancelacion (seccion 5 del pedido: "siempre al final del periodo pagado,
  // nunca inmediata") - si el agente ya pidio cancelar y llegamos a la fecha
  // en que le tocaria el proximo cobro, no se cobra: se cierra la
  // suscripcion aca en vez de intentar cobrar una tarjeta que el agente ya
  // dijo que no quiere seguir usando.
  if (sub.cancelAtPeriodEnd) {
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELED', nextChargeAt: null, canceledAt: now, cancelAtPeriodEnd: false } }),
      prisma.agent.update({ where: { id: sub.agentId }, data: { subscriptionStatus: 'CANCELED' } }),
      prisma.subscriptionEvent.create({ data: { subscriptionId: sub.id, type: 'subscription_canceled', payload: { effective: 'period_end' } } }),
    ]);
    return 'canceled';
  }

  const periodKey = now.toISOString().slice(0, 7); // "2026-09"
  const { charge, alreadyApproved } = await findOrCreateChargeForPeriod(sub.id, periodKey);

  if (alreadyApproved) {
    return 'skipped_already_resolved';
  }

  const [agent, paymentMethod] = await Promise.all([
    prisma.agent.findUnique({ where: { id: sub.agentId } }),
    sub.paymentMethodId ? prisma.paymentMethod.findUnique({ where: { id: sub.paymentMethodId } }) : Promise.resolve(null),
  ]);

  if (!agent || !paymentMethod || !paymentMethod.active) {
    // Sin tarjeta guardada (o desactivada) - no es un rechazo de Payphone,
    // es que nunca hubo (o ya no hay) con que cobrar automaticamente
    // (seccion 3.8: "el sistema debe funcionar sin tokenizacion"). Sigue la
    // MISMA ventana de gracia dia 0/3/7 que un rechazo real: el agente
    // necesita tiempo para agregar una tarjeta, no perder el servicio de
    // inmediato solo porque nunca tokenizo.
    await prisma.charge.update({
      where: { id: charge.id },
      data: { status: 'ERROR', responseMessage: 'Sin método de pago guardado', resolvedAt: now },
    });
    await prisma.subscriptionEvent.create({
      data: { subscriptionId: sub.id, type: 'charge_no_payment_method', payload: { periodKey } },
    });
    const next = await scheduleNextAttemptOrExpire(sub, charge.attempt, periodKey, now);
    return next === 'expired' ? 'expired' : 'no_payment_method';
  }

  // Precio fundador (seccion 9.4 de planes): si esta suscripcion tiene el
  // precio Basico congelado, se recobra ESE total en vez del vigente de
  // planes.ts - getCheckoutAmountsInCents ya sabe hacer esto, se le pasa el
  // total guardado como "founderTotalCents".
  const founderTotalCents = sub.priceLocked ? sub.amountCents + sub.taxCents : null;
  const amounts = getCheckoutAmountsInCents(sub.plan, founderTotalCents);
  const monthLabel = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
  const reference = `${getCheckoutReference(sub.plan, 'es')} — ${monthLabel}`;

  const chargeRequest: ChargeRequest = {
    cardToken: decryptAtRest(paymentMethod.cardTokenEnc),
    cardHolderEnc: paymentMethod.cardHolderEnc,
    documentId: paymentMethod.documentId,
    phoneNumber: paymentMethod.phoneNumber,
    email: paymentMethod.email,
    amounts,
    clientTransactionId: charge.clientTransactionId,
    reference,
    billTo: buildBillToFromAgent(agent, paymentMethod.consentIp),
  };

  await prisma.charge.update({ where: { id: charge.id }, data: { amountCents: amounts.amount } });

  let result: ChargeResult;
  try {
    result = await gateway.charge(chargeRequest);
  } catch (err) {
    if (err instanceof ChargeUnknownError) {
      // El Charge se deja PENDING tal cual, con el mismo clientTransactionId
      // - la proxima corrida del cron lo retoma (seccion 9, caso 5: "consulta
      // el estado antes de reintentar, nunca cobra a ciegas"). "Consultar el
      // estado" en la practica es este mismo reintento con id identico:
      // Payphone no expone un endpoint de consulta por clientTransactionId
      // (ver nota en gateway.ts), pero SI rechaza un id repetido con
      // errorCode 23, que es la señal que se necesita.
      await prisma.subscriptionEvent.create({
        data: { subscriptionId: sub.id, type: 'charge_unknown_error', payload: { periodKey, message: err.message } },
      });
      return 'unknown_error';
    }
    throw err;
  }

  if (result.duplicate) {
    // errorCode 23: un intento anterior con este mismo id ya llego a
    // Payphone. No se sabe si fue aprobado o rechazado sin revisarlo a mano
    // en Payphone Business (no hay endpoint de consulta por id, ver
    // gateway.ts) - se marca el Charge como ERROR (no PENDING) para
    // frenar el loop de reintentar-con-el-mismo-id todos los dias, y se
    // deja Subscription/Agent TAL COMO ESTABAN (nunca se asume aprobado ni
    // rechazado) - un humano revisa Payphone Business y ajusta a mano. Se
    // da un dia de margen antes de que esta suscripcion vuelva a ser
    // candidata, para que esa revision tenga tiempo de pasar antes de que
    // el cron insista.
    const reviewBy = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await prisma.$transaction([
      prisma.charge.update({
        where: { id: charge.id },
        data: { status: 'ERROR', responseCode: '23', responseMessage: result.responseMessage, rawResponse: result.raw as Prisma.InputJsonValue, resolvedAt: now },
      }),
      prisma.subscription.update({ where: { id: sub.id }, data: { nextChargeAt: reviewBy } }),
      prisma.subscriptionEvent.create({
        data: { subscriptionId: sub.id, type: 'charge_duplicate_needs_review', payload: { periodKey, clientTransactionId: charge.clientTransactionId } },
      }),
    ]);
    return 'duplicate';
  }

  if (result.approved) {
    const nextPeriodEnd = new Date(now.getTime() + getBillingCycleMs());
    await prisma.$transaction([
      prisma.charge.update({
        where: { id: charge.id },
        data: {
          status: 'APPROVED',
          payphoneTxId: result.transactionId !== null ? String(result.transactionId) : null,
          authorizationCode: result.authorizationCode,
          responseCode: result.responseCode,
          responseMessage: result.responseMessage,
          rawResponse: result.raw as Prisma.InputJsonValue,
          resolvedAt: now,
        },
      }),
      prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          amountCents: amounts.amountWithTax,
          taxCents: amounts.tax,
          currentPeriodEnd: nextPeriodEnd,
          nextChargeAt: nextPeriodEnd,
          graceEndsAt: null,
        },
      }),
      prisma.agent.update({
        where: { id: sub.agentId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionPaidUntil: nextPeriodEnd,
          lastPaymentProvider: 'PAYPHONE',
          ...(result.transactionId !== null ? { payphoneTransactionId: String(result.transactionId) } : {}),
        },
      }),
      prisma.subscriptionEvent.create({
        data: { subscriptionId: sub.id, type: 'charge_approved', payload: { periodKey, transactionId: result.transactionId, amount: amounts.amount } },
      }),
    ]);
    await notify(agent, {
      name: 'charge_approved',
      data: {
        planNombre: getPlan(sub.plan).nombre,
        totalUsd: formatUsd(amounts.amount),
        periodEndStr: formatDateEs(nextPeriodEnd),
        authorizationCode: result.authorizationCode,
      },
    });
    return 'approved';
  }

  // Rechazado por el banco (statusCode=2, seccion 5 del pedido).
  await prisma.$transaction([
    prisma.charge.update({
      where: { id: charge.id },
      data: {
        status: 'DECLINED',
        authorizationCode: result.authorizationCode,
        responseCode: result.responseCode,
        responseMessage: result.responseMessage,
        rawResponse: result.raw as Prisma.InputJsonValue,
        resolvedAt: now,
      },
    }),
    prisma.subscriptionEvent.create({
      data: { subscriptionId: sub.id, type: 'charge_declined', payload: { periodKey, reason: result.responseMessage, responseCode: result.responseCode } },
    }),
  ]);
  // Motivo generico a proposito (nunca el mensaje crudo del banco) - ver
  // el comentario de buildPaymentDeclinedEmail en email-templates.ts.
  await notify(agent, { name: 'charge_declined', data: { planNombre: getPlan(sub.plan).nombre } });
  const next = await scheduleNextAttemptOrExpire(sub, charge.attempt, periodKey, now);
  return next === 'expired' ? 'expired' : 'declined';
}

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logSubscriptionActivation } from '@/lib/real-estate/churn';
import { createMockTransaccion, findAgentById, shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';
import {
  buildPaymentMethodDataFromConfirm,
  confirmPayphoneTransaction,
  isCardChangeClientTransactionId,
  isExpectedCheckoutAmount,
  parseAgentIdFromClientTransactionId,
  parsePlanFromClientTransactionId,
} from '@/lib/real-estate/payments/payphone';
import { encryptAtRest } from '@/lib/real-estate/payments/encryption';
import { CARD_UPDATE_MIN_CENTS, getBillingCycleMs } from '@/lib/real-estate/subscription-config';
import { getCheckoutAmountsInCents, PLANES } from '@/config/planes';

// "Cambiar tarjeta" estando al dia (seccion 7 del pedido de recurrencias):
// el monto cobrado ($1 nominal, ver CARD_UPDATE_MIN_CENTS) nunca es un pago
// de plan, asi que esta rama NUNCA toca Agent.subscriptionStatus/
// subscriptionPaidUntil ni crea una Transaccion (seria enganoso mostrar
// "pagaste tu plan" por $1 en el historial) - solo reemplaza el
// PaymentMethod de la Subscription. Se sale ANTES de la validacion de monto
// contra el precio del plan (isExpectedCheckoutAmount), que rechazaria un
// cobro de $1 por no coincidir con ningun plan.
async function handleCardChangeConfirm(agentId: string, body: { id: number; clientTransactionId: string; ctoken?: string }) {
  const result = await confirmPayphoneTransaction({ id: body.id, clientTransactionId: body.clientTransactionId });
  if (result.transactionStatus !== 'Approved') {
    return NextResponse.json({ error: 'El pago no fue aprobado por Payphone.', status: result.transactionStatus }, { status: 402 });
  }
  if (result.amount !== CARD_UPDATE_MIN_CENTS) {
    return NextResponse.json({ error: 'El monto confirmado no coincide con el cargo esperado para actualizar la tarjeta.' }, { status: 400 });
  }
  if (!body.ctoken) {
    return NextResponse.json({ error: 'Esta tarjeta no se puede guardar automáticamente (no es Visa o Mastercard, o Payphone no autorizó la tokenización).' }, { status: 400 });
  }

  const sub = await prisma.subscription.findUnique({ where: { agentId } });
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!sub || !agent) {
    return NextResponse.json({ error: 'No se encontró tu suscripción.' }, { status: 404 });
  }

  const codingPassword = process.env.PAYPHONE_CODING_PASSWORD;
  const paymentMethodData = codingPassword ? buildPaymentMethodDataFromConfirm({ ctoken: body.ctoken, confirmResult: result, codingPassword }) : null;
  if (!paymentMethodData) {
    return NextResponse.json({ error: 'No se pudo procesar los datos de la tarjeta.' }, { status: 500 });
  }

  const oldPaymentMethodId = sub.paymentMethodId;
  const newPaymentMethod = await prisma.paymentMethod.create({
    data: {
      agentId,
      cardTokenEnc: encryptAtRest(body.ctoken),
      cardHolderEnc: paymentMethodData.cardHolderEnc,
      brand: paymentMethodData.brand,
      lastDigits: paymentMethodData.lastDigits,
      bin: paymentMethodData.bin,
      email: paymentMethodData.email,
      phoneNumber: paymentMethodData.phoneNumber,
      documentId: paymentMethodData.documentId,
      consentAt: new Date(),
      consentIp: 'ver SubscriptionEvent consent_recorded',
      consentText: 'ver SubscriptionEvent consent_recorded',
    },
  });
  await prisma.subscription.update({ where: { id: sub.id }, data: { paymentMethodId: newPaymentMethod.id } });
  if (oldPaymentMethodId) {
    // La tarjeta vieja queda desactivada, no borrada (seccion 8 del pedido:
    // trazabilidad de consentimiento/cobros pasados sigue siendo valida).
    await prisma.paymentMethod.update({ where: { id: oldPaymentMethodId }, data: { active: false } });
  }
  await prisma.subscriptionEvent.create({
    data: { subscriptionId: sub.id, type: 'card_saved', payload: { brand: paymentMethodData.brand, lastDigits: paymentMethodData.lastDigits, reason: 'card_change' } },
  });

  return NextResponse.json({ success: true, cardChanged: true });
}

// Precio fundador (Fase 7, seccion 9.4): decide si esta activacion de Basico
// debe cobrar el precio vigente (y fijarlo como nuevo precio fundador) o el
// precio fundador ya congelado del agente. Es "nueva/reiniciada" cuando el
// agente todavia no tiene precioFundadorBasico, o cuando venia de CANCELED/
// INACTIVE (cancelo y se re-suscribe: pierde el precio fundador anterior).
// Pro nunca toca este campo - se preserva tal cual para que, si el agente
// vuelve a Basico sin haber cancelado, recupere su precio fundador.
function esActivacionNuevaOReiniciada(previo: { subscriptionStatus: string; precioFundadorBasico: number | null }): boolean {
  return !previo.precioFundadorBasico || previo.subscriptionStatus === 'CANCELED' || previo.subscriptionStatus === 'INACTIVE';
}

// Confirma un pago de la Cajita de Payphone. El agente vuelve del pago con
// ?id=...&clientTransactionId=... en la URL; esta ruta hace la llamada
// server-side a Payphone (nunca confiamos en el estado que el cliente diga
// que tuvo el pago) y solo si Payphone responde "Approved" activa la cuenta.
// El plan cobrado se lee del propio clientTransactionId (no de lo que mande
// el cliente en el body): es el unico dato que sobrevive intacto el viaje de
// ida y vuelta a Payphone.
export async function POST(request: NextRequest) {
  try {
    const authSession = await getSessionFromRequest(request);
    if (!authSession || authSession.role !== 'agent' || !authSession.agentId) {
      return NextResponse.json({ error: 'Solo agentes autenticados pueden confirmar su pago.' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { id?: number; clientTransactionId?: string; ctoken?: string } | null;
    if (!body?.id || !body.clientTransactionId) {
      return NextResponse.json({ error: 'id y clientTransactionId son obligatorios.' }, { status: 400 });
    }

    // El clientTransactionId debe corresponder al agente de la sesion - evita
    // que un agente confirme (y active) el pago de otro.
    const ownerAgentId = parseAgentIdFromClientTransactionId(body.clientTransactionId);
    if (ownerAgentId !== authSession.agentId) {
      return NextResponse.json({ error: 'Esta transacción no corresponde a tu cuenta.' }, { status: 403 });
    }

    if (isCardChangeClientTransactionId(body.clientTransactionId)) {
      return handleCardChangeConfirm(authSession.agentId, { id: body.id, clientTransactionId: body.clientTransactionId, ctoken: body.ctoken });
    }

    const plan = parsePlanFromClientTransactionId(body.clientTransactionId);
    if (!plan) {
      return NextResponse.json({ error: 'No se pudo determinar el plan de esta transacción.' }, { status: 400 });
    }

    if (shouldUseMockStore()) {
      // Sin credenciales reales de Payphone en modo mock: se simula un pago
      // aprobado para poder probar el flujo completo sin cobrar de verdad.
      const agent = findAgentById(authSession.agentId);
      if (agent?.payphoneTransactionId === String(body.id)) {
        // Idempotencia: mismo id de transaccion ya procesado (p.ej. el agente
        // recargo la pagina de retorno) - no volver a extender el periodo.
        return NextResponse.json({ success: true, fallback: true, alreadyProcessed: true });
      }
      const paidUntil = new Date(Date.now() + getBillingCycleMs()).toISOString();
      const nuevaOReiniciadaMock = plan === 'BASICO' && esActivacionNuevaOReiniciada({
        subscriptionStatus: agent?.subscriptionStatus ?? 'INACTIVE',
        precioFundadorBasico: agent?.precioFundadorBasico ?? null,
      });
      const founderTotalCentsMock = plan === 'BASICO' && !nuevaOReiniciadaMock ? agent?.precioFundadorBasico : null;
      const patch: Record<string, unknown> = {
        subscriptionStatus: 'ACTIVE',
        subscriptionPaidUntil: paidUntil,
        lastPaymentProvider: 'PAYPHONE',
        payphoneTransactionId: String(body.id),
        plan,
        planDesde: new Date().toISOString(),
        planSiguiente: undefined,
      };
      if (nuevaOReiniciadaMock) {
        patch.precioFundadorBasico = PLANES.BASICO.total;
      }
      updateAgent(authSession.agentId, patch);
      const mockAmounts = getCheckoutAmountsInCents(plan, founderTotalCentsMock);
      createMockTransaccion({
        agentId: authSession.agentId,
        plan,
        provider: 'PAYPHONE',
        amountCents: mockAmounts.amountWithTax,
        taxCents: mockAmounts.tax,
        totalCents: mockAmounts.amount,
        providerTransactionId: String(body.id),
      });
      return NextResponse.json({ success: true, fallback: true });
    }

    const previoAgent = await prisma.agent.findUnique({
      where: { id: authSession.agentId },
      select: { subscriptionStatus: true, precioFundadorBasico: true },
    });
    const nuevaOReiniciada = plan === 'BASICO' && previoAgent && esActivacionNuevaOReiniciada(previoAgent);
    // Precio esperado: si es una activacion nueva/reiniciada de Basico se
    // cobra el vigente (y ese pasa a ser su nuevo precio fundador); si no, se
    // espera el precio fundador ya congelado del agente. Pro siempre al
    // precio vigente.
    const founderTotalCents = plan === 'BASICO' && !nuevaOReiniciada ? previoAgent?.precioFundadorBasico : null;

    const result = await confirmPayphoneTransaction({ id: body.id, clientTransactionId: body.clientTransactionId });

    if (result.transactionStatus !== 'Approved') {
      return NextResponse.json({ error: 'El pago no fue aprobado por Payphone.', status: result.transactionStatus }, { status: 402 });
    }
    if (!isExpectedCheckoutAmount(result.amount, plan, founderTotalCents)) {
      return NextResponse.json({ error: 'El monto confirmado no coincide con el precio del plan.' }, { status: 400 });
    }

    // Idempotencia: si ya existe una Transaccion para este id de Payphone, el
    // pago ya fue procesado - no volver a extender el periodo ni duplicar el
    // registro (seccion 6.5 del pedido de arquitectura de planes).
    const yaRegistrada = await prisma.transaccion.findFirst({
      where: { agentId: authSession.agentId, providerTransactionId: String(result.transactionId) },
    });
    if (yaRegistrada) {
      return NextResponse.json({ success: true, authorizationCode: result.authorizationCode, alreadyProcessed: true });
    }

    const paidUntil = new Date(Date.now() + getBillingCycleMs());
    const amounts = getCheckoutAmountsInCents(plan, founderTotalCents);
    const agentUpdateData: Prisma.AgentUpdateInput = {
      subscriptionStatus: 'ACTIVE',
      subscriptionPaidUntil: paidUntil,
      lastPaymentProvider: 'PAYPHONE',
      payphoneTransactionId: String(result.transactionId),
      plan,
      planDesde: new Date(),
      planSiguiente: null,
      ...(nuevaOReiniciada ? { precioFundadorBasico: PLANES.BASICO.total } : {}),
    };
    try {
      await prisma.$transaction([
        prisma.agent.update({
          where: { id: authSession.agentId },
          data: agentUpdateData,
        }),
        prisma.transaccion.create({
          data: {
            agentId: authSession.agentId,
            plan,
            provider: 'PAYPHONE',
            amountCents: amounts.amountWithTax,
            taxCents: amounts.tax,
            totalCents: amounts.amount,
            providerTransactionId: String(result.transactionId),
            authorizationCode: result.authorizationCode,
          },
        }),
      ]);
      await logSubscriptionActivation(authSession.agentId);
    } catch {
      updateAgent(authSession.agentId, {
        subscriptionStatus: 'ACTIVE',
        subscriptionPaidUntil: paidUntil.toISOString(),
        lastPaymentProvider: 'PAYPHONE',
        payphoneTransactionId: String(result.transactionId),
        plan,
        planDesde: new Date().toISOString(),
        planSiguiente: undefined,
        ...(nuevaOReiniciada ? { precioFundadorBasico: PLANES.BASICO.total } : {}),
      });
    }

    // Motor de recurrencias (Subscription/Charge/PaymentMethod) - en un
    // bloque aparte del $transaction de arriba, a proposito: el cobro YA esta
    // confirmado y el agente YA tiene acceso en este punto (Agent.
    // subscriptionStatus/subscriptionPaidUntil ya se actualizaron), asi que
    // un fallo aca (ENCRYPTION_KEY o PAYPHONE_CODING_PASSWORD mal
    // configuradas, por ejemplo) nunca debe revertir el cobro ni bloquear al
    // agente - seccion 3.8 del pedido: "el sistema debe funcionar sin
    // tokenizacion". El Charge de este intento (creado por
    // /api/subscription/checkout con status PENDING) se actualiza por su
    // clientTransactionId, que es unico - si no existe (el agente pago sin
    // pasar por ese endpoint, p.ej. una activacion vieja) updateMany
    // simplemente no toca nada, no revienta.
    try {
      const subscription = await prisma.subscription.upsert({
        where: { agentId: authSession.agentId },
        create: {
          agentId: authSession.agentId,
          plan,
          status: 'ACTIVE',
          amountCents: amounts.amountWithTax,
          taxCents: amounts.tax,
          currentPeriodEnd: paidUntil,
          nextChargeAt: paidUntil,
          priceLocked: Boolean(nuevaOReiniciada || founderTotalCents),
        },
        update: {
          plan,
          status: 'ACTIVE',
          amountCents: amounts.amountWithTax,
          taxCents: amounts.tax,
          currentPeriodEnd: paidUntil,
          nextChargeAt: paidUntil,
          canceledAt: null,
          cancelAtPeriodEnd: false,
        },
      });

      if (body.clientTransactionId) {
        await prisma.charge.updateMany({
          where: { clientTransactionId: body.clientTransactionId },
          data: {
            status: 'APPROVED',
            payphoneTxId: String(result.transactionId),
            authorizationCode: result.authorizationCode ?? null,
            responseCode: String(result.statusCode),
            responseMessage: result.transactionStatus,
            rawResponse: result as unknown as Prisma.InputJsonValue,
            resolvedAt: new Date(),
          },
        });
      }

      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          type: 'charge_approved',
          payload: { transactionId: result.transactionId, amount: result.amount, plan },
        },
      });

      const codingPassword = process.env.PAYPHONE_CODING_PASSWORD;
      const paymentMethodData = codingPassword
        ? buildPaymentMethodDataFromConfirm({ ctoken: body.ctoken ?? null, confirmResult: result, codingPassword })
        : null;
      if (paymentMethodData && body.ctoken) {
        const consentEvent = await prisma.subscriptionEvent.findFirst({
          where: { subscriptionId: subscription.id, type: 'consent_recorded' },
          orderBy: { createdAt: 'desc' },
        });
        const consentPayload = consentEvent?.payload as { text?: string; ip?: string; acceptedAt?: string } | null;
        const paymentMethod = await prisma.paymentMethod.create({
          data: {
            agentId: authSession.agentId,
            cardTokenEnc: encryptAtRest(body.ctoken),
            cardHolderEnc: paymentMethodData.cardHolderEnc,
            brand: paymentMethodData.brand,
            lastDigits: paymentMethodData.lastDigits,
            bin: paymentMethodData.bin,
            email: paymentMethodData.email,
            phoneNumber: paymentMethodData.phoneNumber,
            documentId: paymentMethodData.documentId,
            consentAt: consentPayload?.acceptedAt ? new Date(consentPayload.acceptedAt) : new Date(),
            consentIp: consentPayload?.ip ?? 'unknown',
            consentText: consentPayload?.text ?? '',
          },
        });
        await prisma.subscription.update({ where: { id: subscription.id }, data: { paymentMethodId: paymentMethod.id } });
        await prisma.subscriptionEvent.create({
          data: { subscriptionId: subscription.id, type: 'card_saved', payload: { brand: paymentMethodData.brand, lastDigits: paymentMethodData.lastDigits } },
        });
      }
    } catch (engineError) {
      console.error('[subscription] no se pudo actualizar el motor de recurrencias tras un pago confirmado', {
        agentId: authSession.agentId,
        transactionId: result.transactionId,
        engineError,
      });
    }

    return NextResponse.json({ success: true, authorizationCode: result.authorizationCode });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo confirmar el pago.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

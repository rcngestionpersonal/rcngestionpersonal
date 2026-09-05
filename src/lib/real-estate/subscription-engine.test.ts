// Bateria de pruebas del motor de recurrencias (pedido de recurrencias,
// seccion 9). Cubre los casos 1, 3, 4, 5 y 6 de esa seccion contra
// processSubscriptionCharge() con un FakeGateway inyectado (el caso 2 -
// idempotencia entre corridas concurrentes del cron real - vive en
// app/api/real-estate/cron/billing/route.test.ts, porque el reclamo de fila
// esta en route.ts, no aca; el caso 7 - reverso automatico de Payphone tras
// 5 minutos - vive en billing/payphone/confirm/route.test.ts).
//
// Estos tests escriben y borran un Agent/Subscription real contra la base de
// Neon (este proyecto no tiene una base de test separada) - cada uno crea su
// propio agente con isTestUser:true y lo borra en un afterEach, asi que son
// seguros de correr en cualquier momento.
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@/lib/prisma-standalone';
import { ChargeUnknownError, FakeGateway, FakeGatewayResults } from './payments/gateway';
import { MAX_UNKNOWN_ERROR_RETRIES, processSubscriptionCharge } from './subscription-engine';

const prisma = createPrismaClient();

function encryptAtRestForTest(plaintext: string): string {
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY!).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ct.toString('hex')}`;
}

describe('processSubscriptionCharge (subscription-engine)', () => {
  let agentId: string;
  let subscriptionId: string;

  beforeEach(async () => {
    // Fija (no aleatoria) y reasignada en cada test a proposito: otros
    // archivos de test (encryption.test.ts) tambien mutan esta misma
    // variable de entorno global, y Vitest puede reusar el mismo proceso
    // entre archivos (fileParallelism:false) - sin esto, un token cifrado
    // con la clave de OTRO archivo no se puede desencriptar aca.
    process.env.ENCRYPTION_KEY = 'fixed-test-key-for-subscription-engine-spec';
    const agent = await prisma.agent.create({
      data: { fullName: 'TEST subscription-engine (borrar)', phone: `+5939${Math.floor(Math.random() * 100000000)}`, isTestUser: true, trialEndsAt: new Date(Date.now() + 30 * 86400000) },
    });
    agentId = agent.id;
    const sub = await prisma.subscription.create({
      data: { agentId, plan: 'BASICO', status: 'ACTIVE', amountCents: 899, taxCents: 135, nextChargeAt: new Date() },
    });
    subscriptionId = sub.id;
  });

  afterEach(async () => {
    await prisma.subscriptionEvent.deleteMany({ where: { subscriptionId } });
    await prisma.charge.deleteMany({ where: { subscriptionId } });
    await prisma.paymentMethod.deleteMany({ where: { agentId } });
    await prisma.subscription.deleteMany({ where: { agentId } });
    await prisma.agent.delete({ where: { id: agentId } });
  });

  async function attachPaymentMethod() {
    const pm = await prisma.paymentMethod.create({
      data: {
        agentId, cardTokenEnc: encryptAtRestForTest('ctoken-fake'), cardHolderEnc: 'enc',
        brand: 'Visa', lastDigits: '4242', bin: '411111', email: 'a@b.com', phoneNumber: '+593999999999', documentId: '0999999999',
        consentAt: new Date(), consentIp: '1.2.3.4', consentText: 'test',
      },
    });
    const sub = await prisma.subscription.update({ where: { id: subscriptionId }, data: { paymentMethodId: pm.id } });
    return sub;
  }

  // Caso 1: cobro aprobado -> suscripcion activa, nextChargeAt a 30 dias, un
  // solo Charge en la tabla.
  it('case 1: an approved charge activates the subscription, extends the period by 30 days, and creates exactly one Charge', async () => {
    const sub = await attachPaymentMethod();
    const gateway = new FakeGateway(() => FakeGatewayResults.approved(42));

    const outcome = await processSubscriptionCharge(sub, gateway, new Date());
    expect(outcome).toBe('approved');

    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(after.status).toBe('ACTIVE');
    expect(after.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);
    expect(after.nextChargeAt!.getTime()).toBe(after.currentPeriodEnd!.getTime());

    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    expect(agent.subscriptionStatus).toBe('ACTIVE');
    expect(agent.subscriptionPaidUntil).not.toBeNull();

    const charges = await prisma.charge.findMany({ where: { subscriptionId } });
    expect(charges).toHaveLength(1);
    expect(charges[0].status).toBe('APPROVED');

    expect(gateway.callCount).toBe(1);
    expect(gateway.callAt(0)!.clientTransactionId.startsWith('RDNM-')).toBe(true);
  });

  // Caso 3: cobro rechazado -> PAST_DUE, servicio intacto, reintento
  // agendado al dia 3.
  it('case 3: a declined charge moves the subscription to PAST_DUE and schedules the retry for day 3', async () => {
    const sub = await attachPaymentMethod();
    const gateway = new FakeGateway(() => FakeGatewayResults.declined('Fondos insuficientes'));

    const now = new Date();
    const outcome = await processSubscriptionCharge(sub, gateway, now);
    expect(outcome).toBe('declined');

    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(after.status).toBe('PAST_DUE');

    const chargeAttempt1 = await prisma.charge.findFirstOrThrow({ where: { subscriptionId, attempt: 1 } });
    const expectedDay3 = new Date(chargeAttempt1.createdAt.getTime() + 3 * 86400000);
    expect(Math.abs(after.nextChargeAt!.getTime() - expectedDay3.getTime())).toBeLessThan(5000);

    // "Servicio intacto": la app trata PAST_DUE igual que ACTIVE para gateo
    // de features (ver access.ts/tieneAcceso() e isAgentActive() en
    // mock-store.ts) - eso se prueba directamente ahi, no aca, pero se dejo
    // registrado el enlace para quien lea este archivo despues.
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    expect(agent.subscriptionStatus).toBe('PAST_DUE');
  });

  // Caso 4: tres rechazos -> EXPIRED, modo lectura, datos intactos.
  it('case 4: three consecutive declines expire the subscription (read-only) without deleting any data', async () => {
    const sub = await attachPaymentMethod();
    const gateway = new FakeGateway(() => FakeGatewayResults.declined('Fondos insuficientes'));

    let current = sub;
    for (let i = 0; i < 3; i++) {
      await processSubscriptionCharge(current, gateway, new Date());
      current = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      // Simula que "llego" cada fecha de reintento programada - salvo tras
      // el 3er intento, donde ya se espera EXPIRED con nextChargeAt=null y
      // forzarlo de nuevo aca pisaria justo lo que este test quiere probar.
      if (i < 2) {
        current = await prisma.subscription.update({ where: { id: subscriptionId }, data: { nextChargeAt: new Date(Date.now() - 1000) } });
      }
    }

    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(after.status).toBe('INACTIVE'); // EXPIRED, ver la nota de integracion en access.ts sobre por que se reusa este enum
    expect(after.nextChargeAt).toBeNull();

    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    expect(agent.subscriptionStatus).toBe('INACTIVE');
    // "Datos intactos": el Agent y todos sus Charge/SubscriptionEvent siguen
    // existiendo (nada se borra por falta de pago).
    expect(await prisma.agent.findUnique({ where: { id: agentId } })).not.toBeNull();
    const charges = await prisma.charge.findMany({ where: { subscriptionId } });
    expect(charges).toHaveLength(3);
    expect(charges.every((c) => c.status === 'DECLINED')).toBe(true);
  });

  // Caso 5: timeout de red en medio del cobro -> el Charge queda en PENDING
  // y la siguiente ejecucion consulta el estado antes de reintentar, nunca
  // cobra a ciegas (en la practica: reintenta con el MISMO
  // clientTransactionId, para que un doble intento choque con el error 23
  // de Payphone en vez de cobrar dos veces).
  it('case 5: a network timeout leaves the Charge PENDING and the retry reuses the same clientTransactionId', async () => {
    const sub = await attachPaymentMethod();
    const gateway = new FakeGateway(() => {
      throw new ChargeUnknownError('timeout simulado');
    });

    const outcome = await processSubscriptionCharge(sub, gateway, new Date());
    expect(outcome).toBe('unknown_error');

    const charge = await prisma.charge.findFirstOrThrow({ where: { subscriptionId } });
    expect(charge.status).toBe('PENDING');

    const afterTimeout = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(afterTimeout.status).toBe('ACTIVE'); // nunca se asume rechazado ni aprobado

    const gateway2 = new FakeGateway(() => FakeGatewayResults.approved(99));
    await processSubscriptionCharge(afterTimeout, gateway2, new Date());
    expect(gateway2.callAt(0)!.clientTransactionId).toBe(charge.clientTransactionId);

    const chargesAfterRetry = await prisma.charge.findMany({ where: { subscriptionId } });
    expect(chargesAfterRetry).toHaveLength(1); // el mismo Charge se actualizo, no se creo uno nuevo
    expect(chargesAfterRetry[0].status).toBe('APPROVED');
  });

  // Caso 6: cancelacion -> el servicio se mantiene hasta el fin del periodo
  // pagado (aca: el cron nunca cobra una suscripcion con cancelAtPeriodEnd,
  // la cierra directo en su fecha de cobro programada).
  it('case 6: cancelAtPeriodEnd never triggers a charge and closes the subscription cleanly at period end', async () => {
    await prisma.subscription.update({ where: { id: subscriptionId }, data: { cancelAtPeriodEnd: true } });
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    const gateway = new FakeGateway(() => FakeGatewayResults.approved()); // no deberia llamarse nunca

    const outcome = await processSubscriptionCharge(sub, gateway, new Date());
    expect(outcome).toBe('canceled');
    expect(gateway.callCount).toBe(0);

    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(after.status).toBe('CANCELED');
    expect(after.nextChargeAt).toBeNull();

    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    expect(agent.subscriptionStatus).toBe('CANCELED');
  });

  // Tope de reintentos tecnicos: sin el, un Payphone permanentemente caido
  // deja la suscripcion reintentando el mismo id todos los dias para
  // siempre, sin cobrar y sin vencer nunca.
  it('caps consecutive technical failures at MAX_UNKNOWN_ERROR_RETRIES and then enters the normal 0/3/7 flow', async () => {
    const sub = await attachPaymentMethod();
    const gateway = new FakeGateway(() => {
      throw new ChargeUnknownError('Payphone caido');
    });

    let current = sub;
    const outcomes: string[] = [];
    for (let i = 0; i < MAX_UNKNOWN_ERROR_RETRIES; i++) {
      outcomes.push(await processSubscriptionCharge(current, gateway, new Date()));
      current = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    }

    // Los primeros 9 no consumen intento ni mueven el estado; el 10mo agota.
    expect(outcomes.slice(0, MAX_UNKNOWN_ERROR_RETRIES - 1).every((o) => o === 'unknown_error')).toBe(true);
    expect(outcomes[MAX_UNKNOWN_ERROR_RETRIES - 1]).toBe('unknown_exhausted');

    // Un solo Charge: los reintentos tecnicos nunca crearon intentos nuevos.
    const charges = await prisma.charge.findMany({ where: { subscriptionId } });
    expect(charges).toHaveLength(1);
    expect(charges[0].attempt).toBe(1); // el timeout no consumio intentos de la ventana 0/3/7
    expect(charges[0].unknownErrorCount).toBe(MAX_UNKNOWN_ERROR_RETRIES);
    expect(charges[0].status).toBe('ERROR'); // ya no PENDING: libera un id nuevo para el proximo intento

    // Entro al flujo normal: PAST_DUE con el reintento agendado al dia 3.
    expect(current.status).toBe('PAST_DUE');
    expect(current.nextChargeAt!.getTime()).toBeGreaterThan(Date.now() + 2 * 86400000);

    const exhausted = await prisma.subscriptionEvent.findMany({ where: { subscriptionId, type: 'charge_unknown_exhausted' } });
    expect(exhausted).toHaveLength(1);
  });

  it('a duplicate (Payphone error 23) never advances the subscription state and stops the same-id retry loop', async () => {
    const sub = await attachPaymentMethod();
    const gateway = new FakeGateway(() => ({
      approved: false,
      statusCode: -1,
      transactionId: null,
      authorizationCode: null,
      responseCode: '23',
      responseMessage: 'ClientTransactionId duplicado',
      raw: {},
      duplicate: true,
    }));

    const outcome = await processSubscriptionCharge(sub, gateway, new Date());
    expect(outcome).toBe('duplicate');

    const charge = await prisma.charge.findFirstOrThrow({ where: { subscriptionId } });
    expect(charge.status).toBe('ERROR'); // no PENDING: frena el loop de reintentar el mismo dia

    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(after.status).toBe('ACTIVE'); // nunca se asume aprobado ni rechazado
    expect(after.nextChargeAt!.getTime()).toBeGreaterThan(Date.now()); // un dia de margen para revision manual
  });

  it('without a saved payment method, follows the same day 0/3/7 grace window as a real decline', async () => {
    // Sin attachPaymentMethod(): la suscripcion nunca tokenizo.
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    const gateway = new FakeGateway(() => FakeGatewayResults.approved()); // no deberia llamarse nunca

    const outcome = await processSubscriptionCharge(sub, gateway, new Date());
    expect(outcome).toBe('no_payment_method');
    expect(gateway.callCount).toBe(0);

    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(after.status).toBe('PAST_DUE');
    expect(after.nextChargeAt!.getTime()).toBeGreaterThan(Date.now() + 2 * 86400000); // ~dia 3
  });
});

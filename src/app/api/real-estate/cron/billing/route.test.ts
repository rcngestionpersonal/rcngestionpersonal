// Prueba de integracion del cron completo (pedido de recurrencias, seccion
// 9, caso 2: "Cron ejecutado dos veces el mismo dia -> un solo cobro, no
// dos"). A diferencia de subscription-engine.test.ts (que llama a
// processSubscriptionCharge directo con un FakeGateway inyectado), aca se
// invoca el handler GET real de esta ruta, para probar tambien el reclamo de
// fila (compare-and-swap sobre claimedAt) que vive en route.ts y no en el
// motor. Mockeamos fetch en vez de inyectar un gateway porque route.ts arma
// su PaymentGateway via getPaymentGateway() (variables de entorno), no por
// parametro - mockear la red es la unica forma de ejercitar el handler real
// sin llamar a Payphone de verdad.
//
// Como el resto de los tests de este motor, escribe y borra un Agent/
// Subscription real contra la base de Neon (no hay base de test separada).
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';

const prisma = new PrismaClient();

function fakePayphoneApprovedResponse() {
  return new Response(
    JSON.stringify({ statusCode: 3, status: 'Approved', transactionId: 987654, authorizationCode: 'AUTHFAKE', messageCode: 0 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('GET /api/real-estate/cron/billing — concurrent-run idempotency', () => {
  let agentId: string;
  let subscriptionId: string;
  const chargeCallUrls: string[] = [];

  beforeEach(async () => {
    process.env.CRON_SECRET = '';
    process.env.PAYPHONE_TOKEN = 'test-token';
    process.env.ENCRYPTION_KEY = 'test-key-for-cron-idempotency-test';
    process.env.PAYPHONE_CODING_PASSWORD = 'test-coding-password';
    // Este test ejercita el cobro real (mockeando fetch) - hay que apagar
    // explicitamente los dos interruptores de seguridad de la fase de cierre
    // (1.1 y 1.2), que por defecto dejarian esto en {skipped:true} o en dry run.
    process.env.BILLING_ENABLED = 'true';
    process.env.BILLING_DRY_RUN = 'false';

    const agent = await prisma.agent.create({
      data: { fullName: 'TEST cron-idempotency (borrar)', phone: '+593900007777', isTestUser: true, trialEndsAt: new Date(Date.now() + 30 * 86400000) },
    });
    agentId = agent.id;

    const crypto = await import('node:crypto');
    const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update('ctoken-fake', 'utf8'), cipher.final()]);
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        agentId, cardTokenEnc: `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ct.toString('hex')}`, cardHolderEnc: 'enc',
        brand: 'Visa', lastDigits: '4242', bin: '411111', email: 'a@b.com', phoneNumber: '+593999999999', documentId: '0999999999',
        consentAt: new Date(), consentIp: '1.2.3.4', consentText: 'test',
      },
    });
    const sub = await prisma.subscription.create({
      data: { agentId, plan: 'BASICO', status: 'ACTIVE', amountCents: 899, taxCents: 135, nextChargeAt: new Date(Date.now() - 1000), paymentMethodId: paymentMethod.id },
    });
    subscriptionId = sub.id;

    chargeCallUrls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      chargeCallUrls.push(url);
      if (url.includes('/api/transaction/web')) return fakePayphoneApprovedResponse();
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await prisma.subscriptionEvent.deleteMany({ where: { subscriptionId } });
    await prisma.charge.deleteMany({ where: { subscriptionId } });
    await prisma.subscription.deleteMany({ where: { agentId } });
    await prisma.paymentMethod.deleteMany({ where: { agentId } });
    await prisma.agent.delete({ where: { id: agentId } });
  });

  it('charges the subscription exactly once when the cron runs twice concurrently for the same due subscription', async () => {
    const req = () => new NextRequest('http://localhost/api/real-estate/cron/billing');

    const [res1, res2] = await Promise.all([GET(req()), GET(req())]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Exactamente una de las dos ejecuciones debio ganar el reclamo y cobrar;
    // la otra debio ver la fila ya reclamada (o, si llego un instante
    // despues, encontrar el Charge ya APPROVED) y no volver a cobrar.
    const charges = await prisma.charge.findMany({ where: { subscriptionId } });
    expect(charges).toHaveLength(1);
    expect(charges[0].status).toBe('APPROVED');

    const paymentCalls = chargeCallUrls.filter((u) => u.includes('/api/transaction/web'));
    expect(paymentCalls).toHaveLength(1);

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe('ACTIVE');
    expect(sub.claimedAt).toBeNull(); // el reclamo se libera al terminar, en cualquiera de los dos resultados
  });

  // Fase de cierre, puntos 1.1 y 1.2: los dos interruptores de seguridad
  // recien agregados. Si estos tests fallaran, el interruptor no interrumpe
  // nada - hay que probarlos, no solo confiar en la lectura del codigo.
  it('touches nothing and never calls Payphone when BILLING_ENABLED is not "true"', async () => {
    process.env.BILLING_ENABLED = 'false';
    const res = await GET(new NextRequest('http://localhost/api/real-estate/cron/billing'));
    expect(await res.json()).toEqual({ skipped: true, reason: 'disabled' });

    const charges = await prisma.charge.findMany({ where: { subscriptionId } });
    expect(charges).toHaveLength(0);
    expect(chargeCallUrls.filter((u) => u.includes('/api/transaction/web'))).toHaveLength(0);
  });

  it('previews the would-be charge without contacting Payphone or creating a real Charge when BILLING_DRY_RUN is left at its default', async () => {
    process.env.BILLING_DRY_RUN = 'true';
    const res = await GET(new NextRequest('http://localhost/api/real-estate/cron/billing'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(json.outcomes.would_charge).toBe(1);

    expect(await prisma.charge.findMany({ where: { subscriptionId } })).toHaveLength(0);
    expect(chargeCallUrls.filter((u) => u.includes('/api/transaction/web'))).toHaveLength(0);

    const events = await prisma.subscriptionEvent.findMany({ where: { subscriptionId, type: 'dry_run_charge' } });
    expect(events).toHaveLength(1);
    const payload = events[0].payload as { wouldSend?: Record<string, unknown> };
    expect(payload.wouldSend).toBeDefined();
    expect(payload.wouldSend).not.toHaveProperty('cardToken');
    expect(payload.wouldSend).not.toHaveProperty('cardHolder');

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe('ACTIVE'); // dry run no cambia el estado real
    expect(sub.claimedAt).toBeNull();
  });
});

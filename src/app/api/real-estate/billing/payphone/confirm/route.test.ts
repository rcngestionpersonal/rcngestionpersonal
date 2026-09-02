// Pedido de recurrencias, seccion 9, caso 7: "Confirmacion de la Cajita
// ejecutada despues de 5 minutos -> el sistema detecta el reverso automatico
// y no activa la suscripcion." Payphone revierte la transaccion pasados los
// 5 minutos (docs.payphone.app/cajita-de-pagos) - eso se traduce, del lado
// de /api/confirm, en una respuesta que NO trae transactionStatus:"Approved"
// (tipicamente "Canceled"). Se mockea fetch para simular exactamente esa
// respuesta tardia, sin depender de esperar 5 minutos reales contra Payphone.
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { buildClientTransactionId } from '@/lib/real-estate/payments/payphone';
import { POST } from './route';

const prisma = new PrismaClient();

describe('POST /api/real-estate/billing/payphone/confirm — late confirmation (auto-reversal)', () => {
  let agentId: string;

  beforeEach(async () => {
    process.env.PAYPHONE_TOKEN = 'test-token';
    const agent = await prisma.agent.create({
      data: { fullName: 'TEST late-confirm (borrar)', phone: '+593900006666', isTestUser: true, trialEndsAt: new Date(Date.now() + 30 * 86400000), subscriptionStatus: 'TRIAL' },
    });
    agentId = agent.id;
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await prisma.subscriptionEvent.deleteMany({ where: { subscription: { agentId } } });
    await prisma.charge.deleteMany({ where: { subscription: { agentId } } });
    await prisma.subscription.deleteMany({ where: { agentId } });
    await prisma.transaccion.deleteMany({ where: { agentId } });
    await prisma.agent.delete({ where: { id: agentId } });
  });

  it('returns 402 and never activates the subscription when Payphone reports the transaction as reversed/canceled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(
        JSON.stringify({ transactionStatus: 'Canceled', statusCode: 2, transactionId: 111, clientTransactionId: 'whatever', amount: 1034 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ));

    const clientTransactionId = buildClientTransactionId(agentId, 'BASICO');
    const token = await signSession({ role: 'agent', agentId, tenantId: 'test' });
    const req = new NextRequest('http://localhost/api/real-estate/billing/payphone/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ id: 111, clientTransactionId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(402);

    // Nada debio activarse: ni el Agent, ni una Subscription/Transaccion nueva.
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    expect(agent.subscriptionStatus).toBe('TRIAL');
    expect(agent.subscriptionPaidUntil).toBeNull();

    const subscription = await prisma.subscription.findUnique({ where: { agentId } });
    expect(subscription).toBeNull();

    const transacciones = await prisma.transaccion.findMany({ where: { agentId } });
    expect(transacciones).toHaveLength(0);
  });
});

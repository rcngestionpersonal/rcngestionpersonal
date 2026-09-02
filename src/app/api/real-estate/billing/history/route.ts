import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listMockTransaccionesByAgent, shouldUseMockStore } from '@/lib/real-estate/mock-store';

// Historial de pagos del propio agente (Fase 7-bis, seccion 3.1; extendido
// para el pedido de recurrencias, seccion 7: "historial de cobros con fecha,
// monto, estado y codigo de autorizacion"). Combina DOS fuentes porque hay
// dos mecanismos de cobro conviviendo (ver la nota en prisma/schema.prisma
// sobre Transaccion vs Charge): Transaccion son los pagos puntuales de la
// Cajita (siempre "exitosos" - solo se crean cuando Payphone aprueba, nunca
// hay una Transaccion de un pago rechazado) y Charge son los intentos del
// motor de cobro recurrente (pueden ser APPROVED, DECLINED, ERROR...). Se
// normalizan a una sola forma para que la UI no tenga que distinguir cual es
// cual.
type HistoryItem = {
  id: string;
  plan: 'BASICO' | 'PRO';
  totalCents: number;
  createdAt: string;
  status: 'APPROVED' | 'DECLINED' | 'ERROR' | 'PENDING' | 'REVERSED';
  authorizationCode: string | null;
};

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados.' }, { status: 403 });
  }

  if (shouldUseMockStore()) {
    const transacciones = listMockTransaccionesByAgent(session.agentId);
    const items: HistoryItem[] = transacciones.map((t) => ({
      id: t.id,
      plan: t.plan,
      totalCents: t.totalCents,
      createdAt: t.createdAt,
      status: 'APPROVED',
      authorizationCode: t.authorizationCode ?? null,
    }));
    return NextResponse.json({ transacciones: items, fallback: true });
  }

  try {
    const [transacciones, charges] = await Promise.all([
      prisma.transaccion.findMany({ where: { agentId: session.agentId } }),
      prisma.charge.findMany({
        where: { subscription: { agentId: session.agentId } },
        include: { subscription: { select: { plan: true } } },
      }),
    ]);

    const fromTransacciones: HistoryItem[] = transacciones.map((t) => ({
      id: t.id,
      plan: t.plan,
      totalCents: t.totalCents,
      createdAt: t.createdAt.toISOString(),
      status: 'APPROVED',
      authorizationCode: t.authorizationCode ?? null,
    }));
    const fromCharges: HistoryItem[] = charges.map((c) => ({
      id: c.id,
      plan: c.subscription.plan,
      totalCents: c.amountCents,
      createdAt: c.createdAt.toISOString(),
      status: c.status,
      authorizationCode: c.authorizationCode ?? null,
    }));

    const items = [...fromTransacciones, ...fromCharges].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ transacciones: items });
  } catch {
    return NextResponse.json({ transacciones: listMockTransaccionesByAgent(session.agentId), fallback: true });
  }
}

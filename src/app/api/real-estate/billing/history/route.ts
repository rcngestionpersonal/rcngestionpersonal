import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listMockTransaccionesByAgent, shouldUseMockStore } from '@/lib/real-estate/mock-store';

// Historial de pagos del propio agente (Fase 7-bis, seccion 3.1) - un bloque
// secundario en Suscripcion, junto al boton de cancelar, sin competir con el
// CTA principal. Nunca expone transacciones de otros agentes.
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados.' }, { status: 403 });
  }

  if (shouldUseMockStore()) {
    return NextResponse.json({ transacciones: listMockTransaccionesByAgent(session.agentId), fallback: true });
  }

  try {
    const transacciones = await prisma.transaccion.findMany({
      where: { agentId: session.agentId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ transacciones });
  } catch {
    return NextResponse.json({ transacciones: listMockTransaccionesByAgent(session.agentId), fallback: true });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getUnseenLevelUp, markLevelUpSeen } from '@/lib/real-estate/points-log';

// GET: hay una subida de nivel sin celebrar? (el modal en Gestion consulta esto
// al cargar el dashboard). POST: el agente ya vio la celebracion, no volver a
// mostrarla para ese nivel.
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ levelUp: null });
  }
  const unseen = await getUnseenLevelUp(session.agentId);
  return NextResponse.json({ levelUp: unseen?.level ?? null });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const levelKey = body?.levelKey;
  if (typeof levelKey !== 'string' || !levelKey) {
    return NextResponse.json({ error: 'levelKey requerido.' }, { status: 400 });
  }
  await markLevelUpSeen(session.agentId, levelKey);
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAgentRankingList } from '@/lib/real-estate/points-log';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const ranking = await getAgentRankingList();
  return NextResponse.json({ ranking, myAgentId: session.agentId ?? null });
}

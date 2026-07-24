import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getChurnDashboard } from '@/lib/real-estate/churn';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador puede ver el dashboard de churn.' }, { status: 403 });
  }

  const months = await getChurnDashboard();
  return NextResponse.json({ months });
}

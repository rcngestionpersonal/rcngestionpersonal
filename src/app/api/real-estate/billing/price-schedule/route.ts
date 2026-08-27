import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { isPlanTipo } from '@/config/planes';
import { listScheduledPriceChanges, scheduleAndNotifyPriceChange } from '@/lib/real-estate/price-schedule';

// Admin-only: programa un cambio de precio (Fase 7, seccion 9.5) y dispara de
// inmediato el aviso por correo a los agentes afectados (nunca a quienes
// tengan precio fundador vigente en Basico). El precio en si (src/config/planes.ts)
// no se reescribe solo - ver la nota de alcance en price-schedule.ts.
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador puede programar cambios de precio.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { plan?: string; newTotalCents?: number; effectiveAt?: string } | null;
  if (!body?.plan || !isPlanTipo(body.plan) || !body.newTotalCents || body.newTotalCents <= 0 || !body.effectiveAt) {
    return NextResponse.json({ error: 'plan, newTotalCents y effectiveAt son obligatorios.' }, { status: 400 });
  }
  const effectiveAt = new Date(body.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'La fecha de entrada en vigor debe ser futura.' }, { status: 400 });
  }

  try {
    const result = await scheduleAndNotifyPriceChange({ plan: body.plan, newTotalCents: body.newTotalCents, effectiveAt });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo programar el cambio de precio.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador puede ver los cambios de precio programados.' }, { status: 403 });
  }
  const changes = await listScheduledPriceChanges();
  return NextResponse.json({ changes });
}

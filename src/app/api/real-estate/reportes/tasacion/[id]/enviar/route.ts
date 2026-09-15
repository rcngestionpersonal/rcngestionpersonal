import { NextRequest, NextResponse } from 'next/server';
import { isEmailConfigured } from '@/lib/real-estate/email';
import { envioSchema } from '@/lib/real-estate/reportes/envio';
import { agenteConReportes } from '@/lib/real-estate/reportes/servidor';
import { enviarTasacionGuardada, tasacionDelAgente } from '@/lib/real-estate/reportes/tasacion-guardada';

// Reenvio de una tasacion ya enviada: mismas cifras y mismo PDF, sin recalcular.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  const t = await tasacionDelAgente(id, auth.agentId);
  if (!t) return NextResponse.json({ error: 'Tasación no encontrada.' }, { status: 404 });

  const envio = envioSchema.safeParse(await request.json().catch(() => null));
  if (!envio.success) return NextResponse.json({ error: 'Datos inválidos.', details: envio.error.flatten().fieldErrors }, { status: 400 });
  if (!isEmailConfigured()) return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });

  return enviarTasacionGuardada(t, envio.data, auth.agentId);
}

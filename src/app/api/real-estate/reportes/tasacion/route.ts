import { NextRequest, NextResponse } from 'next/server';
import { agenteConReportes } from '@/lib/real-estate/reportes/servidor';
import { leerEntrada, prepararTasacion } from '@/lib/real-estate/reportes/tasacion';

// Analisis de tasacion para la pantalla: dice si hay muestra suficiente y, si
// la hay, que va a decir el reporte. No genera ningun archivo.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;

  const parsed = leerEntrada(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Completa tipo, operación, sector y metraje.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const r = await prepararTasacion(parsed.data, auth.agentId);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ resultado: r.resultado, telefonoPropietario: r.telefonoPropietario });
}

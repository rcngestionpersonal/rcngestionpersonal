import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registrarVisita } from '@/lib/real-estate/mini-sitio-server';

// Registra la visita al DETALLE de un inmueble dentro del mini-sitio (punto
// 6.1, "inmueble mas visto"). La visita a la portada la registra el propio
// server component al renderizar; esta hace falta porque el detalle se abre
// en el cliente, sin recargar.
//
// Ruta publica y deliberadamente tolerante: responde 200 pase lo que pase. Es
// una metrica de vanidad para el panel del agente - que falle no puede
// ensuciar la consola del visitante ni sugerirle que algo se rompio.
export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json().catch(() => null)) as { listingId?: unknown } | null;
  const listingId = typeof body?.listingId === 'string' ? body.listingId : null;
  if (!listingId) return NextResponse.json({ ok: true });

  try {
    const miniSitio = await prisma.miniSitio.findUnique({
      where: { slug },
      select: { id: true, activo: true, agentId: true },
    });
    if (!miniSitio?.activo) return NextResponse.json({ ok: true });

    // Solo se cuentan inmuebles que son realmente de este agente: sin esto,
    // cualquiera podria inflar el contador de un inmueble ajeno mandando ids
    // sueltos a este endpoint.
    const esSuyo = await prisma.listing.findFirst({
      where: { id: listingId, managingAgentId: miniSitio.agentId },
      select: { id: true },
    });
    if (!esSuyo) return NextResponse.json({ ok: true });

    await registrarVisita(miniSitio.id, listingId);
  } catch {
    /* metrica best-effort */
  }
  return NextResponse.json({ ok: true });
}

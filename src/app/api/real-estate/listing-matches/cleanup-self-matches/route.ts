import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';

// Limpieza puntual de un bug ya corregido en el motor de matching: antes un
// agente podia hacer "match" con su propio pedido (mismo agente como dueno del
// inmueble y creador del pedido). Estos registros son, por definicion, erroneos
// sin importar quien los cargo - por eso cualquier sesion autenticada puede
// dispararla, no requiere ser admin ni el agente involucrado.
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  if (shouldUseMockStore()) {
    return NextResponse.json({ deleted: 0, fallback: true });
  }

  try {
    const matches = await prisma.listingMatch.findMany({
      include: { opportunity: { select: { createdByAgentId: true } }, listing: { select: { managingAgentId: true } } },
    });
    const selfMatchIds = matches
      .filter((m) => m.opportunity.createdByAgentId && m.opportunity.createdByAgentId === m.listing.managingAgentId)
      .map((m) => m.id);

    if (selfMatchIds.length > 0) {
      await prisma.listingMatch.deleteMany({ where: { id: { in: selfMatchIds } } });
    }

    return NextResponse.json({ deleted: selfMatchIds.length, ids: selfMatchIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

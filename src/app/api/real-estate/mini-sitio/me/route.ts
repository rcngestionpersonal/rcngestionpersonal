import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tieneAccesoPorAgenteId } from '@/lib/real-estate/access-server';
import { MINI_SITIO_FRASE_MAX, esMiniSitioColor } from '@/lib/real-estate/mini-sitio';
import { ensureMiniSitioSlug, metricasMiniSitio } from '@/lib/real-estate/mini-sitio-server';

// Configuracion y metricas del mini-sitio para SU dueño (secciones 3 y 6).
// Requiere sesion de agente y la feature vigente - a diferencia de las rutas
// publicas de /a/[slug], que las ve cualquiera.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ajustesSchema = z.object({
  activo: z.boolean().optional(),
  colorAcento: z.string().refine(esMiniSitioColor, 'Color no válido.').optional(),
  frasePresentacion: z.string().trim().max(MINI_SITIO_FRASE_MAX, `Máximo ${MINI_SITIO_FRASE_MAX} caracteres.`).nullable().optional(),
});

async function agenteConAcceso(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  }
  if (!(await tieneAccesoPorAgenteId(session.agentId, 'mini_sitio'))) {
    return { error: NextResponse.json({ error: 'El mini-sitio es una función del plan Pro.' }, { status: 403 }) };
  }
  return { agentId: session.agentId };
}

export async function GET(request: NextRequest) {
  const auth = await agenteConAcceso(request);
  if (auth.error) return auth.error;

  const miniSitio = await prisma.miniSitio.findUnique({ where: { agentId: auth.agentId } });
  const agente = await prisma.agent.findUnique({
    where: { id: auth.agentId },
    select: { fullName: true, photoUrl: true },
  });

  // Metricas solo si el sitio existe; un sitio que nunca se activo no tiene
  // nada que mostrar y no vale la pena consultarlo.
  const metricas = miniSitio ? await metricasMiniSitio(miniSitio.id) : null;

  // Titulos de los inmuebles mas vistos, para no mostrar un id crudo.
  let inmuebleMasVisto: { titulo: string; visitas: number } | null = null;
  if (metricas?.inmuebleMasVisto) {
    const l = await prisma.listing.findUnique({
      where: { id: metricas.inmuebleMasVisto.listingId },
      select: { title: true },
    });
    if (l) inmuebleMasVisto = { titulo: l.title, visitas: metricas.inmuebleMasVisto.visitas };
  }

  const pedidosRecibidos = await prisma.opportunity.count({
    where: { origen: 'mini_sitio', createdByAgentId: auth.agentId },
  });

  return NextResponse.json({
    miniSitio: miniSitio
      ? {
          slug: miniSitio.slug,
          activo: miniSitio.activo,
          colorAcento: miniSitio.colorAcento,
          frasePresentacion: miniSitio.frasePresentacion,
        }
      : null,
    agente: { fullName: agente?.fullName ?? '', tieneFoto: Boolean(agente?.photoUrl) },
    metricas: metricas
      ? { totalVisitas: metricas.totalVisitas, serieDiaria: metricas.serieDiaria, inmuebleMasVisto, pedidosRecibidos }
      : { totalVisitas: 0, serieDiaria: [], inmuebleMasVisto: null, pedidosRecibidos },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await agenteConAcceso(request);
  if (auth.error) return auth.error;

  const parsed = ajustesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const ajustes = parsed.data;

  const agente = await prisma.agent.findUnique({ where: { id: auth.agentId }, select: { fullName: true } });
  if (!agente) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  const existente = await prisma.miniSitio.findUnique({ where: { agentId: auth.agentId } });

  // El slug se calcula UNA sola vez, al crear la fila. Nunca se recalcula al
  // editar: el agente puede cambiar su nombre despues y los enlaces ya
  // compartidos tienen que seguir funcionando (punto 1.1).
  const miniSitio = existente
    ? await prisma.miniSitio.update({ where: { agentId: auth.agentId }, data: ajustes })
    : await prisma.miniSitio.create({
        data: {
          agentId: auth.agentId,
          slug: await ensureMiniSitioSlug(auth.agentId, agente.fullName),
          ...ajustes,
        },
      });

  return NextResponse.json({
    miniSitio: {
      slug: miniSitio.slug,
      activo: miniSitio.activo,
      colorAcento: miniSitio.colorAcento,
      frasePresentacion: miniSitio.frasePresentacion,
    },
  });
}

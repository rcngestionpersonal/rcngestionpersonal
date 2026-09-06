// Parte del mini-sitio que toca la base (Fase 3). Separado de mini-sitio.ts
// para que las constantes/paleta se puedan importar desde componentes de
// cliente sin arrastrar Prisma - mismo criterio que access.ts/access-server.ts.
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/real-estate/agent-slug';
import { tieneAcceso } from '@/lib/real-estate/access';
import type { MiniSitioEstado } from '@/lib/real-estate/mini-sitio';
import type { PlanTipo } from '@/config/planes';

// Genera el slug UNA sola vez, al activar el mini-sitio, y nunca lo cambia
// (punto 1.1): el agente puede editar su nombre despues y los enlaces ya
// compartidos - WhatsApp, tarjetas impresas, vitrinas - tienen que seguir
// funcionando. Cambiarlo a mano es tarea de soporte, no del propio agente.
//
// Namespace propio: /a/[slug] es independiente de /v/[slug] (el carnet), asi
// que la colision se busca contra MiniSitio, no contra Agent.carnetSlug.
export async function ensureMiniSitioSlug(agentId: string, fullName: string): Promise<string> {
  const existente = await prisma.miniSitio.findUnique({ where: { agentId }, select: { slug: true } });
  if (existente) return existente.slug;

  const base = slugify(fullName) || `agente-${agentId.slice(0, 6)}`;
  let candidato = base;
  let sufijo = 1;
  // En la practica casi nunca itera: solo ante homonimos exactos.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const colision = await prisma.miniSitio.findUnique({ where: { slug: candidato }, select: { agentId: true } });
    if (!colision || colision.agentId === agentId) break;
    sufijo += 1;
    candidato = `${base}-${sufijo}`;
  }
  return candidato;
}

type AgenteMiniSitio = {
  id: string;
  fullName: string;
  plan: PlanTipo;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  subscriptionPaidUntil: Date | null;
};

// Decide si el sitio se muestra. Son DOS condiciones independientes y ambas
// tienen que cumplirse:
//   1. el agente lo activo (MiniSitio.activo), y
//   2. hoy tiene la feature (Pro o trial) - se evalua en cada request, no se
//      cachea en la fila: una suscripcion vencida ayer debe apagar el sitio
//      hoy sin que nadie corra un job.
// El slug y la configuracion se conservan siempre, para que reactivar sea
// instantaneo y el enlace de siempre vuelva a funcionar (punto 7.1).
export function resolverEstadoMiniSitio(
  agente: AgenteMiniSitio | null,
  miniSitio: { activo: boolean } | null,
): MiniSitioEstado {
  if (!agente || !miniSitio) return 'inexistente';
  if (!miniSitio.activo) return 'no_disponible';
  const conAcceso = tieneAcceso(
    {
      plan: agente.plan,
      subscriptionStatus: agente.subscriptionStatus as never,
      trialEndsAt: agente.trialEndsAt,
      subscriptionPaidUntil: agente.subscriptionPaidUntil,
    },
    'mini_sitio',
  );
  return conAcceso ? 'visible' : 'no_disponible';
}

// Registra una visita (punto 6.1). Nunca lanza: una metrica no puede tumbar la
// pagina publica del agente. listingId solo cuando la visita fue al detalle de
// un inmueble.
export async function registrarVisita(miniSitioId: string, listingId?: string | null): Promise<void> {
  try {
    await prisma.miniSitioVisita.create({ data: { miniSitioId, listingId: listingId ?? null } });
  } catch (err) {
    console.error('[mini-sitio] no se pudo registrar la visita', { miniSitioId, err });
  }
}

// Metricas del panel (seccion 6): visitas de los ultimos 30 dias, serie diaria
// para el grafico, e inmueble mas visto.
export async function metricasMiniSitio(miniSitioId: string, dias = 30) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  desde.setUTCHours(0, 0, 0, 0);

  const visitas = await prisma.miniSitioVisita.findMany({
    where: { miniSitioId, createdAt: { gte: desde } },
    select: { createdAt: true, listingId: true },
  });

  const porDia = new Map<string, number>();
  for (let i = 0; i < dias; i++) {
    const d = new Date(desde.getTime() + i * 24 * 60 * 60 * 1000);
    porDia.set(d.toISOString().slice(0, 10), 0);
  }
  const porListing = new Map<string, number>();
  for (const v of visitas) {
    const clave = v.createdAt.toISOString().slice(0, 10);
    if (porDia.has(clave)) porDia.set(clave, (porDia.get(clave) ?? 0) + 1);
    if (v.listingId) porListing.set(v.listingId, (porListing.get(v.listingId) ?? 0) + 1);
  }

  const masVisto = [...porListing.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  return {
    totalVisitas: visitas.length,
    serieDiaria: [...porDia.entries()].map(([dia, total]) => ({ dia, total })),
    inmuebleMasVisto: masVisto ? { listingId: masVisto[0], visitas: masVisto[1] } : null,
  };
}

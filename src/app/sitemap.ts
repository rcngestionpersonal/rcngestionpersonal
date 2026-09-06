import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { tieneAcceso } from '@/lib/real-estate/access';

// Sitemap (punto 5.4): incluye las paginas publicas fijas y los mini-sitios
// ACTIVOS de agentes que hoy tienen la feature.
//
// Los inmuebles NO se listan individualmente (punto 5.5): no tiene sentido
// competir con los portales ni duplicar contenido que ya esta en la pagina
// del agente.
//
// El acceso se recalcula por agente en vez de confiar solo en "activo": un
// mini-sitio de alguien cuya suscripcion vencio devuelve una pagina neutra,
// y anunciarlo al buscador seria mandarlo a un callejon sin salida.
export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://redinmo.io';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/legal/terminos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/privacidad`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/suscripcion`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/cookies`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const sitios = await prisma.miniSitio.findMany({
      where: { activo: true },
      select: {
        slug: true,
        updatedAt: true,
        agent: {
          select: {
            plan: true, subscriptionStatus: true, trialEndsAt: true,
            subscriptionPaidUntil: true, isTestAccount: true,
          },
        },
      },
    });

    const visibles = sitios
      // Las cuentas de prueba nunca se indexan: son datos internos, no
      // agentes reales que quieran aparecer en buscadores.
      .filter((s) => !s.agent.isTestAccount)
      .filter((s) =>
        tieneAcceso(
          {
            plan: s.agent.plan,
            subscriptionStatus: s.agent.subscriptionStatus as never,
            trialEndsAt: s.agent.trialEndsAt,
            subscriptionPaidUntil: s.agent.subscriptionPaidUntil,
          },
          'mini_sitio',
        ),
      )
      .map((s) => ({
        url: `${BASE}/a/${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));

    return [...fijas, ...visibles];
  } catch (err) {
    // Un sitemap incompleto es mucho mejor que un 500: el buscador se queda
    // con las paginas fijas y reintenta despues.
    console.error('[sitemap] no se pudieron cargar los mini-sitios', err);
    return fijas;
  }
}

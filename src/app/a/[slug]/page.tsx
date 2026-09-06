import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getAgentPointsSummary } from '@/lib/real-estate/points-log';
import { levelColorFor } from '@/lib/real-estate/points';
import { zoneLabel } from '@/lib/real-estate/quito-zones';
import { mensajeWhatsAppMiniSitio, resolverColor, urlMiniSitio } from '@/lib/real-estate/mini-sitio';
import { registrarVisita, resolverEstadoMiniSitio } from '@/lib/real-estate/mini-sitio-server';

// Mini-sitio publico del agente (Fase 3). Server component a proposito: el SEO
// y la vista previa de WhatsApp necesitan HTML renderizado en el servidor
// (punto 1.3), no una pantalla que se llene en el cliente.
//
// El tema (claro/oscuro) lo decide el VISITANTE, no el agente (punto 8.4): se
// usan los tokens de globals.css y el ThemeProvider del layout raiz, que ya
// cubre esta ruta con claro por defecto. Lo unico que el agente elige es el
// acento, y de una paleta acotada.
export const dynamic = 'force-dynamic';

const ESPECIALIDAD: Record<string, string> = {
  SALE: 'Venta',
  RENT: 'Arriendo',
  BOTH: 'Venta y arriendo',
};

async function cargarMiniSitio(slug: string) {
  const miniSitio = await prisma.miniSitio.findUnique({
    where: { slug },
    include: {
      agent: {
        select: {
          id: true,
          fullName: true,
          company: true,
          photoUrl: true,
          phone: true,
          zones: true,
          specialty: true,
          specializationZones: true,
          idNumber: true,
          phoneVerifiedAt: true,
          carnetSlug: true,
          createdAt: true,
          plan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          subscriptionPaidUntil: true,
        },
      },
    },
  });
  if (!miniSitio) return null;

  const estado = resolverEstadoMiniSitio(miniSitio.agent, miniSitio);
  if (estado !== 'visible') return { estado, miniSitio: null, agente: null, credibilidad: null };

  const agente = miniSitio.agent;
  const [cierres, inmuebles, puntos] = await Promise.all([
    prisma.closedDeal.count({ where: { createdByAgentId: agente.id } }),
    prisma.listing.count({ where: { managingAgentId: agente.id, status: 'ACTIVE' } }),
    getAgentPointsSummary(agente.id).catch(() => null),
  ]);

  return {
    estado,
    miniSitio,
    agente,
    credibilidad: {
      aniosEnRedinmo: new Date().getFullYear() - agente.createdAt.getFullYear(),
      cierres,
      inmuebles,
      nivel: puntos?.level.labelEs ?? null,
      nivelKey: puntos?.level.key ?? 'BROKER_INICIAL',
    },
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const datos = await cargarMiniSitio(slug).catch(() => null);

  if (!datos || datos.estado !== 'visible' || !datos.agente) {
    // Un sitio apagado o inexistente no se indexa: no tiene sentido dejar
    // rastro en buscadores de una pagina que hoy no muestra nada.
    return { title: 'Perfil no disponible | Redinmo.io', robots: { index: false, follow: false } };
  }

  const { agente, miniSitio } = datos;
  const zonas = zonasDe(agente).slice(0, 3);
  const zonasTexto = zonas.length > 0 ? zonas.join(', ') : 'Quito';
  const titulo = `${agente.fullName} · Agente inmobiliario en ${zonasTexto}`;
  const descripcion =
    miniSitio!.frasePresentacion?.trim() ||
    `${ESPECIALIDAD[agente.specialty] ?? 'Venta y arriendo'} de inmuebles en ${zonasTexto}. Agente verificado en Redinmo.io.`;

  return {
    title: titulo,
    description: descripcion,
    // Indexable (punto 1.2): es justamente el valor comercial de la feature.
    robots: { index: true, follow: true },
    alternates: { canonical: urlMiniSitio(slug) },
    openGraph: {
      title: titulo,
      description: descripcion,
      url: urlMiniSitio(slug),
      siteName: 'Redinmo.io',
      type: 'profile',
      locale: 'es_EC',
      images: [{ url: `/a/${slug}/og`, width: 1200, height: 630, alt: agente.fullName }],
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [`/a/${slug}/og`] },
  };
}

function zonasDe(agente: { specializationZones: string[]; zones: string[] }): string[] {
  const claves = agente.specializationZones.length > 0 ? agente.specializationZones : agente.zones;
  return claves.map((z) => zoneLabel(z, 'es') || z).filter(Boolean);
}

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Pagina neutra y digna (puntos 7.1 y 7.2): el agente existe, pero hoy su
// sitio no esta disponible - porque lo apago o porque su plan dejo de
// incluirlo. Nunca un 500 ni una pagina rota, y sin exponer cual de las dos
// razones es (no es asunto del visitante si alguien dejo de pagar).
function PaginaNoDisponible() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-center text-text">
      <div className="max-w-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
        <h1 className="mt-3 text-xl font-bold">Este perfil no está disponible en este momento</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-2">
          El agente puede volver a activarlo cuando quiera, y este mismo enlace seguirá funcionando.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-accent hover:underline">
          Conocer Redinmo.io →
        </Link>
      </div>
    </main>
  );
}

// 404 con el diseño de la plataforma (punto 7.3).
function PaginaNoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-center text-text">
      <div className="max-w-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
        <h1 className="mt-3 text-xl font-bold">No encontramos este perfil</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-2">
          El enlace puede estar mal escrito o el perfil ya no existe.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-accent hover:underline">
          Ir a Redinmo.io →
        </Link>
      </div>
    </main>
  );
}

export default async function MiniSitioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const datos = await cargarMiniSitio(slug);

  if (!datos) return <PaginaNoEncontrada />;
  if (datos.estado !== 'visible' || !datos.agente || !datos.miniSitio) return <PaginaNoDisponible />;

  const { agente, miniSitio, credibilidad } = datos;
  const color = resolverColor(miniSitio.colorAcento);
  const zonas = zonasDe(agente);
  const verificado = Boolean(agente.idNumber) && Boolean(agente.phoneVerifiedAt);
  const nivelColor = levelColorFor(credibilidad!.nivelKey);

  // La visita se registra sin bloquear el render (punto 6.1): si la metrica
  // falla, la pagina del agente igual se muestra.
  void registrarVisita(miniSitio.id);

  const telefono = (agente.phone ?? '').replace(/[^0-9]/g, '');
  const whatsapp = `https://wa.me/${telefono}?text=${encodeURIComponent(mensajeWhatsAppMiniSitio(agente.fullName))}`;

  // Solo datos verificables, y se omite el item si es cero (punto 2.3): un
  // "0 cierres" resta mas de lo que suma.
  const items: Array<{ valor: string; etiqueta: string }> = [];
  if (credibilidad!.aniosEnRedinmo >= 1) {
    items.push({
      valor: `${credibilidad!.aniosEnRedinmo}`,
      etiqueta: credibilidad!.aniosEnRedinmo === 1 ? 'año en Redinmo.io' : 'años en Redinmo.io',
    });
  }
  if (credibilidad!.cierres > 0) {
    items.push({ valor: `${credibilidad!.cierres}`, etiqueta: credibilidad!.cierres === 1 ? 'cierre registrado' : 'cierres registrados' });
  }
  if (credibilidad!.inmuebles > 0) {
    items.push({ valor: `${credibilidad!.inmuebles}`, etiqueta: credibilidad!.inmuebles === 1 ? 'inmueble gestionado' : 'inmuebles gestionados' });
  }
  if (credibilidad!.nivel) {
    items.push({ valor: credibilidad!.nivel, etiqueta: 'nivel alcanzado' });
  }

  // Schema.org RealEstateAgent (punto 5.3) - solo datos publicos: nunca la
  // cedula ni el domicilio (punto 9.1).
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: agente.fullName,
    ...(agente.company ? { worksFor: { '@type': 'Organization', name: agente.company } } : {}),
    ...(agente.photoUrl ? { image: agente.photoUrl } : {}),
    ...(miniSitio.frasePresentacion ? { description: miniSitio.frasePresentacion } : {}),
    url: urlMiniSitio(slug),
    areaServed: zonas.length > 0 ? zonas : ['Quito'],
    address: { '@type': 'PostalAddress', addressLocality: 'Quito', addressCountry: 'EC' },
  };

  return (
    <main
      className="min-h-screen bg-bg text-text"
      // El acento elegido por el agente se inyecta como variable local, asi
      // los componentes de adentro siguen usando los tokens de siempre.
      style={{ ['--ms-acento' as string]: color.acento, ['--ms-contraste' as string]: color.contraste }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      {/* ---- HERO (punto 2.1) ---- */}
      <section className="px-4 pb-10 pt-12 sm:pt-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          {agente.photoUrl ? (
            <Image
              src={agente.photoUrl}
              alt={`Foto de ${agente.fullName}`}
              width={132}
              height={132}
              priority
              className="h-[132px] w-[132px] rounded-full object-cover outline outline-[3px] outline-offset-[4px]"
              style={{ outlineColor: 'var(--ms-acento)' }}
            />
          ) : (
            // Sin foto: iniciales sobre el color de su nivel (punto 7.4).
            <div
              className="flex h-[132px] w-[132px] items-center justify-center rounded-full text-4xl font-extrabold text-white outline outline-[3px] outline-offset-[4px]"
              style={{ background: nivelColor, outlineColor: 'var(--ms-acento)' }}
            >
              {iniciales(agente.fullName)}
            </div>
          )}

          <h1 className="mt-5 text-2xl font-extrabold sm:text-3xl">{agente.fullName}</h1>
          {agente.company ? <p className="mt-1 text-sm font-semibold text-text-2">{agente.company}</p> : null}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {verificado ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: 'var(--ms-acento)', color: 'var(--ms-contraste)' }}
              >
                ✓ Verificado
              </span>
            ) : null}
            {credibilidad!.nivel ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold"
                style={{ borderColor: nivelColor, color: nivelColor }}
              >
                {credibilidad!.nivel}
              </span>
            ) : null}
          </div>

          {zonas.length > 0 || agente.specialty ? (
            <p className="mt-3 text-sm text-text-2">
              {ESPECIALIDAD[agente.specialty] ?? 'Venta y arriendo'}
              {zonas.length > 0 ? ` · ${zonas.join(' · ')}` : ''}
            </p>
          ) : null}

          {miniSitio.frasePresentacion ? (
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-text-2">{miniSitio.frasePresentacion}</p>
          ) : null}

          <div className="mt-7 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            {telefono ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                // 44px minimo de alto para tactil (punto 8.3).
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl px-7 text-sm font-bold transition-opacity hover:opacity-90 sm:w-auto"
                style={{ background: 'var(--ms-acento)', color: 'var(--ms-contraste)' }}
              >
                Escribirme por WhatsApp
              </a>
            ) : null}
            {agente.carnetSlug ? (
              <Link
                href={`/v/${agente.carnetSlug}`}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-line-strong px-7 text-sm font-semibold text-text-2 transition hover:bg-surface-2 sm:w-auto"
              >
                Ver mi carnet
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---- FRANJA DE CREDIBILIDAD (punto 2.3) ---- */}
      {items.length > 0 ? (
        <section className="border-y border-line bg-surface px-4 py-7">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-5 text-center">
            {items.map((item) => (
              <div key={item.etiqueta}>
                <p className="text-xl font-extrabold" style={{ color: 'var(--ms-acento)' }}>
                  {item.valor}
                </p>
                <p className="mt-0.5 text-xs text-text-2">{item.etiqueta}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- PIE (punto 2.5) ---- */}
      <footer className="px-4 py-10 text-center">
        {agente.carnetSlug ? (
          <Link href={`/v/${agente.carnetSlug}`} className="text-sm font-semibold text-text-2 hover:underline">
            ✓ Agente verificado en Redinmo.io
          </Link>
        ) : (
          <p className="text-sm font-semibold text-text-2">Agente verificado en Redinmo.io</p>
        )}
        {/* Marca presente pero no protagonista, mismo criterio que las fichas. */}
        <p className="mt-2 text-[11.5px] text-text-3">
          Sitio creado con{' '}
          <Link href="/" className="hover:underline">
            Redinmo.io
          </Link>
        </p>
      </footer>
    </main>
  );
}

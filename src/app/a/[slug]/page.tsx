import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSessionFromCookies } from '@/lib/auth';
import { getAgentPointsSummary } from '@/lib/real-estate/points-log';
import { levelColorFor } from '@/lib/real-estate/points';
import { zoneLabel } from '@/lib/real-estate/quito-zones';
import { propertyTypeLabelEs } from '@/lib/real-estate/labels';
import { mensajeWhatsAppMiniSitio, urlMiniSitio, variablesDeColor } from '@/lib/real-estate/mini-sitio';
import { registrarVisita, resolverEstadoMiniSitio } from '@/lib/real-estate/mini-sitio-server';
import InventarioMiniSitio, { type InmuebleMiniSitio } from './_components/InventarioMiniSitio';
import FormularioCaptacion from './_components/FormularioCaptacion';

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
  if (estado !== 'visible') return { estado, miniSitio: null, agente: null, credibilidad: null, listings: [] };

  const agente = miniSitio.agent;
  const [cierres, inmuebles, puntos, listings] = await Promise.all([
    prisma.closedDeal.count({ where: { createdByAgentId: agente.id } }),
    prisma.listing.count({ where: { managingAgentId: agente.id, status: 'ACTIVE' } }),
    getAgentPointsSummary(agente.id).catch(() => null),
    // Solo inmuebles ACTIVOS (punto 2.2), mas recientes primero. Nunca se
    // seleccionan campos privados: ni el dueño, ni su telefono, ni la comision
    // pactada (punto 9.1).
    prisma.listing.findMany({
      where: { managingAgentId: agente.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, propertyType: true, operationType: true,
        price: true, currency: true, zone: true, areaM2: true,
        bedrooms: true, bathrooms: true, parkingSpaces: true,
        photos: { orderBy: { orden: 'asc' }, select: { url: true, miniaturaUrl: true } },
      },
    }),
  ]);

  return {
    estado,
    miniSitio,
    agente,
    listings,
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
  const zonas = zonasDe(agente);
  // Solo para el estado vacio del inventario (punto 5.4): el recordatorio de
  // "aun no tienes inmuebles" es para el dueño, no para un visitante. No
  // habilita ningun dato privado - lo unico que cambia es ese aviso.
  const sesion = await getSessionFromCookies().catch(() => null);
  const esElDueno = sesion?.role === 'agent' && sesion.agentId === agente.id;
  const verificado = Boolean(agente.idNumber) && Boolean(agente.phoneVerifiedAt);
  const nivelColor = levelColorFor(credibilidad!.nivelKey);

  // La visita se registra sin bloquear el render (punto 6.1): si la metrica
  // falla, la pagina del agente igual se muestra.
  void registrarVisita(miniSitio.id);

  const telefono = (agente.phone ?? '').replace(/[^0-9]/g, '');

  const inmuebles: InmuebleMiniSitio[] = datos.listings.map((l) => ({
    id: l.id,
    titulo: l.title,
    tipo: l.propertyType,
    tipoLabel: propertyTypeLabelEs(l.propertyType),
    operacionLabel: l.operationType === 'RENT' ? 'Arriendo' : 'Venta',
    precio: l.price,
    moneda: l.currency,
    sector: l.zone,
    areaM2: l.areaM2,
    dormitorios: l.bedrooms,
    banos: l.bathrooms,
    parqueaderos: l.parkingSpaces,
    fotos: l.photos,
  }));
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
      // "mini-sitio" es la clase que globals.css usa para elegir el tono claro
      // u oscuro del acento segun el tema del VISITANTE (punto 8.4): el agente
      // elige el color, nunca el tema con el que se lo muestran.
      className="mini-sitio min-h-screen bg-bg text-text"
      style={variablesDeColor(miniSitio.colorAcento) as React.CSSProperties}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      {/* ---- HERO (punto 2.1) ----
           Punteado violeta de marca + resplandor radial en el acento del
           agente, ambos en .ms-hero. La marca pone la textura, el agente pone
           el color: es exactamente el reparto del punto 4.4. */}
      <section className="ms-hero px-4 pb-12 pt-14 sm:pt-20">
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

          <h1 className="ms-nombre mt-5 text-[28px] font-extrabold leading-tight tracking-[-0.02em] sm:text-4xl">
            {agente.fullName}
          </h1>
          {agente.company ? <p className="mt-1 text-sm font-semibold text-text-2">{agente.company}</p> : null}

          {/* Sellos de plataforma: SIEMPRE en los colores de Redinmo, nunca en
              el acento del agente (punto 4.4). Si el sello de verificado
              cambiara de color en cada sitio dejaria de ser reconocible como
              garantia, que es justamente su unica funcion. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {verificado ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-dim px-3 py-1.5 text-xs font-bold text-accent">
                ✓ Verificado
              </span>
            ) : null}
            {credibilidad!.nivel ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-dim px-3 py-1.5 text-xs font-bold"
                style={{ color: nivelColor }}
              >
                ● {credibilidad!.nivel}
              </span>
            ) : null}
          </div>

          {/* Especialidad y zonas como chips en el acento del agente: es
              contenido suyo, no una certificacion de la plataforma. */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            <Chip destacado>{ESPECIALIDAD[agente.specialty] ?? 'Venta y arriendo'}</Chip>
            {zonas.map((zona) => (
              <Chip key={zona}>{zona}</Chip>
            ))}
          </div>

          {miniSitio.frasePresentacion ? (
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-text-2">{miniSitio.frasePresentacion}</p>
          ) : null}

          <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            {telefono ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                // 48px de alto: por encima del minimo tactil (punto 8.3).
                className="ms-boton flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-7 text-sm font-bold sm:w-auto"
              >
                <IconoWhatsapp /> Escribirme por WhatsApp
              </a>
            ) : null}
            {agente.carnetSlug ? (
              <Link
                href={`/v/${agente.carnetSlug}`}
                // Enlace al carnet: en colores de marca (punto 4.4), porque
                // lleva a la credencial de la plataforma, no a contenido suyo.
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-accent-line bg-accent-dim px-7 text-sm font-semibold text-accent transition hover:brightness-110 sm:w-auto"
              >
                Ver mi carnet verificado
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---- FRANJA DE CREDIBILIDAD (puntos 1.5 y 2.3) ----
           Tarjetas, no texto suelto: cada dato verificable ocupa su propia
           superficie con borde de acento y el numero grande en color. */}
      {items.length > 0 ? (
        <section className="px-4 pb-4">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.etiqueta}
                className="rounded-2xl border px-4 py-5 text-center"
                style={{ borderColor: 'var(--ms-borde)', background: 'var(--ms-suave)' }}
              >
                {/* El nivel es el unico item con texto en vez de numero:
                    a 24px parte en dos lineas y desalinea la fila. */}
                <p
                  className={`font-extrabold leading-tight ${/^\d+$/.test(item.valor) ? 'text-2xl' : 'text-base'}`}
                  style={{ color: 'var(--ms-acento)' }}
                >
                  {item.valor}
                </p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-text-2">{item.etiqueta}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Divisor />

      {/* ---- INVENTARIO (punto 2.2) ----
           Seccion obligatoria (punto 5.1). Si no hay inmuebles activos, el
           visitante externo no ve nada -un "no hay inmuebles" vacio resta
           credibilidad-, pero el dueño del sitio si ve un recordatorio
           (punto 5.4). */}
      {inmuebles.length > 0 ? (
        <InventarioMiniSitio inmuebles={inmuebles} slug={slug} telefono={telefono} nombreAgente={agente.fullName} />
      ) : esElDueno ? (
        <section className="px-4 py-14">
          <div
            className="mx-auto max-w-md rounded-2xl border border-dashed p-7 text-center"
            style={{ borderColor: 'var(--ms-borde)', background: 'var(--ms-suave)' }}
          >
            <h2 className="text-lg font-extrabold text-text">Aún no tienes inmuebles publicados</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-2">
              Esta sección aparece en tu sitio en cuanto publiques el primero. Solo tú estás viendo este aviso.
            </p>
            <Link href="/" className="ms-boton mt-5 inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-bold">
              Publicar un inmueble
            </Link>
          </div>
        </section>
      ) : null}

      {inmuebles.length > 0 || esElDueno ? <Divisor /> : null}

      {/* ---- FORMULARIO DE CAPTACION (punto 2.4) ---- Obligatorio (punto 5.1):
           es la pieza que convierte el sitio en herramienta de trabajo. */}
      <FormularioCaptacion slug={slug} nombreAgente={agente.fullName} />

      {/* ---- PIE (punto 2.5) ---- En colores de marca siempre (punto 4.4). */}
      <footer className="border-t border-line px-4 py-10 text-center">
        {agente.carnetSlug ? (
          <Link href={`/v/${agente.carnetSlug}`} className="text-sm font-semibold text-accent hover:underline">
            ✓ Agente verificado en Redinmo.io
          </Link>
        ) : (
          <p className="text-sm font-semibold text-text-2">Agente verificado en Redinmo.io</p>
        )}
        {/* Marca presente pero no protagonista, mismo criterio que las fichas. */}
        <p className="mt-2 text-[11.5px] text-text-3">
          Sitio creado con{' '}
          <Link href="/" className="font-semibold hover:underline">
            Redinmo.io
          </Link>
        </p>
      </footer>
    </main>
  );
}

// Chip en el acento del agente. `destacado` invierte el relleno para el dato
// principal (la especialidad), que asi lidera la fila sin necesitar otro color.
function Chip({ children, destacado }: { children: React.ReactNode; destacado?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
      style={
        destacado
          ? { background: 'var(--ms-acento)', color: 'var(--ms-contraste)', borderColor: 'var(--ms-acento)' }
          : { background: 'var(--ms-suave)', color: 'var(--ms-acento)', borderColor: 'var(--ms-borde)' }
      }
    >
      {children}
    </span>
  );
}

function Divisor() {
  return (
    <div className="px-4">
      <hr className="ms-divisor mx-auto max-w-5xl" />
    </div>
  );
}

// Glifo de WhatsApp relleno (mismo criterio que IconWhatsapp del panel): un
// icono de linea generico perderia la asociacion inmediata con "abrir chat".
function IconoWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.36a9.87 9.87 0 0 0 4.62 1.17h.01c5.46 0 9.9-4.45 9.9-9.91S17.5 2 12.04 2Zm0 18.06c-1.5 0-2.98-.4-4.27-1.15l-.31-.18-3.19.8.85-3.1-.2-.32a8.06 8.06 0 0 1-1.24-4.3c0-4.47 3.64-8.1 8.11-8.1a8.06 8.06 0 0 1 8.1 8.1c0 4.47-3.63 8.25-8.85 8.25Zm4.44-6.05c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.71 2.6 4.14 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

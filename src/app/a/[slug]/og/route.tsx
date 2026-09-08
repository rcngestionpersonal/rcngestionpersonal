import { NextResponse } from 'next/server';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { prisma } from '@/lib/prisma';
import { loadFichaFonts } from '@/lib/real-estate/ficha/fonts';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { fetchImageAsDataUri } from '@/lib/real-estate/ficha/photos';
import { getAgentPointsSummary } from '@/lib/real-estate/points-log';
import { zoneLabel } from '@/lib/real-estate/quito-zones';
import { resolverColor } from '@/lib/real-estate/mini-sitio';
import { resolverEstadoMiniSitio } from '@/lib/real-estate/mini-sitio-server';

// Imagen Open Graph del mini-sitio (punto 4.2): 1200x630 con foto, nombre,
// empresa y sellos. Es lo que se ve al pegar el enlace en WhatsApp - o sea, en
// la practica, la portada del sitio, porque casi nadie va a llegar por
// buscador antes que por un enlace compartido.
//
// Usa la misma maquinaria que las fichas (satori -> resvg, mismas fuentes y
// paleta) en vez de next/og: asi el estilo visual es el mismo y no se
// duplican fuentes en el bundle. La paleta oscura es la de identidad de marca.
export const runtime = 'nodejs';
// Se cachea en el CDN: WhatsApp, Telegram y los buscadores piden esta imagen
// muchas veces por cada vez que cambia. 1h es suficiente para que una edicion
// del perfil se refleje sin obligar a regenerar en cada scrape.
export const revalidate = 3600;

const ANCHO = 1200;
const ALTO = 630;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const miniSitio = await prisma.miniSitio.findUnique({
    where: { slug },
    include: {
      agent: {
        select: {
          id: true, fullName: true, company: true, photoUrl: true,
          idNumber: true, phoneVerifiedAt: true, specialty: true,
          zones: true, specializationZones: true,
          plan: true, subscriptionStatus: true, trialEndsAt: true, subscriptionPaidUntil: true,
        },
      },
    },
  });

  // Un sitio apagado o sin feature no expone imagen: si la pagina no se ve,
  // su vista previa tampoco debe seguir circulando por los chats.
  if (!miniSitio || resolverEstadoMiniSitio(miniSitio.agent, miniSitio) !== 'visible') {
    return new NextResponse('No disponible', { status: 404 });
  }

  const agente = miniSitio.agent;
  const paleta = FICHA_PALETTES.oscura;
  // La imagen OG se dibuja siempre sobre la paleta oscura, asi que usa el
  // tono oscuro del acento: el claro seria invisible sobre ese fondo.
  const acento = resolverColor(miniSitio.colorAcento).oscuro.acento;

  const [foto, puntos] = await Promise.all([
    agente.photoUrl ? fetchImageAsDataUri(agente.photoUrl, { maxWidth: 400, quality: 82 }).catch(() => null) : Promise.resolve(null),
    getAgentPointsSummary(agente.id).catch(() => null),
  ]);

  const verificado = Boolean(agente.idNumber) && Boolean(agente.phoneVerifiedAt);
  const nivel = puntos?.level.labelEs ?? null;
  const clavesZona = agente.specializationZones.length > 0 ? agente.specializationZones : agente.zones;
  const zonas = clavesZona.map((z) => zoneLabel(z, 'es') || z).filter(Boolean).slice(0, 3);
  const iniciales = agente.fullName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

  // Sin glifos decorativos (✦, ✓): las fuentes de la ficha no los traen y
  // satori los rasteriza como tofu. La marca y el sello se dibujan con divs.
  const sellos = [verificado ? 'Verificado' : null, nivel].filter(Boolean) as string[];

  const nodo = (
    <div
      style={{
        width: ANCHO, height: ALTO, display: 'flex', flexDirection: 'row',
        background: paleta.bg, color: paleta.text, padding: 64, alignItems: 'center', gap: 52,
      }}
    >
      {/* Franja de acento a la izquierda: el color que el agente eligio para
          su sitio, para que la vista previa y la pagina se reconozcan como lo
          mismo. */}
      <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, width: 14, height: ALTO, background: acento }} />

      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto}
          alt=""
          width={300}
          height={300}
          style={{ width: 300, height: 300, borderRadius: 150, objectFit: 'cover', border: `6px solid ${acento}` }}
        />
      ) : (
        <div
          style={{
            width: 300, height: 300, borderRadius: 150, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: paleta.surface2, border: `6px solid ${acento}`,
            fontSize: 104, fontWeight: 800, color: acento,
          }}
        >
          {iniciales}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Rombo de marca dibujado como div rotado, no como glifo. */}
          <div style={{ display: 'flex', width: 14, height: 14, background: acento, transform: 'rotate(45deg)' }} />
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: acento, letterSpacing: 2 }}>
            REDINMO.IO
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 62, fontWeight: 800, marginTop: 14, lineHeight: 1.05 }}>
          {agente.fullName}
        </div>

        {agente.company ? (
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: paleta.text2, marginTop: 10 }}>
            {agente.company}
          </div>
        ) : null}

        {sellos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 24 }}>
            {sellos.map((sello) => (
              <div
                key={sello}
                style={{
                  display: 'flex', fontSize: 22, fontWeight: 700, padding: '10px 20px',
                  borderRadius: 999, background: paleta.surface2, border: `2px solid ${acento}`, color: acento,
                }}
              >
                {sello}
              </div>
            ))}
          </div>
        ) : null}

        {zonas.length > 0 ? (
          <div style={{ display: 'flex', fontSize: 24, color: paleta.text3, marginTop: 22 }}>
            {zonas.join(' · ')}
          </div>
        ) : null}
      </div>
    </div>
  );

  try {
    const fonts = await loadFichaFonts();
    const svg = await satori(nodo, { width: ANCHO, height: ALTO, fonts });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: ANCHO }, background: paleta.bg }).render().asPng();

    return new NextResponse(Buffer.from(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[mini-sitio/og] no se pudo generar la imagen', { slug, err });
    return new NextResponse('No se pudo generar la imagen', { status: 500 });
  }
}

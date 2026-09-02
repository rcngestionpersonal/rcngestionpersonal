import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAgentById, findListingById, listListingPhotos, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { tieneAccesoPorAgenteId } from '@/lib/real-estate/access-server';
import { fetchImageAsDataUri } from '@/lib/real-estate/ficha/photos';
import { buildFichaAgentSnapshot, buildFichaColegasSnapshot, buildFichaListingSnapshot, sectorLineFor } from '@/lib/real-estate/ficha/snapshot';
import { buildFichaWhatsappQrDataUri, fichaWhatsappMessage } from '@/lib/real-estate/ficha/whatsapp-qr';
import { renderFicha, type FichaFormat, type FichaVersion } from '@/lib/real-estate/ficha/render';
import type { FichaPaletteKey } from '@/lib/real-estate/ficha/palettes';
import { PROPERTY_TYPE_LABELS, type Language } from '@/lib/i18n/dictionary';

// Genera y sirve el PDF/PNG de la ficha. Corre en Node (no Edge): necesita fs
// (fuentes), y los bindings nativos de sharp/@resvg/resvg-js.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERSIONS: FichaVersion[] = ['cliente', 'colega', 'sin_marca', 'redes_post', 'redes_story'];
const PALETTES: FichaPaletteKey[] = ['oscura', 'clara'];
const FORMATS: FichaFormat[] = ['pdf', 'png'];

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'inmueble';
}

// Subconjunto de campos de Listing que la ficha puede leer - a proposito
// nunca incluye ownerName/ownerPhone/address (privacidad). id/createdAt/
// commissionSharePercent son seguros (no identifican al propietario) y
// alimentan la referencia, "tiempo publicado" y el bloque de condiciones
// para colegas. Compartido por la rama mock y la rama Prisma de abajo.
function pickListingFields(l: Record<string, unknown>) {
  return {
    id: l.id as string,
    title: l.title as string,
    operationType: l.operationType as 'SALE' | 'RENT' | 'BOTH',
    propertyType: l.propertyType as string,
    city: l.city as string,
    zone: (l.zone as string | null) ?? null,
    price: l.price as number,
    currency: l.currency as string,
    description: (l.description as string | null) ?? null,
    coverPhotoUrl: (l.coverPhotoUrl as string | null) ?? null,
    createdAt: new Date(l.createdAt as string | Date),
    commissionSharePercent: (l.commissionSharePercent as number) ?? 0,
    managingAgentId: l.managingAgentId as string,
    areaM2: (l.areaM2 as number | null) ?? null,
    bedrooms: (l.bedrooms as number | null) ?? null,
    bathrooms: (l.bathrooms as number | null) ?? null,
    mediosBanos: (l.mediosBanos as number | null) ?? null,
    parkingSpaces: (l.parkingSpaces as number | null) ?? null,
    espaciosAdicionales: (l.espaciosAdicionales as number | null) ?? null,
    antiguedad: (l.antiguedad as string | null) ?? null,
    esIndependiente: (l.esIndependiente as boolean | null) ?? null,
    amoblado: (l.amoblado as string | null) ?? null,
    alicuotaMensual: (l.alicuotaMensual as number | null) ?? null,
    piso: (l.piso as number | null) ?? null,
    tieneAscensor: (l.tieneAscensor as boolean | null) ?? null,
    areasComunales: (l.areasComunales as boolean | null) ?? null,
    esquineroOMedianero: (l.esquineroOMedianero as string | null) ?? null,
    usoSueloTerreno: (l.usoSueloTerreno as string | null) ?? null,
    pisosPermitidos: (l.pisosPermitidos as number | null) ?? null,
    serviciosBasicos: (l.serviciosBasicos as string | null) ?? null,
    frenteM: (l.frenteM as number | null) ?? null,
    nivelLocal: (l.nivelLocal as string | null) ?? null,
    distribucionLocal: (l.distribucionLocal as string | null) ?? null,
    estadoOcupacion: (l.estadoOcupacion as string | null) ?? null,
    canonMensualActual: (l.canonMensualActual as number | null) ?? null,
    alturaLibreM: (l.alturaLibreM as number | null) ?? null,
    accesoCamion: (l.accesoCamion as boolean | null) ?? null,
    terrenoTotalM2: (l.terrenoTotalM2 as number | null) ?? null,
    areaLibrePropiaM2: (l.areaLibrePropiaM2 as number | null) ?? null,
    terrenoLibreExclusivoM2: (l.terrenoLibreExclusivoM2 as number | null) ?? null,
    balconOTerraza: (l.balconOTerraza as boolean | null) ?? null,
  };
}

function pickAgentFields(a: Record<string, unknown>) {
  return {
    fullName: a.fullName as string,
    phone: a.phone as string,
    email: (a.email as string | null) ?? null,
    company: (a.company as string | null) ?? null,
    photoUrl: (a.photoUrl as string | null) ?? null,
    licenseNumber: (a.licenseNumber as string | null) ?? null,
    idNumber: (a.idNumber as string | null) ?? null,
    phoneVerifiedAt: (a.phoneVerifiedAt as string | Date | null) ?? null,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const version = (url.searchParams.get('version') ?? 'cliente') as FichaVersion;
  const palette = (url.searchParams.get('palette') ?? 'oscura') as FichaPaletteKey;
  const format = (url.searchParams.get('format') ?? (version.startsWith('redes_') ? 'png' : 'pdf')) as FichaFormat;
  const lang = (url.searchParams.get('lang') === 'en' ? 'en' : 'es') as Language;
  if (!VERSIONS.includes(version) || !PALETTES.includes(palette) || !FORMATS.includes(format)) {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
  }

  // Defensa en profundidad: el boton ya esta gateado en el cliente, pero la
  // ruta de servidor SIEMPRE vuelve a validar.
  const hasAccess = await tieneAccesoPorAgenteId(session.agentId, 'fichas_pdf');
  if (!hasAccess) {
    return NextResponse.json({ error: 'La ficha PDF es una función Pro.', code: 'feature_locked' }, { status: 403 });
  }

  let listingRaw: Record<string, unknown> | null = null;
  let downloaderAgentRaw: Record<string, unknown> | null = null;
  let photoUrls: string[] = []; // ordenadas, portada primero (ver mas abajo)

  if (shouldUseMockStore()) {
    listingRaw = findListingById(id) as unknown as Record<string, unknown> | null;
    downloaderAgentRaw = findAgentById(session.agentId) as unknown as Record<string, unknown> | null;
    const photos = listListingPhotos(id);
    photoUrls = [...photos].sort((a, b) => Number(b.esPortada) - Number(a.esPortada)).map((p) => p.url);
  } else {
    try {
      const [l, a, photos] = await Promise.all([
        prisma.listing.findUnique({ where: { id } }),
        prisma.agent.findUnique({ where: { id: session.agentId } }),
        prisma.listingPhoto.findMany({ where: { listingId: id }, orderBy: { orden: 'asc' } }),
      ]);
      listingRaw = l as unknown as Record<string, unknown> | null;
      downloaderAgentRaw = a as unknown as Record<string, unknown> | null;
      photoUrls = [...photos].sort((x, y) => Number(y.esPortada) - Number(x.esPortada)).map((p) => p.url);
    } catch (err) {
      console.error('[ficha] data fetch error', { listingId: id, agentId: session.agentId, version, palette, format, lang, err });
      return NextResponse.json({ error: 'No se pudieron cargar los datos del inmueble. Intenta de nuevo.', code: 'data_fetch_failed' }, { status: 500 });
    }
  }

  if (!listingRaw) {
    return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
  }
  if (!downloaderAgentRaw) {
    return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
  }

  try {
    const listingFields = pickListingFields(listingRaw);

    // Portada: preferir la primera de photoUrls (fuente de verdad) y caer a
    // coverPhotoUrl solo como respaldo (inmuebles viejos sin backfill).
    // Galeria: hasta 6 mas (7 fotos reales en total) - el mosaico adaptivo
    // (templates.tsx) dibuja la tarjeta "Ver todas las fotos" como 8vo
    // elemento solo si el inmueble llego al tope de 8 fotos.
    const coverUrl = photoUrls[0] ?? listingFields.coverPhotoUrl ?? null;
    const galleryUrls = photoUrls.slice(1, 7);
    const hasMorePhotos = photoUrls.length > 7;

    const [photoDataUri, galleryPhotoDataUris] = await Promise.all([
      coverUrl ? fetchImageAsDataUri(coverUrl, { maxWidth: 1400, quality: 78 }) : Promise.resolve(null),
      Promise.all(galleryUrls.map((u) => fetchImageAsDataUri(u, { maxWidth: 800, quality: 72 }))),
    ]);

    const listingSnapshot = buildFichaListingSnapshot(
      listingFields,
      lang,
      photoDataUri,
      galleryPhotoDataUris.filter((u): u is string => u !== null),
      hasMorePhotos,
    );

    // Resolucion del agente que aparece en la ficha (seccion 0, regla base):
    // SIEMPRE el agente que descarga, nunca el dueno original del inmueble -
    // "sin marca" no lleva ningun agente. La UNICA excepcion es la version
    // "colega" (seccion 4.2 del rediseno): ahi se muestra al agente que
    // GESTIONA el inmueble (listing.managingAgent), porque el colega
    // necesita coordinar con quien tiene la propiedad, no con quien
    // descargo la ficha. No agregar mas excepciones a esta regla sin
    // actualizar tambien el comentario de arriba.
    let agentRawToShow: Record<string, unknown> | null = null;
    if (version === 'colega') {
      if (listingFields.managingAgentId === session.agentId) {
        agentRawToShow = downloaderAgentRaw;
      } else if (shouldUseMockStore()) {
        agentRawToShow = findAgentById(listingFields.managingAgentId) as unknown as Record<string, unknown> | null;
      } else {
        agentRawToShow = (await prisma.agent.findUnique({ where: { id: listingFields.managingAgentId } })) as unknown as Record<string, unknown> | null;
      }
      if (!agentRawToShow) {
        return NextResponse.json({ error: 'Agente gestor no encontrado.' }, { status: 404 });
      }
    } else if (version !== 'sin_marca') {
      agentRawToShow = downloaderAgentRaw;
    }

    let agentSnapshot = null;
    if (agentRawToShow) {
      const agentFields = pickAgentFields(agentRawToShow);
      const agentFirstName = agentFields.fullName.trim().split(/\s+/)[0] ?? agentFields.fullName;

      const [agentPhotoDataUri, qrDataUri] = await Promise.all([
        agentFields.photoUrl ? fetchImageAsDataUri(agentFields.photoUrl, { maxWidth: 300, quality: 82 }) : Promise.resolve(null),
        buildFichaWhatsappQrDataUri(
          agentFields.phone,
          fichaWhatsappMessage({
            agentFirstName,
            propertyTypeLabel: listingSnapshot.propertyTypeLabel,
            sectorLine: listingSnapshot.sectorLine,
            lang,
          }),
        ),
      ]);

      agentSnapshot = buildFichaAgentSnapshot(agentFields, agentPhotoDataUri, qrDataUri);
    }

    const colegasSnapshot = version === 'colega' ? buildFichaColegasSnapshot(listingFields, lang) : null;

    const rendered = await renderFicha({
      version,
      format,
      paletteKey: palette,
      lang,
      listing: listingSnapshot,
      agent: agentSnapshot,
      colegas: colegasSnapshot,
    });

    const propertyLabel = PROPERTY_TYPE_LABELS[lang][listingFields.propertyType] ?? listingFields.propertyType;
    const filename = `ficha-redinmo-${slugify(`${propertyLabel}-${sectorLineFor(listingFields)}`)}.${rendered.extension}`;

    return new NextResponse(new Uint8Array(rendered.buffer), {
      status: 200,
      headers: {
        'Content-Type': rendered.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(rendered.buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[ficha] render error', {
      listingId: id,
      agentId: session.agentId,
      version,
      palette,
      format,
      lang,
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: 'No se pudo generar la ficha. Ya quedó registrado; si se repite, contáctanos.', code: 'render_failed' },
      { status: 500 },
    );
  }
}

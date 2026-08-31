import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAgentById, findListingById, listListingPhotos, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { tieneAccesoPorAgenteId } from '@/lib/real-estate/access-server';
import { fetchImageAsDataUri } from '@/lib/real-estate/ficha/photos';
import { buildFichaAgentSnapshot, buildFichaListingSnapshot, sectorLineFor } from '@/lib/real-estate/ficha/snapshot';
import { buildFichaWhatsappQrDataUri, fichaWhatsappMessage } from '@/lib/real-estate/ficha/whatsapp-qr';
import { renderFicha, type FichaVersion } from '@/lib/real-estate/ficha/render';
import type { FichaPaletteKey } from '@/lib/real-estate/ficha/palettes';
import { PROPERTY_TYPE_LABELS, type Language } from '@/lib/i18n/dictionary';

// Genera y sirve el PDF/PNG de la ficha (Fase 2). Corre en Node (no Edge):
// necesita fs (fuentes), y los bindings nativos de sharp/@resvg/resvg-js.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERSIONS: FichaVersion[] = ['cliente', 'sin_marca', 'redes_post', 'redes_story'];
const PALETTES: FichaPaletteKey[] = ['oscura', 'clara'];

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
// nunca incluye ownerName/ownerPhone/address (seccion 4 del pedido:
// privacidad). Compartido por la rama mock y la rama Prisma de abajo.
function pickListingFields(l: Record<string, unknown>) {
  return {
    title: l.title as string,
    operationType: l.operationType as 'SALE' | 'RENT' | 'BOTH',
    propertyType: l.propertyType as string,
    city: l.city as string,
    zone: (l.zone as string | null) ?? null,
    price: l.price as number,
    currency: l.currency as string,
    description: (l.description as string | null) ?? null,
    coverPhotoUrl: (l.coverPhotoUrl as string | null) ?? null,
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const version = (url.searchParams.get('version') ?? 'cliente') as FichaVersion;
  const palette = (url.searchParams.get('palette') ?? 'oscura') as FichaPaletteKey;
  const lang = (url.searchParams.get('lang') === 'en' ? 'en' : 'es') as Language;
  if (!VERSIONS.includes(version) || !PALETTES.includes(palette)) {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
  }

  // Defensa en profundidad (seccion 4.4 del pedido de arquitectura de
  // planes): el boton ya esta gateado en el cliente, pero la ruta de
  // servidor SIEMPRE vuelve a validar.
  const hasAccess = await tieneAccesoPorAgenteId(session.agentId, 'fichas_pdf');
  if (!hasAccess) {
    return NextResponse.json({ error: 'La ficha PDF es una función Pro.', code: 'feature_locked' }, { status: 403 });
  }

  let listingRaw: Record<string, unknown> | null = null;
  let agentRaw: Record<string, unknown> | null = null;
  let photoUrls: string[] = []; // ordenadas, portada primero (ver mas abajo)

  if (shouldUseMockStore()) {
    listingRaw = findListingById(id) as unknown as Record<string, unknown> | null;
    agentRaw = findAgentById(session.agentId) as unknown as Record<string, unknown> | null;
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
      agentRaw = a as unknown as Record<string, unknown> | null;
      photoUrls = [...photos].sort((x, y) => Number(y.esPortada) - Number(x.esPortada)).map((p) => p.url);
    } catch (err) {
      console.error('[ficha] data fetch error', { listingId: id, agentId: session.agentId, version, palette, lang, err });
      return NextResponse.json({ error: 'No se pudieron cargar los datos del inmueble. Intenta de nuevo.', code: 'data_fetch_failed' }, { status: 500 });
    }
  }

  if (!listingRaw) {
    return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
  }
  if (!agentRaw) {
    return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
  }

  try {
    const listingFields = pickListingFields(listingRaw);
    // Portada: preferir la primera de photoUrls (fuente de verdad, Fase 4) y
    // caer a coverPhotoUrl solo como respaldo (inmuebles viejos sin
    // backfill). Galeria: el resto, hasta 6 (seccion 3.a del pedido de
    // galeria) - a menor resolucion que la portada porque van varias por
    // pagina, no una sola a pantalla completa.
    const coverUrl = photoUrls[0] ?? listingFields.coverPhotoUrl ?? null;
    const galleryUrls = photoUrls.slice(1, 7);
    const photoMissing = !coverUrl;

    const [photoDataUri, galleryPhotoDataUris] = await Promise.all([
      coverUrl ? fetchImageAsDataUri(coverUrl, { maxWidth: 1400, quality: 78 }) : Promise.resolve(null),
      Promise.all(galleryUrls.map((u) => fetchImageAsDataUri(u, { maxWidth: 800, quality: 72 }))),
    ]);

    const listingSnapshot = buildFichaListingSnapshot(
      listingFields,
      lang,
      photoDataUri,
      galleryPhotoDataUris.filter((u): u is string => u !== null),
    );

    // "Sin marca" (seccion 2.2): ningun dato del agente, ni siquiera el que
    // descarga - el resto de versiones SIEMPRE llevan al agente que descarga,
    // nunca al dueno original del inmueble (regla 0, innegociable).
    let agentSnapshot = null;
    if (version !== 'sin_marca') {
      const agentFullName = agentRaw.fullName as string;
      const agentPhone = agentRaw.phone as string;
      const agentPhotoUrl = (agentRaw.photoUrl as string | null) ?? null;
      const agentFirstName = agentFullName.trim().split(/\s+/)[0] ?? agentFullName;

      const [agentPhotoDataUri, qrDataUri] = await Promise.all([
        agentPhotoUrl ? fetchImageAsDataUri(agentPhotoUrl, { maxWidth: 300, quality: 82 }) : Promise.resolve(null),
        buildFichaWhatsappQrDataUri(
          agentPhone,
          fichaWhatsappMessage({
            agentFirstName,
            propertyTypeLabel: listingSnapshot.propertyTypeLabel,
            sectorLine: listingSnapshot.sectorLine,
            lang,
          }),
        ),
      ]);

      agentSnapshot = buildFichaAgentSnapshot(
        {
          fullName: agentFullName,
          phone: agentPhone,
          direccion: (agentRaw.direccion as string | null) ?? null,
          ciudad: (agentRaw.ciudad as string | null) ?? null,
          licenseNumber: (agentRaw.licenseNumber as string | null) ?? null,
          idNumber: (agentRaw.idNumber as string | null) ?? null,
          phoneVerifiedAt: (agentRaw.phoneVerifiedAt as string | Date | null) ?? null,
        },
        agentPhotoDataUri,
        qrDataUri,
      );
    }

    const rendered = await renderFicha({
      version,
      paletteKey: palette,
      lang,
      listing: listingSnapshot,
      agent: agentSnapshot,
      photoMissing,
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
      lang,
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: 'No se pudo generar el PDF de la ficha. Ya quedó registrado; si se repite, contáctanos.', code: 'render_failed' },
      { status: 500 },
    );
  }
}

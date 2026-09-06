import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchImageAsDataUri } from '@/lib/real-estate/ficha/photos';
import { pickAgentFields, pickListingFields } from '@/lib/real-estate/ficha/pick';
import { buildFichaAgentSnapshot, buildFichaListingSnapshot } from '@/lib/real-estate/ficha/snapshot';
import { buildFichaWhatsappQrDataUri, fichaWhatsappMessage } from '@/lib/real-estate/ficha/whatsapp-qr';
import { renderFicha, type FichaFormat } from '@/lib/real-estate/ficha/render';
import { resolverEstadoMiniSitio } from '@/lib/real-estate/mini-sitio-server';

// Ficha descargable desde el mini-sitio publico (Fase 3, punto 2.2). SIN
// sesion: quien descarga aca es un visitante, no un colega.
//
// EXCEPCION DELIBERADA A LA REGLA DE MARCA DE LAS FICHAS
// ------------------------------------------------------
// La regla general (ver el comentario en api/real-estate/listings/[id]/ficha)
// es que la ficha se genera SIEMPRE con los datos del agente que la descarga.
// Aca es al reves, y a proposito: la ficha lleva SIEMPRE los datos del agente
// dueño del mini-sitio, sin importar quien la descargue.
//
// El motivo es que el supuesto de la regla original no se cumple: alli quien
// descarga es otro agente, que necesita repartir la ficha con SU marca. Aca
// quien descarga es un comprador o vendedor que llego al sitio de un agente
// concreto - ponerle la marca de otro (o ninguna) seria justo lo contrario de
// lo que el sitio existe para hacer. Version "cliente" siempre por lo mismo:
// nunca "colega", que expone las condiciones de comision pactadas.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMATOS: FichaFormat[] = ['pdf', 'png'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string; listingId: string }> }) {
  const { slug, listingId } = await params;
  const formatoParam = request.nextUrl.searchParams.get('format');
  const format: FichaFormat = FORMATOS.includes(formatoParam as FichaFormat) ? (formatoParam as FichaFormat) : 'pdf';

  const miniSitio = await prisma.miniSitio.findUnique({
    where: { slug },
    include: {
      agent: {
        select: {
          id: true, fullName: true, phone: true, email: true, company: true, photoUrl: true,
          licenseNumber: true, idNumber: true, phoneVerifiedAt: true,
          plan: true, subscriptionStatus: true, trialEndsAt: true, subscriptionPaidUntil: true,
        },
      },
    },
  });

  if (!miniSitio || resolverEstadoMiniSitio(miniSitio.agent, miniSitio) !== 'visible' || !miniSitio.mostrarInventario) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  // El inmueble tiene que ser de ESTE agente y estar activo: si no, el
  // endpoint seria una forma de generar fichas de inventario ajeno con la
  // marca de cualquiera.
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, managingAgentId: miniSitio.agent.id, status: 'ACTIVE' },
    include: { photos: { orderBy: { orden: 'asc' }, select: { url: true } } },
  });
  if (!listing) {
    return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });
  }

  try {
    const listingFields = pickListingFields(listing as unknown as Record<string, unknown>);
    const urls = listing.photos.map((p) => p.url);
    const coverUrl = urls[0] ?? listingFields.coverPhotoUrl ?? null;

    const [portada, galeria] = await Promise.all([
      coverUrl ? fetchImageAsDataUri(coverUrl, { maxWidth: 1400, quality: 78 }) : Promise.resolve(null),
      Promise.all(urls.slice(1, 7).map((u) => fetchImageAsDataUri(u, { maxWidth: 800, quality: 72 }))),
    ]);

    const listingSnapshot = buildFichaListingSnapshot(
      listingFields,
      'es',
      portada,
      galeria.filter((u): u is string => u !== null),
      urls.length > 7,
    );

    const agentFields = pickAgentFields(miniSitio.agent as unknown as Record<string, unknown>);
    const primerNombre = agentFields.fullName.trim().split(/\s+/)[0] ?? agentFields.fullName;
    const [fotoAgente, qr] = await Promise.all([
      agentFields.photoUrl ? fetchImageAsDataUri(agentFields.photoUrl, { maxWidth: 300, quality: 82 }) : Promise.resolve(null),
      buildFichaWhatsappQrDataUri(
        agentFields.phone,
        fichaWhatsappMessage({
          agentFirstName: primerNombre,
          propertyTypeLabel: listingSnapshot.propertyTypeLabel,
          sectorLine: listingSnapshot.sectorLine,
          lang: 'es',
        }),
      ),
    ]);

    const agentSnapshot = buildFichaAgentSnapshot(agentFields, fotoAgente, qr);

    const ficha = await renderFicha({
      version: 'cliente',
      format,
      paletteKey: 'oscura',
      lang: 'es',
      listing: listingSnapshot,
      agent: agentSnapshot,
      colegas: null,
    });

    const nombreArchivo = `ficha-${listingId.slice(-6)}.${ficha.extension}`;
    return new NextResponse(new Uint8Array(ficha.buffer), {
      headers: {
        'Content-Type': ficha.contentType,
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (err) {
    console.error('[mini-sitio/ficha] no se pudo generar', { slug, listingId, err });
    return NextResponse.json({ error: 'No se pudo generar la ficha.' }, { status: 500 });
  }
}

// Helpers compartidos por las rutas de galeria (Fase 4) para la rama Prisma -
// el equivalente de syncCoverPhotoUrl()/deleteListingPhoto() de mock-store.ts,
// pero contra la base real.
//
// Invariante unico: "orden" es contiguo desde 0 dentro de cada listing, y la
// foto de orden 0 ES la portada. No hay bandera esPortada (se elimino: tres
// fuentes de verdad para el mismo dato terminaban desincronizadas).
// Listing.coverPhotoUrl es un espejo derivado de la foto de orden 0, nunca una
// fuente: se reescribe con syncCoverPhotoUrlPrisma despues de cada cambio.
import { del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';

// Borra el archivo en Vercel Blob. Nunca lanza: si el borrado falla, la
// operacion de negocio (eliminar la foto o el inmueble) igual debe completarse
// - queda un huerfano, que es molesto pero recuperable, mientras que abortar
// dejaria una fila que el agente cree borrada (punto 5.3 del pedido).
// scripts/cleanup-orphan-blobs.ts existe para encontrar esos huerfanos.
export async function borrarBlobSinFallar(ruta: string | null | undefined): Promise<boolean> {
  if (!ruta) return false; // fotos anteriores al campo "ruta" que el backfill no pudo derivar
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await del(ruta);
    return true;
  } catch (err) {
    console.error('[listing-photos] no se pudo borrar el blob', { ruta, err });
    return false;
  }
}

export async function syncCoverPhotoUrlPrisma(listingId: string): Promise<void> {
  const portada = await prisma.listingPhoto.findFirst({
    where: { listingId },
    orderBy: { orden: 'asc' },
  });
  await prisma.listing.update({ where: { id: listingId }, data: { coverPhotoUrl: portada?.url ?? null } });
}

// Reasigna orden 0..n-1 en UNA transaccion (punto 5.1: nunca huecos ni
// duplicados, ni siquiera transitorios que otra request pueda leer).
async function renumerarPrisma(listingId: string): Promise<void> {
  const fotos = await prisma.listingPhoto.findMany({
    where: { listingId },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, orden: true },
  });
  const cambios = fotos
    .map((foto, i) => ({ foto, i }))
    .filter(({ foto, i }) => foto.orden !== i)
    .map(({ foto, i }) => prisma.listingPhoto.update({ where: { id: foto.id }, data: { orden: i } }));
  if (cambios.length > 0) await prisma.$transaction(cambios);
}

// Borra una foto, renumera el resto (con lo que la siguiente pasa a orden 0 si
// se borro la portada) y borra el archivo en Blob.
export async function deleteListingPhotoPrisma(photoId: string): Promise<{ listingId: string } | null> {
  const photo = await prisma.listingPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return null;

  await prisma.listingPhoto.delete({ where: { id: photoId } });
  await renumerarPrisma(photo.listingId);
  await syncCoverPhotoUrlPrisma(photo.listingId);
  await borrarBlobSinFallar(photo.ruta);

  return { listingId: photo.listingId };
}

// "Hacer principal": mueve la foto al frente y corre el resto una posicion.
// Antes esto solo prendia un booleano; ahora cambia el orden, que es lo unico
// que define la portada.
export async function hacerPortadaPrisma(listingId: string, photoId: string): Promise<boolean> {
  const fotos = await prisma.listingPhoto.findMany({
    where: { listingId },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (!fotos.some((f) => f.id === photoId)) return false;

  const nuevoOrden = [photoId, ...fotos.filter((f) => f.id !== photoId).map((f) => f.id)];
  await prisma.$transaction(
    nuevoOrden.map((id, i) => prisma.listingPhoto.update({ where: { id }, data: { orden: i } })),
  );
  await syncCoverPhotoUrlPrisma(listingId);
  return true;
}

// Aplica un orden explicito (arrastre en la UI). Valida que la lista sea
// exactamente el conjunto actual antes de escribir nada.
export async function reordenarFotosPrisma(listingId: string, ordenIds: string[]): Promise<boolean> {
  const actuales = await prisma.listingPhoto.findMany({ where: { listingId }, select: { id: true } });
  const ids = new Set(actuales.map((f) => f.id));
  if (ids.size !== ordenIds.length || ordenIds.some((id) => !ids.has(id))) return false;

  await prisma.$transaction(
    ordenIds.map((id, i) => prisma.listingPhoto.update({ where: { id }, data: { orden: i } })),
  );
  await syncCoverPhotoUrlPrisma(listingId);
  return true;
}

// Crea la foto reservando su "orden" dentro de una transaccion (punto 5.4):
// leer el maximo y escribir por separado hacia que dos subidas simultaneas del
// mismo inmueble calcularan el mismo orden y quedaran empatadas.
export async function crearFotoPrisma(input: {
  listingId: string;
  url: string;
  ruta: string;
  miniaturaUrl?: string | null;
  ancho?: number | null;
  alto?: number | null;
  tamanoBytes?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    const max = await tx.listingPhoto.aggregate({
      where: { listingId: input.listingId },
      _max: { orden: true },
    });
    const foto = await tx.listingPhoto.create({
      data: {
        listingId: input.listingId,
        url: input.url,
        ruta: input.ruta,
        miniaturaUrl: input.miniaturaUrl ?? null,
        ancho: input.ancho ?? null,
        alto: input.alto ?? null,
        tamanoBytes: input.tamanoBytes ?? null,
        orden: (max._max.orden ?? -1) + 1,
      },
    });
    if (foto.orden === 0) {
      await tx.listing.update({ where: { id: input.listingId }, data: { coverPhotoUrl: foto.url } });
    }
    return foto;
  });
}

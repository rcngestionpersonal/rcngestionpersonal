// Helpers compartidos por las rutas de galeria (Fase 4) para la rama Prisma -
// el equivalente de syncCoverPhotoUrl()/deleteListingPhoto() de mock-store.ts,
// pero contra la base real. Mantiene el mismo invariante: como mucho una
// ListingPhoto por listing con esPortada=true, y Listing.coverPhotoUrl
// siempre refleja esa foto.
import { prisma } from '@/lib/prisma';

export async function syncCoverPhotoUrlPrisma(listingId: string): Promise<void> {
  const cover = await prisma.listingPhoto.findFirst({
    where: { listingId },
    orderBy: [{ esPortada: 'desc' }, { orden: 'asc' }],
  });
  await prisma.listing.update({ where: { id: listingId }, data: { coverPhotoUrl: cover?.url ?? null } });
}

// Borra una foto y, si era la portada, la reasigna a la que quede primera -
// deja orden 0..n-1 contiguo y sincroniza coverPhotoUrl al final.
export async function deleteListingPhotoPrisma(photoId: string): Promise<{ listingId: string } | null> {
  const photo = await prisma.listingPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return null;

  await prisma.listingPhoto.delete({ where: { id: photoId } });

  const remaining = await prisma.listingPhoto.findMany({ where: { listingId: photo.listingId }, orderBy: { orden: 'asc' } });
  const hadCover = photo.esPortada;
  await Promise.all(
    remaining.map((p, i) =>
      prisma.listingPhoto.update({
        where: { id: p.id },
        data: { orden: i, ...(hadCover && i === 0 ? { esPortada: true } : {}) },
      }),
    ),
  );
  await syncCoverPhotoUrlPrisma(photo.listingId);
  return { listingId: photo.listingId };
}

export async function setListingPhotoCoverPrisma(listingId: string, photoId: string): Promise<boolean> {
  const photo = await prisma.listingPhoto.findFirst({ where: { id: photoId, listingId } });
  if (!photo) return false;
  await prisma.listingPhoto.updateMany({ where: { listingId }, data: { esPortada: false } });
  await prisma.listingPhoto.update({ where: { id: photoId }, data: { esPortada: true } });
  await syncCoverPhotoUrlPrisma(listingId);
  return true;
}

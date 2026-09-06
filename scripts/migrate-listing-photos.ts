// Migracion de la galeria de fotos (pedido de galeria, punto 1):
//   - Agrega ruta/miniaturaUrl/ancho/alto/tamanoBytes a ListingPhoto.
//   - Rellena "ruta" (el pathname de Vercel Blob) derivandola de la URL
//     publica, que es lo unico que se guardaba hasta ahora. Sin ese dato no
//     se puede borrar el archivo al eliminar la foto (bug 5.3).
//   - Deja "orden" contiguo desde 0 con la portada primero, y ELIMINA la
//     columna esPortada: orden 0 pasa a ser la unica fuente de verdad.
//   - Resincroniza Listing.coverPhotoUrl desde la foto de orden 0.
//
// Idempotente: correrla de nuevo no cambia nada. Va por HTTPS/WebSocket (no
// TCP 5432, bloqueado en este entorno) y en una sola transaccion.
//
// Correr con: npx tsx --env-file=.env scripts/migrate-listing-photos.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

function rutaDesdeUrl(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\//, '') || null;
  } catch {
    return null;
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const col of [
      '"ruta" TEXT',
      '"miniaturaUrl" TEXT',
      '"ancho" INTEGER',
      '"alto" INTEGER',
      '"tamanoBytes" INTEGER',
    ]) {
      await client.query(`ALTER TABLE "ListingPhoto" ADD COLUMN IF NOT EXISTS ${col}`);
    }

    // Backfill de "ruta" solo donde falta, derivada de la URL publica.
    const { rows: sinRuta } = await client.query<{ id: string; url: string }>(
      'SELECT id, url FROM "ListingPhoto" WHERE "ruta" IS NULL',
    );
    let rellenadas = 0;
    let noParseables = 0;
    for (const foto of sinRuta) {
      const ruta = rutaDesdeUrl(foto.url);
      if (!ruta) {
        noParseables++;
        continue;
      }
      await client.query('UPDATE "ListingPhoto" SET "ruta" = $1 WHERE id = $2', [ruta, foto.id]);
      rellenadas++;
    }

    // Orden contiguo desde 0, con la portada vieja primero. Se hace ANTES de
    // soltar esPortada: despues ya no habria como saber cual era.
    const { rows: columnas } = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ListingPhoto' AND column_name = 'esPortada'`,
    );
    const teniaEsPortada = columnas.length > 0;

    const ordenSql = teniaEsPortada
      ? `ROW_NUMBER() OVER (PARTITION BY "listingId" ORDER BY "esPortada" DESC, "orden" ASC, "createdAt" ASC) - 1`
      : `ROW_NUMBER() OVER (PARTITION BY "listingId" ORDER BY "orden" ASC, "createdAt" ASC) - 1`;

    const { rowCount: reordenadas } = await client.query(
      `WITH ordenado AS (SELECT id, ${ordenSql} AS nuevo FROM "ListingPhoto")
       UPDATE "ListingPhoto" p SET "orden" = o.nuevo
         FROM ordenado o WHERE p.id = o.id AND p."orden" <> o.nuevo`,
    );

    if (teniaEsPortada) {
      await client.query('ALTER TABLE "ListingPhoto" DROP COLUMN "esPortada"');
    }

    // coverPhotoUrl vuelve a ser estrictamente derivado de la foto de orden 0
    // (NULL si el inmueble se quedo sin fotos).
    const { rowCount: portadasSincronizadas } = await client.query(
      `UPDATE "Listing" l
          SET "coverPhotoUrl" = (
            SELECT url FROM "ListingPhoto" WHERE "listingId" = l.id ORDER BY "orden" ASC LIMIT 1
          )
        WHERE "coverPhotoUrl" IS DISTINCT FROM (
            SELECT url FROM "ListingPhoto" WHERE "listingId" = l.id ORDER BY "orden" ASC LIMIT 1
          )`,
    );

    await client.query('COMMIT');

    console.log(JSON.stringify({
      columnasAgregadas: 'ruta, miniaturaUrl, ancho, alto, tamanoBytes',
      rutasRellenadas: rellenadas,
      urlsNoParseables: noParseables,
      fotosReordenadas: reordenadas ?? 0,
      esPortadaEliminada: teniaEsPortada,
      coverPhotoUrlResincronizados: portadasSincronizadas ?? 0,
    }, null, 2));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

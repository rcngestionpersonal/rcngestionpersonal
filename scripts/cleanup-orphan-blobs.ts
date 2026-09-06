// Encuentra archivos en Vercel Blob que ya no tiene referenciados ninguna fila
// de ListingPhoto (punto 5.3 del pedido de galeria).
//
// SOLO REPORTA. No borra nada, a proposito: un borrado masivo guiado por un
// listado mal filtrado es irreversible, y las fotos de los agentes no se
// reponen. Antes de agregarle un modo --borrar hay que mirar su salida al
// menos una vez y confirmar que lo que lista es realmente basura.
//
// Los huerfanos vienen sobre todo de antes de que existiera el campo "ruta":
// hasta entonces borrar una foto eliminaba la fila y dejaba el archivo.
//
// Correr con: npx tsx --env-file=.env scripts/cleanup-orphan-blobs.ts
import { list } from '@vercel/blob';
import { createPrismaClient } from '../src/lib/prisma-standalone';

const prisma = createPrismaClient();

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Falta BLOB_READ_WRITE_TOKEN. No hay como listar los blobs.');
    process.exitCode = 1;
    return;
  }

  // Todas las rutas referenciadas. Se comparan tambien las URLs por si alguna
  // fila vieja quedo sin "ruta" y el backfill no pudo derivarla.
  const fotos = await prisma.listingPhoto.findMany({ select: { ruta: true, url: true } });
  const referenciadas = new Set<string>();
  for (const f of fotos) {
    if (f.ruta) referenciadas.add(f.ruta);
    try {
      referenciadas.add(new URL(f.url).pathname.replace(/^\//, ''));
    } catch {
      /* url no parseable: no aporta nada al set */
    }
  }

  // Las fotos de perfil de agente viven bajo agents/ en el mismo store y no
  // tienen fila en ListingPhoto - excluirlas o se reportarian como huerfanas.
  const PREFIJO = 'listings/';

  let cursor: string | undefined;
  let revisados = 0;
  let bytesHuerfanos = 0;
  const huerfanos: Array<{ pathname: string; size: number; uploadedAt: Date }> = [];

  do {
    const respuesta = await list({ prefix: PREFIJO, cursor, limit: 1000 });
    for (const blob of respuesta.blobs) {
      revisados++;
      if (referenciadas.has(blob.pathname)) continue;
      huerfanos.push({ pathname: blob.pathname, size: blob.size, uploadedAt: blob.uploadedAt });
      bytesHuerfanos += blob.size;
    }
    cursor = respuesta.hasMore ? respuesta.cursor : undefined;
  } while (cursor);

  console.log(`\n=== Blobs bajo "${PREFIJO}" ===`);
  console.log(`  Revisados:     ${revisados}`);
  console.log(`  Referenciados: ${revisados - huerfanos.length}`);
  console.log(`  Huerfanos:     ${huerfanos.length} (${formatearBytes(bytesHuerfanos)})`);

  if (huerfanos.length > 0) {
    console.log(`\n=== Huerfanos (NO se borra nada) ===`);
    for (const h of huerfanos.sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())) {
      console.log(`  ${h.uploadedAt.toISOString().slice(0, 10)}  ${formatearBytes(h.size).padStart(9)}  ${h.pathname}`);
    }
    console.log(`\nRevisa la lista antes de borrar nada a mano.`);
  }
  console.log('');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

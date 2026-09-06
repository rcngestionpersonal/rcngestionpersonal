// Migracion del mini-sitio del agente (Fase 3): crea MiniSitio y
// MiniSitioVisita, y agrega Opportunity.origen para distinguir los pedidos
// entrantes del formulario de captacion de los que carga el agente a mano.
//
// Idempotente y transaccional. Va por HTTPS/WebSocket (no TCP 5432, bloqueado
// en este entorno - ver src/lib/prisma-standalone.ts).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-mini-sitio.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "MiniSitio" (
        "id"                TEXT PRIMARY KEY,
        "agentId"           TEXT NOT NULL UNIQUE REFERENCES "Agent"("id") ON DELETE CASCADE,
        "slug"              TEXT NOT NULL UNIQUE,
        "activo"            BOOLEAN NOT NULL DEFAULT false,
        "colorAcento"       TEXT NOT NULL DEFAULT 'violeta',
        "mostrarInventario" BOOLEAN NOT NULL DEFAULT true,
        "mostrarFormulario" BOOLEAN NOT NULL DEFAULT true,
        "frasePresentacion" TEXT,
        "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS "MiniSitio_activo_idx" ON "MiniSitio"("activo")');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "MiniSitioVisita" (
        "id"          TEXT PRIMARY KEY,
        "miniSitioId" TEXT NOT NULL REFERENCES "MiniSitio"("id") ON DELETE CASCADE,
        "listingId"   TEXT,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query(
      'CREATE INDEX IF NOT EXISTS "MiniSitioVisita_miniSitioId_createdAt_idx" ON "MiniSitioVisita"("miniSitioId", "createdAt")',
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS "MiniSitioVisita_miniSitioId_listingId_idx" ON "MiniSitioVisita"("miniSitioId", "listingId")',
    );

    await client.query(
      `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "origen" TEXT NOT NULL DEFAULT 'manual'`,
    );

    await client.query('COMMIT');

    const { rows } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM "MiniSitio")::int        AS mini_sitios,
        (SELECT COUNT(*) FROM "MiniSitioVisita")::int  AS visitas,
        (SELECT COUNT(*) FROM "Opportunity" WHERE "origen" = 'manual')::int AS pedidos_manuales`);

    console.log(JSON.stringify({ tablasCreadas: ['MiniSitio', 'MiniSitioVisita'], columnaAgregada: 'Opportunity.origen', estado: rows[0] }, null, 2));
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

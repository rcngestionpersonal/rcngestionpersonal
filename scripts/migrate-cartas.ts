// Migracion de las cartas de presentacion (Fase 4): crea Carta y
// CartaGeneracion, y agrega a Agent la preferencia de imagen del encabezado.
//
// Idempotente y transaccional. Va por HTTPS/WebSocket (no TCP 5432, bloqueado
// en este entorno - ver src/lib/prisma-standalone.ts).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-cartas.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Los enums se crean solo si no existen: CREATE TYPE no acepta IF NOT
    // EXISTS, asi que se consulta primero.
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CartaDestinatario') THEN
          CREATE TYPE "CartaDestinatario" AS ENUM ('PROPIETARIO', 'COLEGA', 'CONSTRUCTORA', 'EMPRESA');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CartaEstado') THEN
          CREATE TYPE "CartaEstado" AS ENUM ('BORRADOR', 'ENVIADA');
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Carta" (
        "id"                 TEXT PRIMARY KEY,
        "agentId"            TEXT NOT NULL REFERENCES "Agent"("id") ON DELETE CASCADE,
        "destinatarioTipo"   "CartaDestinatario" NOT NULL,
        "destinatarioNombre" TEXT NOT NULL,
        "destinatarioCargo"  TEXT,
        "contexto"           TEXT,
        "bloques"            JSONB NOT NULL,
        "bloquesOriginales"  JSONB NOT NULL,
        "datosUsados"        JSONB NOT NULL,
        "imagenTipo"         TEXT NOT NULL DEFAULT 'foto',
        "paleta"             TEXT NOT NULL DEFAULT 'clara',
        "estado"             "CartaEstado" NOT NULL DEFAULT 'BORRADOR',
        "revisadaAt"         TIMESTAMP(3),
        "enviadaAt"          TIMESTAMP(3),
        "enviadaA"           TEXT,
        "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS "Carta_agentId_createdAt_idx" ON "Carta"("agentId", "createdAt")');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "CartaGeneracion" (
        "id"            TEXT PRIMARY KEY,
        "agentId"       TEXT NOT NULL REFERENCES "Agent"("id") ON DELETE CASCADE,
        "tipo"          TEXT NOT NULL,
        "cartaId"       TEXT,
        "modelo"        TEXT,
        "tokensEntrada" INTEGER,
        "tokensSalida"  INTEGER,
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query(
      'CREATE INDEX IF NOT EXISTS "CartaGeneracion_agentId_createdAt_idx" ON "CartaGeneracion"("agentId", "createdAt")',
    );

    await client.query('ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "cartaImagenTipo" TEXT');
    await client.query('ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "cartaLogoUrl" TEXT');

    await client.query('COMMIT');

    const tablas = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('Carta', 'CartaGeneracion')`,
    );
    if (tablas.rowCount !== 2) throw new Error('Faltan tablas despues de la migracion.');

    console.log('Listo: cartas de presentacion migradas.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

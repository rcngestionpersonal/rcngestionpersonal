// Migracion del modulo de contratos: crea Contrato y ContratoFirmante con sus
// dos enums, y agrega el vinculo desde Agent.
//
// Aditiva e idempotente. Va por HTTPS/WebSocket (no TCP 5432, bloqueado en
// este entorno - ver src/lib/prisma-standalone.ts).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-contratos.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContratoTipo') THEN
          CREATE TYPE "ContratoTipo" AS ENUM ('CORRETAJE', 'ARRENDAMIENTO', 'RESERVA_ARRIENDO', 'RESERVA_COMPRAVENTA');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContratoEstado') THEN
          CREATE TYPE "ContratoEstado" AS ENUM ('BORRADOR', 'PENDIENTE_FIRMA', 'FIRMADO', 'RECHAZADO', 'ANULADO');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FirmanteEstado') THEN
          CREATE TYPE "FirmanteEstado" AS ENUM ('ENVIADO', 'ABIERTO', 'FIRMADO', 'RECHAZADO');
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Contrato" (
        "id"                 TEXT PRIMARY KEY,
        "agentId"            TEXT NOT NULL REFERENCES "Agent"("id") ON DELETE CASCADE,
        "tipo"               "ContratoTipo" NOT NULL,
        "listingId"          TEXT,
        "plantillaVersion"   TEXT NOT NULL,
        "datosCifrados"      TEXT NOT NULL,
        "estado"             "ContratoEstado" NOT NULL DEFAULT 'BORRADOR',
        "hashDocumento"      TEXT,
        "codigoVerificacion" TEXT NOT NULL UNIQUE,
        "anuladoNota"        TEXT,
        "enviadoAt"          TIMESTAMP(3),
        "firmadoAt"          TIMESTAMP(3),
        "anuladoAt"          TIMESTAMP(3),
        "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS "Contrato_agentId_createdAt_idx" ON "Contrato"("agentId", "createdAt")');
    await client.query('CREATE INDEX IF NOT EXISTS "Contrato_estado_idx" ON "Contrato"("estado")');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "ContratoFirmante" (
        "id"               TEXT PRIMARY KEY,
        "contratoId"       TEXT NOT NULL REFERENCES "Contrato"("id") ON DELETE CASCADE,
        "rol"              TEXT NOT NULL,
        "nombre"           TEXT NOT NULL,
        "correo"           TEXT NOT NULL,
        "cedulaCifrada"    TEXT NOT NULL,
        "cedulaUlt4"       TEXT NOT NULL,
        "tokenHash"        TEXT NOT NULL UNIQUE,
        "expiraAt"         TIMESTAMP(3) NOT NULL,
        "estado"           "FirmanteEstado" NOT NULL DEFAULT 'ENVIADO',
        "enviadoAt"        TIMESTAMP(3),
        "abiertoAt"        TIMESTAMP(3),
        "firmadoAt"        TIMESTAMP(3),
        "rechazadoAt"      TIMESTAMP(3),
        "motivoRechazo"    TEXT,
        "recordatorioAt"   TIMESTAMP(3),
        "evidenciaCifrada" TEXT
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS "ContratoFirmante_contratoId_idx" ON "ContratoFirmante"("contratoId")');
    await client.query('CREATE INDEX IF NOT EXISTS "ContratoFirmante_estado_expiraAt_idx" ON "ContratoFirmante"("estado", "expiraAt")');

    await client.query('COMMIT');

    const tablas = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('Contrato', 'ContratoFirmante')`,
    );
    if (tablas.rowCount !== 2) throw new Error('Faltan tablas despues de la migracion.');

    console.log('Listo: modulo de contratos migrado.');
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

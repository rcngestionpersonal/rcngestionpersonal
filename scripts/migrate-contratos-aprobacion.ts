// Migracion: de firma electronica a APROBACION DE BORRADOR con versiones.
//
//   ContratoEstado          + EN_APROBACION, APROBADO
//   FirmanteEstado          + APROBADO (el modelo Prisma se llama ContratoParte)
//   ContratoVersionEstado   tipo nuevo
//   ContratoVersion         tabla nueva: cada envio, congelado y cifrado
//   Contrato                + versionActual, aprobadoAt
//   ContratoFirmante        + versionId, aprobadoAt
//
// Aditiva e idempotente. No toca ninguna fila existente: los contratos del
// flujo de firma quedan como estaban.
//
// Los ADD VALUE van FUERA de la transaccion: PostgreSQL no deja usar un valor
// de enum en la misma transaccion en la que se agrega, y agregarlo dos veces
// con IF NOT EXISTS no falla.
//
// Va por HTTPS/WebSocket (no TCP 5432, bloqueado en este entorno).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-contratos-aprobacion.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const VALORES_ENUM = [
  `ALTER TYPE "ContratoEstado" ADD VALUE IF NOT EXISTS 'EN_APROBACION'`,
  `ALTER TYPE "ContratoEstado" ADD VALUE IF NOT EXISTS 'APROBADO'`,
  `ALTER TYPE "FirmanteEstado" ADD VALUE IF NOT EXISTS 'APROBADO'`,
];

const SENTENCIAS = [
  `DO $$ BEGIN
     CREATE TYPE "ContratoVersionEstado" AS ENUM ('EN_APROBACION', 'APROBADA', 'RECHAZADA', 'REEMPLAZADA', 'ANULADA');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,

  `CREATE TABLE IF NOT EXISTS "ContratoVersion" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "plantillaVersion" TEXT NOT NULL,
    "documentoCifrado" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "estado" "ContratoVersionEstado" NOT NULL DEFAULT 'EN_APROBACION',
    "enviadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobadaAt" TIMESTAMP(3),
    "cerradaAt" TIMESTAMP(3),
    CONSTRAINT "ContratoVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContratoVersion_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ContratoVersion_contratoId_numero_key" ON "ContratoVersion"("contratoId", "numero")`,

  `ALTER TABLE "Contrato" ADD COLUMN IF NOT EXISTS "versionActual" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Contrato" ADD COLUMN IF NOT EXISTS "aprobadoAt" TIMESTAMP(3)`,

  `ALTER TABLE "ContratoFirmante" ADD COLUMN IF NOT EXISTS "versionId" TEXT`,
  `ALTER TABLE "ContratoFirmante" ADD COLUMN IF NOT EXISTS "aprobadoAt" TIMESTAMP(3)`,
  `DO $$ BEGIN
     ALTER TABLE "ContratoFirmante" ADD CONSTRAINT "ContratoFirmante_versionId_fkey"
       FOREIGN KEY ("versionId") REFERENCES "ContratoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `CREATE INDEX IF NOT EXISTS "ContratoFirmante_versionId_idx" ON "ContratoFirmante"("versionId")`,
];

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  console.log(`base de datos: ${new URL(url).hostname}`);
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    for (const sql of VALORES_ENUM) await client.query(sql);

    await client.query('BEGIN');
    for (const sql of SENTENCIAS) await client.query(sql);
    await client.query('COMMIT');

    const enums = await client.query(
      `SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS valores
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname IN ('ContratoEstado', 'FirmanteEstado', 'ContratoVersionEstado')
       GROUP BY t.typname ORDER BY t.typname`,
    );
    for (const fila of enums.rows) console.log(`  ${fila.typname}: ${fila.valores}`);

    const columnas = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE (table_name = 'Contrato' AND column_name IN ('versionActual', 'aprobadoAt'))
          OR (table_name = 'ContratoFirmante' AND column_name IN ('versionId', 'aprobadoAt'))
          OR (table_name = 'ContratoVersion' AND column_name = 'documentoCifrado')`,
    );
    if (columnas.rowCount !== 5) throw new Error(`Se esperaban 5 columnas y hay ${columnas.rowCount}.`);

    const intactos = await client.query(
      `SELECT estado::text, count(*)::int AS n FROM "Contrato" GROUP BY estado ORDER BY estado`,
    );
    console.log(`  contratos existentes (sin tocar): ${intactos.rows.map((r) => `${r.estado}=${r.n}`).join(', ') || 'ninguno'}`);
    console.log('Listo.');
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

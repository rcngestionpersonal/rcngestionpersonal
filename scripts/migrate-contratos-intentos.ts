// Migracion: limite de intentos con los ultimos 4 digitos de la cedula en los
// enlaces de aprobacion.
//
//   ContratoEventoTipo   + INTENTO_FALLIDO, BLOQUEO
//   ContratoFirmante     + intentosFallidos (INTEGER, 0), bloqueadoAt (NULL)
//                        (el modelo Prisma se llama ContratoParte)
//
// Aditiva e idempotente. No toca ninguna fila existente: todos los enlaces
// quedan con 0 intentos y sin bloquear.
//
// TIENE QUE CORRER ANTES de desplegar el codigo que la usa. Prisma pide todas
// las columnas de ContratoFirmante en cada consulta: sin estas dos, el modulo
// de contratos y la pagina de aprobacion fallan. Al reves no hay problema: el
// codigo que hoy esta en produccion ignora columnas y valores de enum que no
// conoce, asi que se puede correr en cualquier momento antes del despliegue.
//
// Los ADD VALUE van FUERA de la transaccion: PostgreSQL no deja usar un valor
// de enum en la misma transaccion en la que se agrega, y agregarlo dos veces
// con IF NOT EXISTS no falla.
//
// Va por HTTPS/WebSocket (no TCP 5432, bloqueado en este entorno).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-contratos-intentos.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const VALORES_ENUM = [
  `ALTER TYPE "ContratoEventoTipo" ADD VALUE IF NOT EXISTS 'INTENTO_FALLIDO'`,
  `ALTER TYPE "ContratoEventoTipo" ADD VALUE IF NOT EXISTS 'BLOQUEO'`,
];

const SENTENCIAS = [
  `ALTER TABLE "ContratoFirmante" ADD COLUMN IF NOT EXISTS "intentosFallidos" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "ContratoFirmante" ADD COLUMN IF NOT EXISTS "bloqueadoAt" TIMESTAMP(3)`,
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
      `SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS valores
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname = 'ContratoEventoTipo'`,
    );
    const valores = String(enums.rows[0]?.valores ?? '');
    console.log(`  ContratoEventoTipo: ${valores}`);
    if (!valores.includes('INTENTO_FALLIDO') || !valores.includes('BLOQUEO')) throw new Error('Faltan valores en ContratoEventoTipo.');

    const columnas = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'ContratoFirmante' AND column_name IN ('intentosFallidos', 'bloqueadoAt')`,
    );
    if (columnas.rowCount !== 2) throw new Error(`Se esperaban 2 columnas nuevas y hay ${columnas.rowCount}.`);

    const enlaces = await client.query(
      `SELECT count(*)::int AS n, count(*) FILTER (WHERE "intentosFallidos" > 0 OR "bloqueadoAt" IS NOT NULL)::int AS tocados FROM "ContratoFirmante"`,
    );
    console.log(`  enlaces existentes: ${enlaces.rows[0].n} (con intentos o bloqueo: ${enlaces.rows[0].tocados})`);
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

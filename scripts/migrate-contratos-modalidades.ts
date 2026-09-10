// Migracion del ajuste al modulo de contratos:
//
//   1. Dos valores nuevos en el enum ContratoTipo, para las modalidades de
//      corretaje: CORRETAJE_EXCLUSIVO y CORRETAJE_ABIERTO. El valor CORRETAJE
//      NO se toca: hay contratos que lo usan y tienen que seguir abriendose.
//   2. Dos columnas en Agent para registrar la aceptacion del aviso de
//      "modelos referenciales" del modulo de contratos (punto 4.2.a).
//
// Aditiva e idempotente. Va por HTTPS/WebSocket (no TCP 5432, bloqueado en
// este entorno - ver src/lib/prisma-standalone.ts).
//
// ALTER TYPE ... ADD VALUE no puede correr dentro de una transaccion en
// Postgres, asi que los valores del enum se agregan sueltos y las columnas van
// en su propia transaccion.
//
// Correr con: npx tsx --env-file=.env scripts/migrate-contratos-modalidades.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const VALORES_NUEVOS = ['CORRETAJE_EXCLUSIVO', 'CORRETAJE_ABIERTO'];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    for (const valor of VALORES_NUEVOS) {
      // IF NOT EXISTS existe desde Postgres 12 y hace la operacion repetible.
      await client.query(`ALTER TYPE "ContratoTipo" ADD VALUE IF NOT EXISTS '${valor}'`);
    }

    await client.query('BEGIN');
    await client.query('ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "contratosAvisoAt" TIMESTAMP(3)');
    await client.query('ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "contratosAvisoVersion" TEXT');
    await client.query('COMMIT');

    const enums = await client.query(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ContratoTipo'`,
    );
    const etiquetas = enums.rows.map((r: { enumlabel: string }) => r.enumlabel);
    for (const valor of VALORES_NUEVOS) {
      if (!etiquetas.includes(valor)) throw new Error(`Falta el valor ${valor} en ContratoTipo.`);
    }

    const columnas = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'Agent' AND column_name IN ('contratosAvisoAt', 'contratosAvisoVersion')`,
    );
    if (columnas.rowCount !== 2) throw new Error('Faltan columnas de aceptacion del aviso en Agent.');

    console.log('Listo: modalidades de corretaje y registro de aceptacion del aviso.');
    console.log(`ContratoTipo: ${etiquetas.join(', ')}`);
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

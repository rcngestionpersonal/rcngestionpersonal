// Migracion: una columna en Carta para el interruptor "incluir enlace a mi
// perfil profesional".
//
// Aditiva e idempotente, con default true: las cartas existentes quedan como si
// el agente lo hubiera dejado activado, que es el comportamiento por defecto.
// Va por HTTPS/WebSocket (no TCP 5432, bloqueado en este entorno).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-carta-minisitio.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE "Carta" ADD COLUMN IF NOT EXISTS "incluirMiniSitio" BOOLEAN NOT NULL DEFAULT true');
    await client.query('COMMIT');

    const r = await client.query(
      `SELECT column_name, column_default, is_nullable FROM information_schema.columns
       WHERE table_name = 'Carta' AND column_name = 'incluirMiniSitio'`,
    );
    if (r.rowCount !== 1) throw new Error('La columna no quedo creada.');
    console.log(`Listo: Carta.incluirMiniSitio (${r.rows[0].column_default}, nullable=${r.rows[0].is_nullable}).`);

    const cartas = await client.query('SELECT count(*)::int AS n FROM "Carta"');
    console.log(`cartas existentes, todas con el enlace activado: ${cartas.rows[0].n}`);
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

// Quita MiniSitio.mostrarInventario y MiniSitio.mostrarFormulario.
//
// Las dos secciones pasan a ser obligatorias: sin inventario el mini-sitio es
// una tarjeta de presentacion sin sustancia, y sin formulario no genera
// negocio. Son las dos razones por las que existe la feature, y poder
// apagarlas era dejar que el agente la vaciara de valor sin darse cuenta.
//
// No hay dato que preservar: las columnas eran banderas de presentacion, no
// contenido del agente. Un sitio que hoy tiene el inventario apagado pasa a
// mostrarlo, que es justamente el efecto buscado.
//
// Idempotente y transaccional. Va por HTTPS/WebSocket (no TCP 5432, bloqueado
// en este entorno - ver src/lib/prisma-standalone.ts).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-mini-sitio-secciones-obligatorias.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const antes = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'MiniSitio' AND column_name IN ('mostrarInventario', 'mostrarFormulario')`,
    );
    console.log(`Columnas a eliminar presentes: ${antes.rowCount}`);

    await client.query('ALTER TABLE "MiniSitio" DROP COLUMN IF EXISTS "mostrarInventario"');
    await client.query('ALTER TABLE "MiniSitio" DROP COLUMN IF EXISTS "mostrarFormulario"');

    await client.query('COMMIT');

    const despues = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'MiniSitio' AND column_name IN ('mostrarInventario', 'mostrarFormulario')`,
    );
    if (despues.rowCount !== 0) throw new Error('Las columnas siguen presentes despues del DROP.');

    console.log('Listo: el inventario y el formulario del mini-sitio son obligatorios.');
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

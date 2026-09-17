// Migracion: los tres contratos de arrendamiento (residencial, comercial e
// industrial) como tipos propios.
//
//   ContratoTipo   + ARRENDAMIENTO_RESIDENCIAL, ARRENDAMIENTO_COMERCIAL,
//                    ARRENDAMIENTO_INDUSTRIAL
//
// Aditiva e idempotente. ARRENDAMIENTO (el generico retirado) se conserva: hay
// un contrato que lo usa.
//
// Correr con: npx tsx --env-file=.env scripts/migrate-contratos-arrendamientos.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const VALORES = ['ARRENDAMIENTO_RESIDENCIAL', 'ARRENDAMIENTO_COMERCIAL', 'ARRENDAMIENTO_INDUSTRIAL'];

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  console.log(`base de datos: ${new URL(url).hostname}`);
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    // ADD VALUE fuera de transaccion: el valor no se puede usar en la misma
    // transaccion en la que se agrega.
    for (const valor of VALORES) await client.query(`ALTER TYPE "ContratoTipo" ADD VALUE IF NOT EXISTS '${valor}'`);
    const r = await client.query(
      `SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS valores
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'ContratoTipo'`,
    );
    const valores: string[] = r.rows[0].valores.split(',');
    for (const v of VALORES) if (!valores.includes(v)) throw new Error(`Falta ${v}.`);
    console.log(`  ContratoTipo: ${valores.join(', ')}`);
    console.log('Listo.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

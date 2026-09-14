// Migracion de la Fase 9: tablas de reportes a clientes.
//
//   ReporteVisita       reporte de cada visita, con datos del visitante cifrados
//   ReporteVisitaFoto   foto del visitante, cifrada, solo con consentimiento
//   ReporteGestion      reporte periodico al propietario, con sus cifras congeladas
//
// Aditiva e idempotente: solo CREATE ... IF NOT EXISTS. No toca ninguna tabla
// existente mas alla de las claves foraneas que apuntan a Agent y Listing.
// Va por HTTPS/WebSocket (no TCP 5432, bloqueado en este entorno).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-reportes.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const SENTENCIAS = [
  `CREATE TABLE IF NOT EXISTS "ReporteVisita" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "visitadaAt" TIMESTAMP(3) NOT NULL,
    "duracionMinutos" INTEGER,
    "visitanteNombreCifrado" TEXT NOT NULL,
    "visitanteCedulaCifrada" TEXT,
    "visitanteCedulaUlt4" TEXT,
    "acompanantesCifrado" TEXT,
    "reaccion" TEXT NOT NULL,
    "observaciones" TEXT,
    "objeciones" TEXT,
    "proximoPaso" TEXT,
    "paleta" TEXT NOT NULL DEFAULT 'clara',
    "enviadoAt" TIMESTAMP(3),
    "enviadoA" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReporteVisita_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReporteVisita_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReporteVisita_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ReporteVisita_agentId_visitadaAt_idx" ON "ReporteVisita"("agentId", "visitadaAt")`,
  `CREATE INDEX IF NOT EXISTS "ReporteVisita_listingId_visitadaAt_idx" ON "ReporteVisita"("listingId", "visitadaAt")`,

  `CREATE TABLE IF NOT EXISTS "ReporteVisitaFoto" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "datosCifrados" BYTEA NOT NULL,
    "ancho" INTEGER NOT NULL,
    "alto" INTEGER NOT NULL,
    "consentimientoRespaldo" BOOLEAN NOT NULL DEFAULT true,
    "consentimientoRedes" BOOLEAN NOT NULL DEFAULT false,
    "consentimientoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReporteVisitaFoto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReporteVisitaFoto_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "ReporteVisita"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReporteVisitaFoto_reporteId_key" ON "ReporteVisitaFoto"("reporteId")`,

  `CREATE TABLE IF NOT EXISTS "ReporteGestion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "periodicidad" TEXT NOT NULL,
    "periodoDesde" TIMESTAMP(3) NOT NULL,
    "periodoHasta" TIMESTAMP(3) NOT NULL,
    "difusion" JSONB NOT NULL,
    "observaciones" TEXT,
    "datos" JSONB NOT NULL,
    "paleta" TEXT NOT NULL DEFAULT 'clara',
    "enviadoAt" TIMESTAMP(3),
    "enviadoA" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReporteGestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReporteGestion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReporteGestion_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ReporteGestion_listingId_periodoHasta_idx" ON "ReporteGestion"("listingId", "periodoHasta")`,
  `CREATE INDEX IF NOT EXISTS "ReporteGestion_agentId_createdAt_idx" ON "ReporteGestion"("agentId", "createdAt")`,
];

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '(URL inválida)';
    }
  })();
  console.log(`base de datos: ${host}`);

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of SENTENCIAS) await client.query(sql);
    await client.query('COMMIT');

    const r = await client.query(
      `SELECT table_name, count(*)::int AS columnas FROM information_schema.columns
       WHERE table_name IN ('ReporteVisita', 'ReporteVisitaFoto', 'ReporteGestion')
       GROUP BY table_name ORDER BY table_name`,
    );
    if (r.rowCount !== 3) throw new Error(`Se esperaban 3 tablas y hay ${r.rowCount}.`);
    for (const fila of r.rows) console.log(`  ${fila.table_name}: ${fila.columnas} columnas`);
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

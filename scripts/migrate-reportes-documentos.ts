// Migracion: documentos PDF congelados de los reportes y tasaciones enviadas.
//
//   ReporteTasacion    tasacion enviada al propietario, con sus cifras de ese dia
//   ReporteDocumento   el PDF tal como se envio, cifrado, uno por reporte
//
// Aditiva e idempotente: solo CREATE ... IF NOT EXISTS. Va por HTTPS/WebSocket
// (no TCP 5432, bloqueado en este entorno).
//
// Correr con: npx tsx --env-file=.env scripts/migrate-reportes-documentos.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const SENTENCIAS = [
  `CREATE TABLE IF NOT EXISTS "ReporteTasacion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "listingId" TEXT,
    "titulo" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "entrada" JSONB NOT NULL,
    "datos" JSONB NOT NULL,
    "paleta" TEXT NOT NULL DEFAULT 'clara',
    "enviadoAt" TIMESTAMP(3),
    "enviadoA" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReporteTasacion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReporteTasacion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReporteTasacion_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ReporteTasacion_agentId_createdAt_idx" ON "ReporteTasacion"("agentId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ReporteTasacion_listingId_createdAt_idx" ON "ReporteTasacion"("listingId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "ReporteDocumento" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "reporteVisitaId" TEXT,
    "reporteGestionId" TEXT,
    "reporteTasacionId" TEXT,
    "nombreArchivo" TEXT NOT NULL,
    "paleta" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "pdfCifrado" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReporteDocumento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReporteDocumento_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReporteDocumento_reporteVisitaId_fkey" FOREIGN KEY ("reporteVisitaId") REFERENCES "ReporteVisita"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReporteDocumento_reporteGestionId_fkey" FOREIGN KEY ("reporteGestionId") REFERENCES "ReporteGestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReporteDocumento_reporteTasacionId_fkey" FOREIGN KEY ("reporteTasacionId") REFERENCES "ReporteTasacion"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReporteDocumento_reporteVisitaId_key" ON "ReporteDocumento"("reporteVisitaId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReporteDocumento_reporteGestionId_key" ON "ReporteDocumento"("reporteGestionId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReporteDocumento_reporteTasacionId_key" ON "ReporteDocumento"("reporteTasacionId")`,
];

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  console.log(`base de datos: ${new URL(url).hostname}`);
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of SENTENCIAS) await client.query(sql);
    await client.query('COMMIT');
    const r = await client.query(
      `SELECT table_name, count(*)::int AS columnas FROM information_schema.columns
       WHERE table_name IN ('ReporteTasacion', 'ReporteDocumento') GROUP BY table_name ORDER BY table_name`,
    );
    if (r.rowCount !== 2) throw new Error(`Se esperaban 2 tablas y hay ${r.rowCount}.`);
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

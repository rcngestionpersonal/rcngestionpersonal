// Migracion: aprobacion SECUENCIAL de contratos (primero el cliente del agente,
// despues la contraparte) con historial de eventos.
//
// Tres fases, porque la base es la misma para local y produccion y el codigo
// desplegado no puede leer un estado que no conoce:
//
//   --esquema   Aditiva e idempotente. Se puede correr en cualquier momento: el
//               codigo anterior no se entera.
//                 ContratoEstado      + EN_REVISION_PRINCIPAL, APROBADO_PRINCIPAL,
//                                       EN_REVISION_CONTRAPARTE, APROBADO_FINAL,
//                                       CAMBIOS_SOLICITADOS_PRINCIPAL,
//                                       CAMBIOS_SOLICITADOS_CONTRAPARTE, VENCIDO
//                 ContratoEtapa       (tipo nuevo) PRINCIPAL | CONTRAPARTE
//                 ContratoEventoTipo  (tipo nuevo)
//                 Contrato            + representa, vigenciaHoras
//                 ContratoVersion     + representa, requierePrincipal,
//                                       requiereContraparte, simultanea,
//                                       contraparteEnviadaAt, principalAprobadaAt,
//                                       huellaCondiciones, principalHeredadaDe,
//                                       datosCifrados
//                 ContratoFirmante    + etapa, tokenCifrado
//                 ContratoEvento      (tabla nueva)
//               Y completa las versiones que ya existen: fueron enviadas a todas
//               las partes a la vez, asi que quedan como envio simultaneo, con
//               la etapa de cada parte segun su lado.
//
//   --datos     Pasa cada contrato al estado equivalente, SIN borrar nada:
//                 BORRADOR        -> BORRADOR
//                 EN_APROBACION   -> el que corresponda a sus aprobaciones
//                 APROBADO        -> APROBADO_FINAL
//                 RECHAZADO       -> CAMBIOS_SOLICITADOS_PRINCIPAL o _CONTRAPARTE,
//                                    segun el lado de quien pidio los cambios
//                 FIRMADO         -> APROBADO_FINAL (firma electronica concluida)
//                 PENDIENTE_FIRMA -> VENCIDO (firma electronica que ya no concluye)
//               Reconstruye ademas el historial de los contratos que no tienen
//               eventos, con lo que ya estaba registrado (fechas de envio,
//               apertura y decision). Correr JUSTO DESPUES de desplegar el
//               codigo nuevo: el anterior no lee los estados nuevos.
//
//   --limpiar   Recrea el tipo ContratoEstado sin los valores anteriores. Se
//               niega si alguna fila todavia usa uno. Correr despues de --datos,
//               con el codigo nuevo ya desplegado.
//
// Correr con: npx tsx --env-file=.env scripts/migrate-contratos-flujo-secuencial.ts --esquema
//
// --agente=<id> limita --datos a los contratos de un agente: sirve para probar
// la migración con contratos de prueba sin tocar los de nadie más.
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import crypto from 'crypto';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const NUEVOS = [
  'EN_REVISION_PRINCIPAL',
  'APROBADO_PRINCIPAL',
  'EN_REVISION_CONTRAPARTE',
  'APROBADO_FINAL',
  'CAMBIOS_SOLICITADOS_PRINCIPAL',
  'CAMBIOS_SOLICITADOS_CONTRAPARTE',
  'VENCIDO',
];
const FINALES = ['BORRADOR', ...NUEVOS.slice(0, 6), 'VENCIDO', 'ANULADO'];
const ANTERIORES = ['EN_APROBACION', 'APROBADO', 'RECHAZADO', 'PENDIENTE_FIRMA', 'FIRMADO'];

const EVENTOS = [
  'CREACION',
  'EDICION',
  'ENVIO',
  'ENVIO_SIMULTANEO',
  'APERTURA',
  'APROBACION',
  'SOLICITUD_CAMBIOS',
  'REENVIO',
  'REGENERACION',
  'CORRECCION_MENOR',
  'VENCIMIENTO',
  'ANULACION',
];

// Lado de la contraparte por tipo, con el agente representando al propietario
// (lo unico que existia antes de esta migracion). Igual que LADOS_POR_TIPO.
const CONTRAPARTE: Record<string, string[]> = {
  CORRETAJE: [],
  ARRENDAMIENTO_RESIDENCIAL: ['arrendatario'],
  ARRENDAMIENTO_COMERCIAL: ['arrendatario'],
  ARRENDAMIENTO_INDUSTRIAL: ['arrendatario'],
  RESERVA_COMPRAVENTA: ['comprador'],
  RESERVA_ARRIENDO: ['interesado'],
};
const PRINCIPAL: Record<string, string> = {
  CORRETAJE: 'PROPIETARIO',
  ARRENDAMIENTO_RESIDENCIAL: 'ARRENDADOR',
  ARRENDAMIENTO_COMERCIAL: 'ARRENDADOR',
  ARRENDAMIENTO_INDUSTRIAL: 'ARRENDADOR',
  RESERVA_COMPRAVENTA: 'VENDEDOR',
  RESERVA_ARRIENDO: 'ARRENDADOR',
};
// Tipos cuya etapa principal NO comparece en el documento: la reserva de
// arrendamiento la revisa solo el interesado.
const SIN_PRINCIPAL = new Set(['RESERVA_ARRIENDO']);

async function valoresEnum(client: PoolClient, tipo: string): Promise<string[]> {
  const r = await client.query(
    `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = $1 ORDER BY e.enumsortorder`,
    [tipo],
  );
  return r.rows.map((f) => f.enumlabel as string);
}

async function esquema(client: PoolClient) {
  // ADD VALUE fuera de transaccion: el valor no se puede usar en la misma
  // transaccion en la que se agrega.
  for (const valor of NUEVOS) await client.query(`ALTER TYPE "ContratoEstado" ADD VALUE IF NOT EXISTS '${valor}'`);

  await client.query('BEGIN');
  try {
    if ((await valoresEnum(client, 'ContratoEtapa')).length === 0) {
      await client.query(`CREATE TYPE "ContratoEtapa" AS ENUM ('PRINCIPAL', 'CONTRAPARTE')`);
    }
    if ((await valoresEnum(client, 'ContratoEventoTipo')).length === 0) {
      await client.query(`CREATE TYPE "ContratoEventoTipo" AS ENUM (${EVENTOS.map((e) => `'${e}'`).join(', ')})`);
    }
    await client.query(`ALTER TABLE "Contrato" ADD COLUMN IF NOT EXISTS "representa" TEXT, ADD COLUMN IF NOT EXISTS "vigenciaHoras" INTEGER`);
    await client.query(`ALTER TABLE "ContratoVersion"
      ADD COLUMN IF NOT EXISTS "representa" TEXT,
      ADD COLUMN IF NOT EXISTS "requierePrincipal" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "requiereContraparte" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "simultanea" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "contraparteEnviadaAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "principalAprobadaAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "huellaCondiciones" TEXT,
      ADD COLUMN IF NOT EXISTS "principalHeredadaDe" INTEGER,
      ADD COLUMN IF NOT EXISTS "datosCifrados" TEXT`);
    await client.query(`ALTER TABLE "ContratoFirmante"
      ADD COLUMN IF NOT EXISTS "etapa" "ContratoEtapa" NOT NULL DEFAULT 'PRINCIPAL',
      ADD COLUMN IF NOT EXISTS "tokenCifrado" TEXT`);
    await client.query(`CREATE TABLE IF NOT EXISTS "ContratoEvento" (
      "id" TEXT NOT NULL,
      "contratoId" TEXT NOT NULL,
      "tipo" "ContratoEventoTipo" NOT NULL,
      "actor" TEXT NOT NULL,
      "parteId" TEXT,
      "rol" TEXT,
      "etapa" "ContratoEtapa",
      "versionNumero" INTEGER,
      "huella" TEXT,
      "detalleCifrado" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ContratoEvento_pkey" PRIMARY KEY ("id")
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS "ContratoEvento_contratoId_createdAt_idx" ON "ContratoEvento"("contratoId", "createdAt")`);
    const fk = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = 'ContratoEvento_contratoId_fkey'`);
    if (fk.rowCount === 0) {
      await client.query(`ALTER TABLE "ContratoEvento" ADD CONSTRAINT "ContratoEvento_contratoId_fkey"
        FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    // Versiones anteriores a esta migracion: se enviaron a todas las partes a la
    // vez. Solo se completan las que aun no tienen "representa".
    const versiones = await client.query(
      `SELECT v."id", v."enviadaAt", c."tipo"::text AS tipo FROM "ContratoVersion" v JOIN "Contrato" c ON c."id" = v."contratoId" WHERE v."representa" IS NULL`,
    );
    for (const v of versiones.rows) {
      const tipo = v.tipo as string;
      const contraparte = CONTRAPARTE[tipo] ?? [];
      await client.query(
        `UPDATE "ContratoVersion" SET "representa" = $1, "requierePrincipal" = $2, "requiereContraparte" = $3, "simultanea" = true, "contraparteEnviadaAt" = "enviadaAt" WHERE "id" = $4`,
        [PRINCIPAL[tipo] ?? null, !SIN_PRINCIPAL.has(tipo), contraparte.length > 0, v.id],
      );
      if (contraparte.length > 0) {
        await client.query(
          `UPDATE "ContratoFirmante" SET "etapa" = 'CONTRAPARTE' WHERE "versionId" = $1 AND regexp_replace("rol", '_[0-9]+$', '') = ANY($2)`,
          [v.id, contraparte],
        );
      }
    }
    await client.query('COMMIT');
    console.log(`  versiones completadas: ${versiones.rowCount}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  console.log(`  ContratoEstado: ${(await valoresEnum(client, 'ContratoEstado')).join(', ')}`);
}

function id(): string {
  // Suficiente para una clave primaria de una fila reconstruida; Prisma usa cuid
  // en las nuevas.
  return `mig${crypto.randomBytes(12).toString('hex')}`;
}

async function datos(client: PoolClient, agente: string | null) {
  const contratos = await client.query(
    `SELECT "id", "tipo"::text AS tipo, "estado"::text AS estado, "versionActual", "createdAt", "enviadoAt", "anuladoAt" FROM "Contrato"${
      agente ? ' WHERE "agentId" = $1' : ''
    }`,
    agente ? [agente] : [],
  );
  await client.query('BEGIN');
  try {
    for (const c of contratos.rows) {
      const version = (
        await client.query(`SELECT * FROM "ContratoVersion" WHERE "contratoId" = $1 AND "numero" = $2`, [c.id, c.versionActual])
      ).rows[0];
      const partes = version
        ? (await client.query(`SELECT "rol", "etapa"::text AS etapa, "estado"::text AS estado, "expiraAt" FROM "ContratoFirmante" WHERE "versionId" = $1`, [version.id])).rows
        : [];

      let nuevo: string = c.estado;
      switch (c.estado) {
        case 'APROBADO':
        case 'FIRMADO':
          nuevo = 'APROBADO_FINAL';
          break;
        case 'PENDIENTE_FIRMA':
          nuevo = 'VENCIDO';
          break;
        case 'RECHAZADO':
          nuevo = partes.find((p) => p.estado === 'RECHAZADO')?.etapa === 'CONTRAPARTE' ? 'CAMBIOS_SOLICITADOS_CONTRAPARTE' : 'CAMBIOS_SOLICITADOS_PRINCIPAL';
          break;
        case 'EN_APROBACION': {
          const completa = (etapa: string) => {
            const de = partes.filter((p) => p.etapa === etapa);
            return de.length === 0 || de.every((p) => p.estado === 'APROBADO');
          };
          const vencida = partes.some((p) => (p.estado === 'ENVIADO' || p.estado === 'ABIERTO') && new Date(p.expiraAt).getTime() < Date.now());
          nuevo = completa('PRINCIPAL') && completa('CONTRAPARTE')
            ? 'APROBADO_FINAL'
            : vencida
              ? 'VENCIDO'
              : completa('PRINCIPAL')
                ? 'EN_REVISION_CONTRAPARTE'
                : 'EN_REVISION_PRINCIPAL';
          break;
        }
      }
      if (nuevo !== c.estado) {
        await client.query(`UPDATE "Contrato" SET "estado" = $1::"ContratoEstado" WHERE "id" = $2 AND "estado"::text = $3`, [nuevo, c.id, c.estado]);
        console.log(`  ${c.id}: ${c.estado} -> ${nuevo}`);
      }

      // Historial reconstruido, solo si el contrato no tiene ninguno. Sin
      // detalle cifrado: no hay nombres, IP ni navegador que no estuvieran ya en
      // la constancia de cada parte.
      const hay = await client.query(`SELECT 1 FROM "ContratoEvento" WHERE "contratoId" = $1 LIMIT 1`, [c.id]);
      if (hay.rowCount && hay.rowCount > 0) continue;
      const eventos: Array<[string, string, Date, Record<string, unknown>]> = [['CREACION', 'AGENTE', c.createdAt, {}]];
      const todas = (await client.query(`SELECT * FROM "ContratoVersion" WHERE "contratoId" = $1 ORDER BY "numero"`, [c.id])).rows;
      for (const v of todas) {
        eventos.push([v.simultanea ? 'ENVIO_SIMULTANEO' : 'ENVIO', 'AGENTE', v.enviadaAt, { versionNumero: v.numero, huella: v.huella }]);
        const ps = (await client.query(`SELECT * FROM "ContratoFirmante" WHERE "versionId" = $1`, [v.id])).rows;
        for (const p of ps) {
          const base = { versionNumero: v.numero, huella: v.huella, rol: p.rol, etapa: p.etapa, parteId: p.id };
          if (p.abiertoAt) eventos.push(['APERTURA', 'PARTE', p.abiertoAt, base]);
          if (p.aprobadoAt) eventos.push(['APROBACION', 'PARTE', p.aprobadoAt, base]);
          if (p.rechazadoAt) eventos.push(['SOLICITUD_CAMBIOS', 'PARTE', p.rechazadoAt, base]);
        }
      }
      if (c.anuladoAt) eventos.push(['ANULACION', 'AGENTE', c.anuladoAt, {}]);
      for (const [tipo, actor, cuando, extra] of eventos) {
        await client.query(
          `INSERT INTO "ContratoEvento" ("id", "contratoId", "tipo", "actor", "parteId", "rol", "etapa", "versionNumero", "huella", "createdAt")
           VALUES ($1, $2, $3::"ContratoEventoTipo", $4, $5, $6, $7::"ContratoEtapa", $8, $9, $10)`,
          [id(), c.id, tipo, actor, extra.parteId ?? null, extra.rol ?? null, extra.etapa ?? null, extra.versionNumero ?? null, extra.huella ?? null, cuando],
        );
      }
      console.log(`  ${c.id}: ${eventos.length} eventos reconstruidos`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function limpiar(client: PoolClient) {
  const usados = await client.query(
    `SELECT "estado"::text AS estado, count(*)::int AS n FROM "Contrato" WHERE "estado"::text = ANY($1) GROUP BY 1`,
    [ANTERIORES],
  );
  if (usados.rowCount && usados.rowCount > 0) {
    throw new Error(`Hay contratos con estados anteriores (${usados.rows.map((r) => `${r.estado}: ${r.n}`).join(', ')}). Corre --datos primero.`);
  }
  const actuales = await valoresEnum(client, 'ContratoEstado');
  if (!actuales.some((v) => ANTERIORES.includes(v))) {
    console.log('  ContratoEstado ya no tiene valores anteriores.');
    return;
  }
  await client.query('BEGIN');
  try {
    await client.query(`CREATE TYPE "ContratoEstado_new" AS ENUM (${FINALES.map((v) => `'${v}'`).join(', ')})`);
    await client.query(`ALTER TABLE "Contrato" ALTER COLUMN "estado" DROP DEFAULT`);
    await client.query(`ALTER TABLE "Contrato" ALTER COLUMN "estado" TYPE "ContratoEstado_new" USING ("estado"::text::"ContratoEstado_new")`);
    await client.query(`ALTER TYPE "ContratoEstado" RENAME TO "ContratoEstado_old"`);
    await client.query(`ALTER TYPE "ContratoEstado_new" RENAME TO "ContratoEstado"`);
    await client.query(`DROP TYPE "ContratoEstado_old"`);
    await client.query(`ALTER TABLE "Contrato" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR'`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  console.log(`  ContratoEstado: ${(await valoresEnum(client, 'ContratoEstado')).join(', ')}`);
}

async function main() {
  const argumentos = process.argv.slice(2);
  const agente = argumentos.find((a) => a.startsWith('--agente='))?.slice('--agente='.length) ?? null;
  const fases = argumentos.filter((a) => !a.startsWith('--agente='));
  if (fases.length === 0 || fases.some((f) => !['--esquema', '--datos', '--limpiar'].includes(f))) {
    console.error('Indica la fase: --esquema, --datos o --limpiar.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL ?? '';
  console.log(`base de datos: ${new URL(url).hostname}`);
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    if (fases.includes('--esquema')) {
      console.log('esquema');
      await esquema(client);
    }
    if (fases.includes('--datos')) {
      console.log('datos');
      await datos(client, agente);
    }
    if (fases.includes('--limpiar')) {
      if (agente) throw new Error('--limpiar afecta al tipo de toda la base: no se combina con --agente.');
      console.log('limpiar');
      await limpiar(client);
    }
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

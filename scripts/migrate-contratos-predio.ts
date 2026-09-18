// Migracion: en el CORRETAJE v4, "numero de catastro" pasa a llamarse "numero
// de predio", y la senal, los linderos y sus campos asociados dejan de existir.
//
// No es una migracion de esquema: los datos del formulario viven cifrados en
// Contrato.datosCifrados y ContratoVersion.datosCifrados, como un JSON de
// clave -> valor. Lo unico que cambia es el nombre de una clave dentro de ese
// JSON. Por eso NO hay SQL de tablas ni migracion de Prisma: hay que descifrar,
// renombrar y volver a cifrar, con la MISMA ENCRYPTION_KEY con la que se
// cifro. Correrla donde vive esa clave (Vercel / con --env-file del entorno que
// corresponda); con otra clave, las filas quedarian ilegibles.
//
//   --revisar   No escribe nada. Dice cuantos contratos hay, cuales traen la
//               clave vieja y cuales ya estan migrados. Es lo primero que se
//               corre.
//
//   --datos     Renombra propiedadCatastro -> propiedadPredio en la COPIA DE
//               TRABAJO (Contrato.datosCifrados) de los contratos en v4. Antes
//               de la primera escritura guarda el JSON original (tal cual,
//               cifrado) en el archivo de --respaldo, que no puede existir:
//               nunca se pisa un respaldo anterior. Despues escribe todo en una
//               sola transaccion: o se migran todas las filas o ninguna.
//               Idempotente: una fila que ya tiene propiedadPredio no se toca.
//
// SOLO la v4. Un contrato guarda la version de plantilla con la que se creo y
// sigue imprimiendose con ella: la v2 y la v3 del corretaje leen
// propiedadCatastro, y renombrarles la clave les borraria el numero del
// documento. Esas filas se cuentan y se dejan como estan.
//
// Lo que NO se toca: ContratoVersion. Cada version enviada imprime su
// documentoCifrado, congelado: renombrar ahi cambiaria lo que dice un
// documento ya aprobado. Una version enviada no se corrige nunca; se emite
// otra.
//
// Lo que NO hace, a proposito: no borra los campos de la senal ni los linderos
// (depositoEnPoderDe, siDesisteComprador, retencionDetalle, devolucionPlazoDias,
// linderoNorte/Sur/Este/Oeste). Quedan como datos huerfanos que ninguna
// plantilla v4 lee. Borrarlos no aporta nada y si perderia informacion.
//
// La plantilla corretaje-v4 ademas lee propiedadCatastro como respaldo cuando
// propiedadPredio esta vacio, asi que un contrato sin migrar tampoco se rompe:
// esta migracion es orden, no rescate.
//
// Correr con:
//   npx tsx --env-file=.env scripts/migrate-contratos-predio.ts --revisar
//   npx tsx --env-file=.env scripts/migrate-contratos-predio.ts --datos --respaldo=respaldo-predio.json
import { Pool, neonConfig } from '@neondatabase/serverless';
import crypto from 'crypto';
import { writeFileSync } from 'fs';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const ALGORITMO = 'aes-256-gcm';
const IV_BYTES = 12;
const VIEJA = 'propiedadCatastro';
const NUEVA = 'propiedadPredio';
// La unica version cuyo formulario escribe propiedadPredio. Tiene que coincidir
// con PLANTILLA_VERSION de src/lib/real-estate/contratos/plantillas/corretaje-v4.ts.
const VERSION_V4 = 'corretaje-v4-2026-09';

// Misma derivacion que src/lib/real-estate/payments/encryption.ts.
function derivar(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function descifrar(guardado: string, clave: Buffer): string {
  const [ivHex, tagHex, ctHex] = guardado.split(':');
  if (!ivHex || !tagHex || !ctHex) throw new Error('formato de dato cifrado inválido');
  const d = crypto.createDecipheriv(ALGORITMO, clave, Buffer.from(ivHex, 'hex'));
  d.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([d.update(Buffer.from(ctHex, 'hex')), d.final()]).toString('utf8');
}

function cifrar(texto: string, clave: Buffer): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const c = crypto.createCipheriv(ALGORITMO, clave, iv);
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${ct.toString('hex')}`;
}

type Fila = { id: string; datosCifrados: string | null; plantillaVersion: string };
type Cambio = { id: string; original: string; nuevo: string };

// Devuelve el JSON renombrado, o null si no habia nada que renombrar.
function renombrar(datos: Record<string, string>): Record<string, string> | null {
  const catastro = datos[VIEJA];
  if (catastro === undefined) return null;
  const copia = { ...datos };
  // Si alguien ya escribio el numero de predio, manda ese: la clave vieja solo
  // se retira.
  if (!copia[NUEVA]?.trim() && catastro.trim()) copia[NUEVA] = catastro;
  delete copia[VIEJA];
  return copia;
}

async function main() {
  const args = process.argv.slice(2);
  const revisar = args.includes('--revisar');
  const escribir = args.includes('--datos');
  const respaldo = args.find((a) => a.startsWith('--respaldo='))?.slice('--respaldo='.length) ?? '';
  if (revisar === escribir) throw new Error('Elegí una fase: --revisar o --datos.');
  if (escribir && !respaldo) throw new Error('--datos necesita --respaldo=<archivo.json>: sin copia no se toca nada.');

  const url = process.env.DATABASE_URL;
  const raw = process.env.ENCRYPTION_KEY;
  if (!url) throw new Error('Falta DATABASE_URL.');
  if (!raw) throw new Error('Falta ENCRYPTION_KEY: este script descifra y vuelve a cifrar los datos del formulario.');
  const clave = derivar(raw);

  const pool = new Pool({ connectionString: url });
  try {
    // 1. Leer y decidir. Nada se escribe en este paso.
    // Solo el tipo vivo: CORRETAJE_EXCLUSIVO y CORRETAJE_ABIERTO estan
    // archivados, se reimprimen como se generaron y sus plantillas leen la
    // clave vieja.
    const { rows } = await pool.query<Fila>(`SELECT id, "datosCifrados", "plantillaVersion" FROM "Contrato" WHERE tipo = 'CORRETAJE'`);
    const cambios: Cambio[] = [];
    let yaMigradas = 0;
    let ilegibles = 0;
    let otrasVersiones = 0;
    for (const fila of rows) {
      if (!fila.datosCifrados) continue;
      let datos: Record<string, string>;
      try {
        datos = JSON.parse(descifrar(fila.datosCifrados, clave)) as Record<string, string>;
      } catch {
        // Cifrada con otra clave o corrupta: se informa y se deja intacta.
        ilegibles++;
        console.log(`  ! Contrato ${fila.id}: no se pudo descifrar, se deja como está`);
        continue;
      }
      if (fila.plantillaVersion !== VERSION_V4) {
        // Su plantilla lee la clave vieja: se deja como está a propósito.
        if (datos[VIEJA] !== undefined) {
          otrasVersiones++;
          console.log(`  - Contrato ${fila.id} (${fila.plantillaVersion}): su plantilla usa ${VIEJA}, no se toca`);
        }
        continue;
      }
      const nuevo = renombrar(datos);
      if (!nuevo) {
        if (datos[NUEVA] !== undefined) yaMigradas++;
        continue;
      }
      // Ida y vuelta antes de escribir: si lo recifrado no devuelve exactamente
      // lo mismo, se aborta en vez de guardar basura.
      const recifrado = cifrar(JSON.stringify(nuevo), clave);
      if (descifrar(recifrado, clave) !== JSON.stringify(nuevo)) throw new Error(`Contrato ${fila.id}: el recifrado no coincide; no se escribió nada.`);
      cambios.push({ id: fila.id, original: fila.datosCifrados, nuevo: recifrado });
      console.log(`  · Contrato ${fila.id}: ${VIEJA}="${datos[VIEJA]}" → ${NUEVA}`);
    }

    console.log(
      `\nv4 con ${VIEJA}: ${cambios.length} · v4 ya con ${NUEVA}: ${yaMigradas} · otras versiones con ${VIEJA} (no se tocan): ${otrasVersiones} · ilegibles: ${ilegibles}`,
    );
    if (!escribir) {
      console.log('Nada se escribió (--revisar).');
      return;
    }
    if (cambios.length === 0) {
      console.log('No hay nada que migrar: no se escribió nada ni se creó respaldo.');
      return;
    }

    // 2. Respaldo ANTES de la primera escritura. 'wx' falla si el archivo ya
    // existe: un respaldo anterior nunca se pisa.
    writeFileSync(respaldo, JSON.stringify(cambios.map((c) => ({ tabla: 'Contrato', id: c.id, datosCifrados: c.original })), null, 2), {
      encoding: 'utf8',
      flag: 'wx',
    });
    console.log(`\nRespaldo de ${cambios.length} fila(s) en ${respaldo} (sigue cifrado: se restaura tal cual).`);

    // 3. Todo o nada. Cada UPDATE exige que la fila siga como se leyó: si el
    // agente la guardó entre la lectura y la escritura, se aborta y no queda
    // nada a medias.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const c of cambios) {
        const r = await client.query(`UPDATE "Contrato" SET "datosCifrados" = $1 WHERE id = $2 AND "datosCifrados" = $3`, [c.nuevo, c.id, c.original]);
        if (r.rowCount !== 1) throw new Error(`Contrato ${c.id} cambió desde la lectura. No se migró ninguna fila; vuelve a correr --revisar.`);
        console.log(`  ✓ Contrato ${c.id}`);
      }
      await client.query('COMMIT');
      console.log(`\n${cambios.length} fila(s) migradas.`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

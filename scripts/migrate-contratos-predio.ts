// Migracion: en el CORRETAJE, "numero de catastro" pasa a llamarse "numero de
// predio", y la senal, los linderos y sus campos asociados dejan de existir.
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
//               TRABAJO (Contrato.datosCifrados). Idempotente: si la fila ya
//               tiene propiedadPredio, no la toca. Guarda antes una copia del
//               JSON original (tal cual, cifrado) en el archivo que indique
//               --respaldo, para poder volver atras.
//
// Lo que NO se toca: ContratoVersion. Cada version enviada imprime su
// documentoCifrado, congelado, y sus plantillas (corretaje v2 y v3) leen
// propiedadCatastro: renombrar ahi cambiaria lo que dice un documento ya
// aprobado. Una version enviada no se corrige nunca; se emite otra.
//
// Lo que NO hace, a proposito: no borra los campos de la senal ni los linderos
// (depositoEnPoderDe, siDesisteComprador, retencionDetalle, devolucionPlazoDias,
// linderoNorte/Sur/Este/Oeste). Quedan como datos huerfanos que ninguna
// plantilla lee. Borrarlos no aporta nada y si perderia informacion de un
// contrato ya firmado, que debe seguir diciendo lo que decia.
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

type Fila = { id: string; datosCifrados: string | null };

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
  const copias: Array<{ tabla: string; id: string; datosCifrados: string }> = [];
  let conVieja = 0;
  let migradas = 0;
  let ilegibles = 0;

  try {
    // Solo el tipo vivo: CORRETAJE_EXCLUSIVO y CORRETAJE_ABIERTO estan
    // archivados, se reimprimen como se generaron y sus plantillas leen la
    // clave vieja.
    for (const tabla of ['Contrato'] as const) {
      const { rows } = await pool.query<Fila>(`SELECT id, "datosCifrados" FROM "${tabla}" WHERE tipo = 'CORRETAJE'`);
      for (const fila of rows) {
        if (!fila.datosCifrados) continue;
        let datos: Record<string, string>;
        try {
          datos = JSON.parse(descifrar(fila.datosCifrados, clave)) as Record<string, string>;
        } catch {
          // Cifrada con otra clave o corrupta: se informa y se deja intacta.
          ilegibles++;
          console.log(`  ! ${tabla} ${fila.id}: no se pudo descifrar, se deja como está`);
          continue;
        }
        const nuevo = renombrar(datos);
        if (!nuevo) {
          if (datos[NUEVA] !== undefined) migradas++;
          continue;
        }
        conVieja++;
        if (!escribir) {
          console.log(`  · ${tabla} ${fila.id}: ${VIEJA}="${datos[VIEJA]}" → ${NUEVA}`);
          continue;
        }
        copias.push({ tabla, id: fila.id, datosCifrados: fila.datosCifrados });
        await pool.query(`UPDATE "${tabla}" SET "datosCifrados" = $1 WHERE id = $2`, [cifrar(JSON.stringify(nuevo), clave), fila.id]);
        console.log(`  ✓ ${tabla} ${fila.id}`);
      }
    }

    if (escribir && copias.length > 0) {
      writeFileSync(respaldo, JSON.stringify(copias, null, 2), 'utf8');
      console.log(`\nRespaldo de ${copias.length} fila(s) en ${respaldo} (sigue cifrado: se restaura tal cual).`);
    }
    console.log(`\nCon ${VIEJA}: ${conVieja} · ya con ${NUEVA}: ${migradas} · ilegibles: ${ilegibles}`);
    if (!escribir) console.log('Nada se escribió (--revisar).');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

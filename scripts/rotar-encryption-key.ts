// Rotacion de ENCRYPTION_KEY: recifra todo lo cifrado en reposo, pasandolo de
// la clave vieja a la nueva, SIN perder nada.
//
// POR QUE EXISTE: el dia que haya contratos de clientes reales, cambiar la
// clave no puede improvisarse. Sustituirla sin recifrar no da error: los
// documentos se abren en blanco, porque descifrarDatos() captura el fallo y
// devuelve vacio. Este script convierte eso en una operacion verificable.
//
// COMO SE USA (leer docs/operacion-claves.md antes):
//
//   ENCRYPTION_KEY_VIEJA=<actual> ENCRYPTION_KEY_NUEVA=<nueva> \
//     npx tsx --env-file=.env scripts/rotar-encryption-key.ts --ensayo
//
// --ensayo descifra y recifra TODO en memoria, comprueba que el resultado
// coincide con el original y no escribe ni una fila. Correrlo siempre primero.
// Sin --ensayo, escribe dentro de UNA transaccion: o se rota todo o no se rota
// nada.
//
// El script NO toca Vercel. Cargar la clave nueva en los entornos es un paso
// aparte y va DESPUES de que este script termine bien.
import crypto from 'node:crypto';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const ALGORITMO = 'aes-256-gcm';
const IV_BYTES = 12;

// Misma derivacion que src/lib/real-estate/payments/encryption.ts: 64 hex se
// usan tal cual, cualquier otra cosa se deriva con SHA-256.
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

// Cada columna cifrada del esquema. Si mañana se cifra una columna nueva, se
// agrega aqui: es el unico sitio que hay que tocar para que entre en la rotacion.
const COLUMNAS: Array<{ tabla: string; columna: string; obligatoria: boolean }> = [
  { tabla: 'Contrato', columna: 'datosCifrados', obligatoria: true },
  { tabla: 'ContratoFirmante', columna: 'cedulaCifrada', obligatoria: true },
  { tabla: 'ContratoFirmante', columna: 'evidenciaCifrada', obligatoria: false },
  { tabla: 'PaymentMethod', columna: 'cardTokenEnc', obligatoria: false },
];

async function main() {
  const ensayo = process.argv.includes('--ensayo');
  const vieja = process.env.ENCRYPTION_KEY_VIEJA;
  const nueva = process.env.ENCRYPTION_KEY_NUEVA;

  if (!vieja || !nueva) throw new Error('Faltan ENCRYPTION_KEY_VIEJA y/o ENCRYPTION_KEY_NUEVA.');
  if (vieja === nueva) throw new Error('La clave vieja y la nueva son la misma: no hay nada que rotar.');

  const kVieja = derivar(vieja);
  const kNueva = derivar(nueva);

  console.log(ensayo ? '=== ENSAYO: no se escribe nada ===\n' : '=== ROTACIÓN REAL ===\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let totalLeidas = 0;
  let totalRotadas = 0;
  const fallos: string[] = [];

  try {
    if (!ensayo) await client.query('BEGIN');

    for (const { tabla, columna, obligatoria } of COLUMNAS) {
      const existe = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [tabla, columna],
      );
      if (existe.rowCount === 0) {
        if (obligatoria) throw new Error(`Falta la columna obligatoria ${tabla}.${columna}.`);
        console.log(`${tabla}.${columna}: la columna no existe en este esquema, se omite`);
        continue;
      }

      const filas = await client.query(
        `SELECT id, "${columna}" AS valor FROM "${tabla}" WHERE "${columna}" IS NOT NULL`,
      );
      totalLeidas += filas.rowCount ?? 0;

      let rotadas = 0;
      for (const fila of filas.rows as Array<{ id: string; valor: string }>) {
        let claro: string;
        try {
          claro = descifrar(fila.valor, kVieja);
        } catch {
          // Una fila que no abre con la clave vieja NO se toca: puede venir de
          // una clave anterior distinta. Se reporta y la rotacion se aborta.
          fallos.push(`${tabla}.${columna} id=${fila.id}: no descifra con la clave vieja`);
          continue;
        }

        const recifrado = cifrar(claro, kNueva);
        // Comprobacion de ida y vuelta ANTES de escribir: si lo recifrado no
        // devuelve exactamente lo mismo, se aborta en vez de guardar basura.
        if (descifrar(recifrado, kNueva) !== claro) {
          fallos.push(`${tabla}.${columna} id=${fila.id}: el recifrado no coincide con el original`);
          continue;
        }

        if (!ensayo) {
          await client.query(`UPDATE "${tabla}" SET "${columna}" = $1 WHERE id = $2`, [recifrado, fila.id]);
        }
        rotadas += 1;
      }

      totalRotadas += rotadas;
      console.log(`${tabla}.${columna}: ${rotadas}/${filas.rowCount} filas ${ensayo ? 'verificadas' : 'rotadas'}`);
    }

    if (fallos.length > 0) {
      console.error(`\n${fallos.length} filas con problema:`);
      for (const f of fallos) console.error(`  ${f}`);
      throw new Error('Rotación abortada: hay filas que no se pueden rotar sin perder datos.');
    }

    if (!ensayo) await client.query('COMMIT');

    console.log(`\n${totalRotadas} de ${totalLeidas} filas ${ensayo ? 'verificadas' : 'rotadas'}, 0 fallos.`);
    console.log(
      ensayo
        ? '\nEl ensayo salió bien. Vuelve a correrlo SIN --ensayo para escribir.'
        : '\nRotación completa. Ahora sí: carga la clave nueva en los tres entornos de Vercel\n' +
            'y en tu .env local. Hasta que lo hagas, la aplicación sigue usando la vieja\n' +
            'y NO podrá leer nada.',
    );
  } catch (error) {
    if (!ensayo) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  console.error('No se modificó ninguna fila.');
  process.exit(1);
});

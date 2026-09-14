import crypto from 'crypto';
import { decryptAtRest, encryptAtRest } from '@/lib/real-estate/payments/encryption';

// Cifrado en reposo de los datos de visitantes (Fase 9, punto 5.3).
//
// Los textos (nombre, cedula, acompañantes) usan el mismo formato que los
// contratos, "iv:tag:ciphertext" en hex, para que la rotacion de clave los
// trate igual que al resto.
//
// La foto usa bytes crudos, iv (12) | tag (16) | JPEG cifrado. En hex ocuparia
// el doble, y una foto es justo lo que mas pesa. La derivacion de la clave es
// la MISMA que en payments/encryption.ts y en scripts/rotar-encryption-key.ts:
// si alguna cambia, las tres tienen que cambiar juntas.

const ALGORITMO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function clave(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY no esta configurada.');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function cifrarTexto(texto: string): string {
  return encryptAtRest(texto);
}

export function cifrarTextoOpcional(texto: string | null | undefined): string | null {
  const limpio = texto?.trim();
  return limpio ? encryptAtRest(limpio) : null;
}

// Un dato que no descifra (clave rotada a medias, fila alterada) no tumba la
// pantalla ni el PDF: se muestra como no disponible. El error queda en el log,
// sin el contenido.
export function descifrarTexto(guardado: string | null | undefined): string | null {
  if (!guardado) return null;
  try {
    return decryptAtRest(guardado);
  } catch {
    console.error('[reportes] no se pudo descifrar un dato de visitante');
    return null;
  }
}

export function cifrarBytes(datos: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITMO, clave(), iv);
  const cifrado = Buffer.concat([cipher.update(datos), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]);
}

export function descifrarBytes(guardado: Buffer | Uint8Array): Buffer {
  const b = Buffer.from(guardado);
  if (b.length <= IV_BYTES + TAG_BYTES) throw new Error('Dato cifrado demasiado corto.');
  const decipher = crypto.createDecipheriv(ALGORITMO, clave(), b.subarray(0, IV_BYTES));
  decipher.setAuthTag(b.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(b.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}

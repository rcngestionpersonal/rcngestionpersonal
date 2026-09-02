// Cifrado en reposo del ctoken de Payphone (seccion 8 del pedido de
// recurrencias): AES-256-GCM con una clave propia (ENCRYPTION_KEY), separada
// de la coding password de Payphone que usa encryptCardHolder() en
// payphone.ts - esa otra funcion cifra PARA Payphone (la clave la conoce
// Payphone), esta cifra PARA NOSOTROS (la clave nunca sale de nuestro
// servidor). GCM en vez de CBC aca porque ademas de confidencialidad
// necesitamos integridad: si alguien altera un byte de la columna en la base
// de datos, el tag de autenticacion falla al desencriptar en vez de devolver
// silenciosamente un ctoken corrupto que Payphone rechazaria sin explicacion.
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM (96 bits)

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY no esta configurada.');
  }
  // Acepta la clave en hex (64 caracteres = 32 bytes) o, si no es hex valido
  // de ese largo, la deriva con SHA-256 - asi una clave "humana" (una frase)
  // tambien produce los 32 bytes exactos que exige AES-256 sin obligar al
  // operador a generar hex a mano.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

// Formato de salida: "<iv_hex>:<tag_hex>:<ciphertext_hex>" - las tres partes
// hacen falta para desencriptar y ninguna es secreta por si sola sin la clave.
export function encryptAtRest(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptAtRest(stored: string): string {
  const [ivHex, tagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error('Formato de dato cifrado invalido.');
  }
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}

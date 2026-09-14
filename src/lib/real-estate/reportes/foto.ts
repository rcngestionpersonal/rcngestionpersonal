import sharp from 'sharp';
import { cifrarBytes, descifrarBytes } from './cifrado';

// Foto del visitante: se normaliza, se le quitan los metadatos y se cifra
// antes de tocar la base de datos.

// 1280px de lado mayor: sobra para una foto de respaldo en una hoja A4 y deja
// el archivo en ~150KB, que es lo que se guarda por visita.
const LADO_MAXIMO = 1280;
export const FOTO_BYTES_MAXIMOS = 8 * 1024 * 1024;
const TIPOS_ACEPTADOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function esTipoDeFotoAceptado(tipo: string): boolean {
  return TIPOS_ACEPTADOS.has(tipo);
}

export async function prepararFoto(original: Buffer): Promise<{ cifrada: Buffer; ancho: number; alto: number }> {
  // .rotate() aplica la orientacion EXIF antes de descartarla. sharp NO copia
  // los metadatos al archivo de salida salvo que se le pida: la ubicacion GPS
  // que traen las fotos del celular no llega a guardarse.
  const { data, info } = await sharp(original)
    .rotate()
    .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { cifrada: cifrarBytes(data), ancho: info.width, alto: info.height };
}

export function fotoDescifrada(cifrada: Buffer | Uint8Array): Buffer {
  return descifrarBytes(cifrada);
}

// Para incrustar en el documento. satori no puede leer una URL: necesita la
// imagen dentro del SVG.
export async function fotoComoDataUri(cifrada: Buffer | Uint8Array, anchoMaximo = 640): Promise<string | null> {
  try {
    const jpeg = await sharp(descifrarBytes(cifrada))
      .resize({ width: anchoMaximo, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    console.error('[reportes] no se pudo descifrar la foto de una visita');
    return null;
  }
}

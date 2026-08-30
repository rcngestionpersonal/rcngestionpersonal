// Trae fotos remotas (Vercel Blob) y las convierte a un data URI ya
// recomprimido, para poder incrustarlas en el SVG que arma satori: resvg (el
// rasterizador) no puede salir a red a buscar una URL http(s), solo entiende
// data URIs o archivos locales - ver src/lib/real-estate/ficha/render.ts.
//
// Tambien recomprime las paginas ya rasterizadas (PNG) a JPEG antes de
// incrustarlas en el PDF final: una foto de inmueble en JPEG calidad ~80 pesa
// una fraccion de lo que pesa en PNG, que es lo que permite mantener la
// ficha completa bajo el limite de ~2MB (Fase 2, seccion 6).
import sharp from 'sharp';

const FETCH_TIMEOUT_MS = 8000;

export async function fetchImageAsDataUri(url: string, opts: { maxWidth: number; quality: number }): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({ width: opts.maxWidth, withoutEnlargement: true })
      .jpeg({ quality: opts.quality, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    // Foto rota, CORS del lado del proveedor, o red caida: la ficha sigue
    // generandose con el placeholder elegante, nunca bloquea la descarga.
    return null;
  }
}

export async function pngPageToJpeg(png: Buffer, quality = 78): Promise<Buffer> {
  return sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
}

// Las versiones "para redes" (seccion 2.3) deben ser PNG, pero un PNG
// fotografico sin cuantizar de 1080x1920 con foto de fondo puede pesar 2MB+
// (probado con una foto real) - la paleta cuantizada de imagequant (via
// sharp) baja eso a una fraccion sin perder nitidez perceptible en el texto
// ni en los iconos, que es lo que mas importa en una imagen para publicar.
export async function optimizePng(png: Buffer): Promise<Buffer> {
  return sharp(png).png({ quality: 82, palette: true, effort: 8 }).toBuffer();
}

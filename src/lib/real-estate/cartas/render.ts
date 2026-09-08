import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import { loadFichaFonts } from '@/lib/real-estate/ficha/fonts';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { optimizePng, pngPageToJpeg } from '@/lib/real-estate/ficha/photos';
import { cartaA4Page, type CartaDestinatarioImpreso, type CartaEncabezado } from './plantilla';
import type { CartaBloques, CartaPaleta } from './tipos';

// Render de la carta: JSX -> SVG (satori) -> PNG (resvg) -> PDF (pdf-lib).
// Misma cadena que las fichas y las mismas fuentes embebidas; lo unico propio
// es la plantilla. A diferencia de las fichas, aca la paleta CLARA es el
// default: una carta de presentacion es un documento formal (punto 4.4).

export type CartaFormato = 'pdf' | 'png';

// Lienzo A4 logico a 96dpi, identico al de las fichas: todos los tamanos de la
// plantilla estan pensados sobre este ancho.
const A4_BASE = { width: 794, height: 1123 };
const A4_RASTER_WIDTH = 1588;
const A4_PT: [number, number] = [595.28, 841.89];

export type RenderCartaInput = {
  formato: CartaFormato;
  paleta: CartaPaleta;
  encabezado: CartaEncabezado;
  destinatario: CartaDestinatarioImpreso;
  bloques: CartaBloques;
  fecha: string;
};

export type CartaRenderizada = { buffer: Buffer; contentType: string; extension: 'pdf' | 'png' };

export async function renderCarta(input: RenderCartaInput): Promise<CartaRenderizada> {
  const palette = FICHA_PALETTES[input.paleta === 'oscura' ? 'oscura' : 'clara'];

  const node = cartaA4Page({
    encabezado: input.encabezado,
    destinatario: input.destinatario,
    bloques: input.bloques,
    fecha: input.fecha,
    palette,
    width: A4_BASE.width,
    height: A4_BASE.height,
  });

  const fonts = loadFichaFonts();
  const svg = await satori(node, { width: A4_BASE.width, height: A4_BASE.height, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: A4_RASTER_WIDTH }, background: palette.bg })
    .render()
    .asPng();

  if (input.formato === 'png') {
    return { buffer: await optimizePng(png), contentType: 'image/png', extension: 'png' };
  }

  const jpg = await pngPageToJpeg(png);
  const pdf = await PDFDocument.create();
  pdf.setProducer('Redinmo.io');
  pdf.setCreator('Redinmo.io');
  pdf.setTitle('Carta de presentación - Redinmo.io');
  const img = await pdf.embedJpg(jpg);
  const page = pdf.addPage(A4_PT);
  page.drawImage(img, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  return { buffer: Buffer.from(await pdf.save()), contentType: 'application/pdf', extension: 'pdf' };
}

// Fecha larga en español, como corresponde a una carta formal.
export function fechaLarga(fecha = new Date()): string {
  return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

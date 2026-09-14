import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import type { ReactNode } from 'react';
import { loadFichaFonts } from '@/lib/real-estate/ficha/fonts';
import type { FichaPalette } from '@/lib/real-estate/ficha/palettes';
import { optimizePng, pngPageToJpeg } from '@/lib/real-estate/ficha/photos';
import type { ReporteFormato } from './tipos';

// Render de los tres reportes: JSX -> SVG (satori) -> PNG (resvg) -> PDF
// (pdf-lib). Misma cadena, lienzo y fuentes que las fichas y las cartas.
//
// El PNG es la misma hoja A4 vertical que el PDF. En WhatsApp se abre en el
// celular y se lee haciendo zoom, igual que una ficha: un formato distinto
// para PNG obligaria a mantener dos maquetas de cada reporte.

export const A4 = { width: 794, height: 1123 };
const RASTER = 1588;
const A4_PT: [number, number] = [595.28, 841.89];

export type ReporteRenderizado = { buffer: Buffer; contentType: string; extension: 'pdf' | 'png' };

export async function renderReporte(
  node: ReactNode,
  opciones: { formato: ReporteFormato; palette: FichaPalette; titulo: string },
): Promise<ReporteRenderizado> {
  const svg = await satori(node as Parameters<typeof satori>[0], { width: A4.width, height: A4.height, fonts: loadFichaFonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: RASTER }, background: opciones.palette.bg }).render().asPng();

  if (opciones.formato === 'png') {
    return { buffer: await optimizePng(png), contentType: 'image/png', extension: 'png' };
  }

  const jpg = await pngPageToJpeg(png, 82);
  const pdf = await PDFDocument.create();
  pdf.setProducer('Redinmo.io');
  pdf.setCreator('Redinmo.io');
  pdf.setTitle(opciones.titulo);
  const img = await pdf.embedJpg(jpg);
  const page = pdf.addPage(A4_PT);
  page.drawImage(img, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  return { buffer: Buffer.from(await pdf.save()), contentType: 'application/pdf', extension: 'pdf' };
}

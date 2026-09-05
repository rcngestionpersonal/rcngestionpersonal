// Orquesta el render de la ficha: JSX (templates.tsx) -> SVG (satori) -> PNG
// (resvg) -> PDF (pdf-lib) o PNG final. Todo el trabajo pesado (fetch de
// fotos, resize) ya debe haber ocurrido antes de llamar aqui - este modulo
// solo dibuja con datos ya resueltos.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import { loadFichaFonts } from './fonts';
import { FICHA_PALETTES, type FichaPaletteKey } from './palettes';
import {
  fichaA4Page,
  fichaSocialPost,
  fichaSocialStory,
  type FichaA4Version,
  type FichaAgentSnapshot,
  type FichaColegasSnapshot,
  type FichaListingSnapshot,
} from './templates';
import { optimizePng, pngPageToJpeg } from './photos';

export type FichaVersion = FichaA4Version | 'redes_post' | 'redes_story';
export type FichaFormat = 'pdf' | 'png';

export type RenderFichaInput = {
  version: FichaVersion;
  format: FichaFormat;
  paletteKey: FichaPaletteKey;
  lang: 'es' | 'en';
  listing: FichaListingSnapshot;
  // null para "sin_marca" (sin datos de ningun agente).
  agent: FichaAgentSnapshot | null;
  // solo se usa cuando version === 'colega'.
  colegas: FichaColegasSnapshot | null;
};

export type RenderedFicha = { buffer: Buffer; contentType: string; extension: 'pdf' | 'png' };

// Lienzo base A4 a 96dpi (210x297mm) - todos los tamanos de fuente/medidas
// del rediseno estan pensados para este ancho. El PDF y el PNG standalone se
// rasterizan mas grandes (ver A4_RASTER_WIDTH) para que se vean nitidos,
// pero el layout siempre se calcula sobre este lienzo logico.
const A4_BASE = { width: 794, height: 1123 };
// >= 2x el lienzo base (seccion 6.3 del rediseno: "al menos 2x resolucion,
// aproximadamente 1588x2246px") - se usa tanto para las paginas del PDF como
// para el PNG standalone de las versiones A4, asi ambos formatos salen de la
// misma rasterizacion nitida.
const A4_RASTER_WIDTH = 1588;
const A4_PT: [number, number] = [595.28, 841.89];
const SOCIAL_SIZE = { post: 1080, story: 1920 };

async function svgToPngBuffer(node: Parameters<typeof satori>[0], layoutWidth: number, layoutHeight: number, rasterWidth: number, background: string): Promise<Buffer> {
  const fonts = await loadFichaFonts();
  const svg = await satori(node, { width: layoutWidth, height: layoutHeight, fonts });
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: rasterWidth }, background }).render();
  return rendered.asPng();
}

function isA4Version(version: FichaVersion): version is FichaA4Version {
  return version === 'cliente' || version === 'colega' || version === 'sin_marca';
}

export async function renderFicha(input: RenderFichaInput): Promise<RenderedFicha> {
  const palette = FICHA_PALETTES[input.paletteKey];

  if (input.version === 'redes_post' || input.version === 'redes_story') {
    const width = SOCIAL_SIZE.post;
    const height = input.version === 'redes_post' ? SOCIAL_SIZE.post : SOCIAL_SIZE.story;
    const node =
      input.version === 'redes_post'
        ? fichaSocialPost({ listing: input.listing, agent: input.agent, palette, width, height })
        : fichaSocialStory({ listing: input.listing, agent: input.agent, palette, lang: input.lang, width, height });
    const png = await svgToPngBuffer(node, width, height, width, palette.bg);
    const optimized = await optimizePng(png);
    return { buffer: optimized, contentType: 'image/png', extension: 'png' };
  }

  if (!isA4Version(input.version)) throw new Error(`Version de ficha desconocida: ${input.version}`);

  const node = fichaA4Page({
    version: input.version,
    listing: input.listing,
    agent: input.agent,
    colegas: input.version === 'colega' ? input.colegas : null,
    palette,
    lang: input.lang,
    width: A4_BASE.width,
    height: A4_BASE.height,
  });
  const png = await svgToPngBuffer(node, A4_BASE.width, A4_BASE.height, A4_RASTER_WIDTH, palette.bg);

  if (input.format === 'png') {
    const optimized = await optimizePng(png);
    return { buffer: optimized, contentType: 'image/png', extension: 'png' };
  }

  const jpg = await pngPageToJpeg(png);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setProducer('Redinmo.io');
  pdfDoc.setCreator('Redinmo.io');
  pdfDoc.setTitle('Ficha de inmueble - Redinmo.io');
  const img = await pdfDoc.embedJpg(jpg);
  const page = pdfDoc.addPage(A4_PT);
  page.drawImage(img, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  const pdfBytes = await pdfDoc.save();
  return { buffer: Buffer.from(pdfBytes), contentType: 'application/pdf', extension: 'pdf' };
}

// Orquesta el render de la ficha (Fase 2): JSX (templates.tsx) -> SVG
// (satori) -> PNG (resvg) -> PDF (pdf-lib) o PNG final para redes. Todo el
// trabajo pesado (fetch de fotos, resize) ya debe haber ocurrido antes de
// llamar aqui - este modulo solo dibuja con datos ya resueltos.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import { loadFichaFonts } from './fonts';
import { FICHA_PALETTES, type FichaPaletteKey } from './palettes';
import { fichaCoverPage, fichaDetailPage, fichaSocialImage, type FichaAgentSnapshot, type FichaListingSnapshot } from './templates';
import { optimizePng, pngPageToJpeg } from './photos';

export type FichaVersion = 'cliente' | 'sin_marca' | 'redes_post' | 'redes_story';

export type RenderFichaInput = {
  version: FichaVersion;
  paletteKey: FichaPaletteKey;
  lang: 'es' | 'en';
  listing: FichaListingSnapshot;
  // null para "sin_marca" (seccion 2.2 - sin datos de ningun agente).
  agent: FichaAgentSnapshot | null;
  photoMissing: boolean;
};

export type RenderedFicha = { buffer: Buffer; contentType: string; extension: 'pdf' | 'png' };

const A4_PT: [number, number] = [595.28, 841.89];
const PDF_PAGE_PX = { width: 1240, height: 1754 };

async function svgToPngBuffer(node: Parameters<typeof satori>[0], width: number, height: number, background: string): Promise<Buffer> {
  const fonts = await loadFichaFonts();
  const svg = await satori(node, { width, height, fonts });
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: width }, background }).render();
  return rendered.asPng();
}

export async function renderFicha(input: RenderFichaInput): Promise<RenderedFicha> {
  const palette = FICHA_PALETTES[input.paletteKey];

  if (input.version === 'redes_post' || input.version === 'redes_story') {
    const width = 1080;
    const height = input.version === 'redes_post' ? 1080 : 1920;
    const node = fichaSocialImage({ listing: input.listing, agent: input.agent, palette, lang: input.lang, width, height });
    const png = await svgToPngBuffer(node, width, height, palette.bg);
    const optimized = await optimizePng(png);
    return { buffer: optimized, contentType: 'image/png', extension: 'png' };
  }

  const { width, height } = PDF_PAGE_PX;
  const coverNode = fichaCoverPage({ listing: input.listing, palette, lang: input.lang, width, height });
  const detailNode = fichaDetailPage({
    listing: input.listing,
    agent: input.agent,
    palette,
    lang: input.lang,
    width,
    height,
    photoMissingNotice: input.photoMissing,
  });

  const [coverPng, detailPng] = await Promise.all([
    svgToPngBuffer(coverNode, width, height, palette.bg),
    svgToPngBuffer(detailNode, width, height, palette.bg),
  ]);

  const [coverJpg, detailJpg] = await Promise.all([pngPageToJpeg(coverPng), pngPageToJpeg(detailPng)]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setProducer('Redinmo.io');
  pdfDoc.setCreator('Redinmo.io');
  pdfDoc.setTitle('Ficha de inmueble - Redinmo');

  for (const jpg of [coverJpg, detailJpg]) {
    const img = await pdfDoc.embedJpg(jpg);
    const page = pdfDoc.addPage(A4_PT);
    page.drawImage(img, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  }

  const pdfBytes = await pdfDoc.save();
  return { buffer: Buffer.from(pdfBytes), contentType: 'application/pdf', extension: 'pdf' };
}

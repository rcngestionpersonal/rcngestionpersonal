// Fuente para el render de la ficha (satori). Plus Jakarta Sans es la
// tipografia de marca (ver src/app/layout.tsx), pero next/font/google solo
// distribuye el variable font - satori exige TTF/OTF/WOFF por peso, no
// variable fonts.
//
// Los 4 pesos vienen embebidos en base64 en fonts-data.ts en vez de leerse
// de node_modules en runtime - ver el comentario de ese archivo para el
// porque (require.resolve() de un .woff rompe el build de webpack de Next
// incluso con serverExternalPackages).
import { FICHA_FONT_BASE64, type FichaFontWeight } from './fonts-data';

export type { FichaFontWeight };

let cachedFonts: Array<{ name: string; data: Buffer; weight: FichaFontWeight; style: 'normal' }> | null = null;

export function loadFichaFonts(): Array<{ name: string; data: Buffer; weight: FichaFontWeight; style: 'normal' }> {
  if (!cachedFonts) {
    cachedFonts = ([400, 600, 700, 800] as const).map((weight) => ({
      name: 'Plus Jakarta Sans',
      data: Buffer.from(FICHA_FONT_BASE64[weight], 'base64'),
      weight,
      style: 'normal' as const,
    }));
  }
  return cachedFonts;
}

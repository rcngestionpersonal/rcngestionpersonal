// Paletas de la ficha (Fase 2, seccion 3.8): oscura (identidad de marca) y
// clara (pensada para impresion, mas ahorro de tinta). Espejean los tokens
// de src/app/globals.css al momento de esta fase - satori no puede leer
// variables CSS, asi que se hardcodean aqui igual que STORY_PALETTES en
// carnet-image.ts. Mantener en sync si los tokens cambian.
export type FichaPaletteKey = 'oscura' | 'clara';

export type FichaPalette = {
  key: FichaPaletteKey;
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  lineStrong: string;
  text: string;
  text2: string;
  text3: string;
  brand: string;
  brandDim: string;
  brandLine: string;
  accent: string;
  accentDim: string;
  accentLine: string;
  accentContrast: string;
  gradFrom: string;
  gradTo: string;
  overlayFrom: string;
  overlayTo: string;
  placeholderFrom: string;
  placeholderTo: string;
};

export const FICHA_PALETTES: Record<FichaPaletteKey, FichaPalette> = {
  oscura: {
    key: 'oscura',
    bg: '#0a0812',
    surface: '#171130',
    surface2: '#1e1740',
    line: 'rgba(183,165,255,0.16)',
    lineStrong: 'rgba(183,165,255,0.28)',
    text: '#f3f1fa',
    text2: '#a9a1cd',
    text3: '#736c96',
    brand: '#b7a5ff',
    brandDim: 'rgba(167,139,250,0.14)',
    brandLine: 'rgba(167,139,250,0.36)',
    accent: '#2dd4bf',
    accentDim: 'rgba(45,212,191,0.12)',
    accentLine: 'rgba(45,212,191,0.34)',
    accentContrast: '#04201c',
    gradFrom: '#c3aeff',
    gradTo: '#6ee3d2',
    overlayFrom: 'rgba(10,8,18,0)',
    overlayTo: 'rgba(10,8,18,0.94)',
    placeholderFrom: '#26304a',
    placeholderTo: '#171130',
  },
  clara: {
    key: 'clara',
    bg: '#faf9fd',
    surface: '#ffffff',
    surface2: '#f4f2fa',
    line: '#e6e1f2',
    lineStrong: '#d5cdea',
    text: '#1a1330',
    text2: '#635a80',
    text3: '#8b83a6',
    brand: '#6d4aff',
    brandDim: '#efeaff',
    brandLine: '#c9b8ff',
    accent: '#0d9488',
    accentDim: '#e0f5f2',
    accentLine: '#8fd8d0',
    accentContrast: '#ffffff',
    gradFrom: '#7c5cff',
    gradTo: '#0fb5a3',
    overlayFrom: 'rgba(250,249,253,0)',
    overlayTo: 'rgba(26,19,48,0.9)',
    placeholderFrom: '#efeaff',
    placeholderTo: '#e0f5f2',
  },
};

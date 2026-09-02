// Paletas de la ficha (rediseno, seccion 2.1/2.2 del pedido): oscura (identidad
// de marca, por defecto) y clara (pensada para impresion, mas ahorro de
// tinta). Los valores hex son los que pidio el rediseno explicitamente -
// satori no puede leer variables CSS, asi que se hardcodean aqui igual que
// STORY_PALETTES en carnet-image.ts. Mantener en sync si el pedido cambia.
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
  violeta: string;
  violetaDim: string;
  violetaLine: string;
  teal: string;
  tealDim: string;
  tealLine: string;
  tealContrast: string;
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
    bg: '#0f0d18',
    surface: '#171426',
    surface2: '#1c1830',
    line: 'rgba(255,255,255,0.09)',
    lineStrong: 'rgba(255,255,255,0.16)',
    text: '#f5f3fb',
    text2: '#a9a3c4',
    text3: '#736d92',
    violeta: '#b7a5ff',
    violetaDim: 'rgba(183,165,255,0.14)',
    violetaLine: 'rgba(183,165,255,0.34)',
    teal: '#3ee8d2',
    tealDim: 'rgba(62,232,210,0.12)',
    tealLine: 'rgba(62,232,210,0.34)',
    tealContrast: '#04211c',
    gradFrom: '#b7a5ff',
    gradTo: '#3ee8d2',
    overlayFrom: 'rgba(15,13,24,0)',
    overlayTo: 'rgba(15,13,24,0.95)',
    placeholderFrom: '#241f38',
    placeholderTo: '#171426',
  },
  clara: {
    key: 'clara',
    bg: '#ffffff',
    surface: '#ffffff',
    surface2: '#f5f3fa',
    line: '#e7e3f0',
    lineStrong: '#d6cfe8',
    text: '#14121f',
    text2: '#5c5676',
    text3: '#8983a2',
    violeta: '#6d4aff',
    violetaDim: '#efeaff',
    violetaLine: '#c9b8ff',
    teal: '#0d9488',
    tealDim: '#e0f5f2',
    tealLine: '#8fd8d0',
    tealContrast: '#ffffff',
    gradFrom: '#6d4aff',
    gradTo: '#0d9488',
    overlayFrom: 'rgba(255,255,255,0)',
    overlayTo: 'rgba(20,18,31,0.88)',
    placeholderFrom: '#efeaff',
    placeholderTo: '#e0f5f2',
  },
};

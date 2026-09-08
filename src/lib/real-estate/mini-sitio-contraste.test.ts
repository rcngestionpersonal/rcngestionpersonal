import { describe, expect, it } from 'vitest';
import { MINI_SITIO_CLAVES_COLOR, MINI_SITIO_COLORES, type MiniSitioTono } from './mini-sitio';

// Contraste AA de la paleta del mini-sitio (punto 4.6 / 8.3 del pedido).
//
// El agente elige el acento de su sitio publico, asi que el contraste no puede
// depender de que quien agregue un color se acuerde de comprobarlo: cada tono
// de MINI_SITIO_COLORES pasa por aca en los dos temas. Si alguien suma un
// sexto color o retoca un hex y rompe AA, este test lo dice antes del deploy.
//
// Se miden los tres usos reales del acento donde hay texto encima:
//   1. Texto sobre el relleno solido  -> el boton principal de WhatsApp.
//   2. Acento como texto sobre el fondo de la pagina -> precios, numeros.
//   3. Acento como texto sobre su propio tinte suave -> chips y tarjetas.
// El resto de los usos (bordes, glow, anillo de la foto) no llevan texto y no
// estan sujetos al minimo de 4.5:1.

// Fondos reales de cada tema, tal como los define globals.css.
const FONDO = {
  claro: '#faf9fd',
  oscuro: '#0a0812',
} as const;

const MINIMO_AA = 4.5;

function aRgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  return [
    parseInt(limpio.slice(0, 2), 16),
    parseInt(limpio.slice(2, 4), 16),
    parseInt(limpio.slice(4, 6), 16),
  ];
}

// El tinte suave se declara como rgba(): para medir contraste hace falta el
// color YA compuesto sobre el fondo, que es lo que el ojo ve.
function componer(rgba: string, fondoHex: string): [number, number, number] {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`No es un rgba(): ${rgba}`);
  const partes = m[1].split(',').map((v) => Number(v.trim()));
  const [r, g, b] = partes;
  const alfa = partes[3] ?? 1;
  const fondo = aRgb(fondoHex);
  return [
    Math.round(r * alfa + fondo[0] * (1 - alfa)),
    Math.round(g * alfa + fondo[1] * (1 - alfa)),
    Math.round(b * alfa + fondo[2] * (1 - alfa)),
  ];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: [number, number, number], b: [number, number, number]): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

describe('paleta del mini-sitio', () => {
  it('define los cinco colores con su version clara y su version oscura', () => {
    expect(MINI_SITIO_CLAVES_COLOR).toHaveLength(5);
    for (const clave of MINI_SITIO_CLAVES_COLOR) {
      const color = MINI_SITIO_COLORES[clave];
      expect(color.claro.acento, `${clave} claro`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.oscuro.acento, `${clave} oscuro`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.claro.acento).not.toBe(color.oscuro.acento);
    }
  });

  for (const tema of ['claro', 'oscuro'] as const) {
    describe(`tema ${tema}`, () => {
      const fondo = FONDO[tema];

      for (const clave of MINI_SITIO_CLAVES_COLOR) {
        const tono: MiniSitioTono = MINI_SITIO_COLORES[clave][tema];

        it(`${clave}: el texto del boton principal cumple AA sobre el acento`, () => {
          expect(contraste(aRgb(tono.contraste), aRgb(tono.acento))).toBeGreaterThanOrEqual(MINIMO_AA);
        });

        it(`${clave}: el acento cumple AA como texto sobre el fondo de la página`, () => {
          expect(contraste(aRgb(tono.acento), aRgb(fondo))).toBeGreaterThanOrEqual(MINIMO_AA);
        });

        it(`${clave}: el acento cumple AA como texto sobre su propio tinte suave`, () => {
          expect(contraste(aRgb(tono.acento), componer(tono.suave, fondo))).toBeGreaterThanOrEqual(MINIMO_AA);
        });
      }
    });
  }
});

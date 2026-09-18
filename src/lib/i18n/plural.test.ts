import { describe, expect, it } from 'vitest';
import { UI_STRINGS, type Language } from './dictionary';
import { tCantidad } from './plural';

const tDe = (lang: Language) => (clave: string) => UI_STRINGS[lang][clave] ?? clave;

describe('tCantidad', () => {
  const t = tDe('es');

  it('usa el singular solo con 1; el 0 y los demás van en plural', () => {
    expect(tCantidad(t, 'gestion.nextplay.uncontacted.title', 1)).toBe('Tienes 1 match sin contactar');
    expect(tCantidad(t, 'gestion.nextplay.uncontacted.title', 2)).toBe('Tienes 2 matches sin contactar');
    expect(tCantidad(t, 'gestion.nextplay.uncontacted.title', 0)).toBe('Tienes 0 matches sin contactar');
    expect(tCantidad(tDe('en'), 'gestion.nextplay.uncontacted.title', 1)).toBe('You have 1 match to contact');
    expect(tCantidad(tDe('en'), 'gestion.nextplay.uncontacted.title', 3)).toBe('You have 3 matches to contact');
  });

  it('el botón concuerda con la cantidad de matches', () => {
    expect(tCantidad(t, 'gestion.nextplay.uncontacted.cta', 1)).toBe('Contactarlo ahora');
    expect(tCantidad(t, 'gestion.nextplay.uncontacted.cta', 2)).toBe('Contactarlos ahora');
  });

  it('el resumen de cláusulas no dice "1 modificadas"', () => {
    expect(tCantidad(t, 'contratos.clausulas.resumen.modificadas', 1)).toBe('1 modificada');
    expect(tCantidad(t, 'contratos.clausulas.resumen.agregadas', 1)).toBe('1 agregada');
    expect(tCantidad(t, 'contratos.clausulas.resumen.activas', 12)).toBe('12 cláusulas');
  });
});

describe('diccionario', () => {
  const idiomas = Object.keys(UI_STRINGS) as Language[];

  it('el subtítulo de la próxima jugada concuerda con un nombre o con varios', () => {
    expect(UI_STRINGS.es['gestion.nextplay.uncontacted.sub.uno']).toMatch(/^\{names\} tiene /);
    expect(UI_STRINGS.es['gestion.nextplay.uncontacted.sub']).toMatch(/^\{names\} tienen /);
    expect(UI_STRINGS.en['gestion.nextplay.uncontacted.sub.uno']).toMatch(/^\{names\} has /);
    expect(UI_STRINGS.en['gestion.nextplay.uncontacted.sub']).toMatch(/^\{names\} have /);
  });

  // Sin la clave base, un número distinto de 1 mostraría la clave cruda.
  it('cada singular (".uno") tiene su plural, en los dos idiomas', () => {
    for (const lang of idiomas) {
      for (const clave of Object.keys(UI_STRINGS[lang]).filter((c) => c.endsWith('.uno'))) {
        expect(UI_STRINGS[lang][clave.slice(0, -'.uno'.length)], `${lang}: ${clave}`).toBeDefined();
        for (const otro of idiomas) expect(UI_STRINGS[otro][clave], `${otro} no tiene ${clave}`).toBeDefined();
      }
    }
  });

  it('no vuelve el plural entre paréntesis ("match(es)")', () => {
    for (const lang of idiomas) {
      for (const [clave, texto] of Object.entries(UI_STRINGS[lang])) {
        expect(texto, `${lang}: ${clave}`).not.toMatch(/[a-záéíóúñ]\((s|es)\)/i);
      }
    }
  });
});

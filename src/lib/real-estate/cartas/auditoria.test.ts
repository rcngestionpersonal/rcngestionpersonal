import { describe, expect, it } from 'vitest';
import { auditarInvencion } from './auditoria';
import type { CartaBloques, CartaDatosAgente } from './tipos';

// El auditor es la red de seguridad DESPUES del modelo. Estos casos son los que
// aparecieron de verdad al generar cartas contra el modelo real, mas los que
// mas daño harian si aparecieran: una trayectoria que el agente no tiene.

const NOVATO: CartaDatosAgente = {
  nombre: 'Daniela Ordóñez',
  empresa: null,
  aniosEnRedinmo: 0,
  anioIngreso: 2026,
  nivel: 'Inicial',
  zonas: ['Cumbayá'],
  especialidad: 'venta',
  inmueblesActivos: 0,
  composicionInventario: [],
  cierresRegistrados: 0,
  aniosDeExperiencia: null,
  licencia: null,
  verificado: false,
};

const VETERANA: CartaDatosAgente = {
  ...NOVATO,
  nombre: 'Lucía Benalcázar',
  aniosEnRedinmo: 3,
  anioIngreso: 2023,
  inmueblesActivos: 24,
  composicionInventario: [{ tipo: 'departamento', cantidad: 14 }],
  cierresRegistrados: 31,
  aniosDeExperiencia: 9,
};

function carta(parcial: Partial<CartaBloques>): CartaBloques {
  return {
    saludo: 'Estimado señor Andrade:',
    presentacion: 'Mi nombre es Daniela Ordóñez y me dedico a la venta de inmuebles.',
    experiencia: 'Conozco Cumbayá en detalle.',
    inventario: 'Busco lo que mis clientes necesitan.',
    propuesta: 'Le propongo acompañarlo en la venta.',
    cierre: 'Quedo a su disposición.',
    ...parcial,
  };
}

describe('auditoría de invención', () => {
  it('una carta correcta no genera hallazgos', () => {
    expect(auditarInvencion(carta({}), NOVATO)).toEqual([]);
  });

  describe('afirmaciones de trayectoria', () => {
    const FRASES = [
      'Cuento con amplia trayectoria en el sector.',
      'Tengo amplia experiencia en la zona.',
      'Soy un agente reconocido en Quito.',
      'Soy un profesional consolidado.',
      'Somos líder del mercado inmobiliario.',
      'He atendido cientos de clientes.',
      'Cuento con certificaciones internacionales.',
    ];

    it('se detectan aunque el agente tenga historial', () => {
      // Ni siquiera la veterana puede decir esto: no es un dato que entregue.
      for (const texto of FRASES) {
        expect(auditarInvencion(carta({ experiencia: texto }), VETERANA), texto).not.toEqual([]);
      }
    });

    it('el hallazgo nombra el bloque donde apareció', () => {
      const [hallazgo] = auditarInvencion(carta({ propuesta: 'Tengo amplia trayectoria.' }), VETERANA);
      expect(hallazgo).toContain('propuesta');
    });
  });

  describe('cifras que no vienen de los datos', () => {
    it('marca un número de volumen inventado', () => {
      const h = auditarInvencion(carta({ experiencia: 'He cerrado 47 operaciones este año.' }), VETERANA);
      expect(h.join(' ')).toContain('47');
    });

    it('acepta las cifras que sí entregó el agente', () => {
      const h = auditarInvencion(
        carta({ experiencia: 'He registrado 31 cierres y manejo 24 inmuebles desde 2023.' }),
        VETERANA,
      );
      expect(h).toEqual([]);
    });

    it('no confunde un número sin contexto de volumen con una cifra inventada', () => {
      expect(auditarInvencion(carta({ cierre: 'Puede llamarme al 0991234567.' }), VETERANA)).toEqual([]);
    });
  });

  // Lo que el modelo hizo de verdad en la primera pasada contra gpt-4.1-mini.
  describe('cartera escasa: el volumen no se menciona de ninguna forma', () => {
    const CASOS: Array<[string, string]> = [
      ['negar la cartera', 'En este momento no manejo inmuebles activos en cartera.'],
      ['declarar el volumen', 'Cuento con un cierre registrado en la plataforma.'],
      ['dar la cantidad', 'Mi cartera está compuesta por un departamento y una casa.'],
      ['nombrar inmuebles activos', 'Tengo pocos inmuebles activos por ahora.'],
      ['declarar nivel bajo', 'Estoy en un nivel inicial en la plataforma.'],
      ['presentarse como principiante', 'Estoy comenzando mi trayectoria profesional.'],
    ];

    it.each(CASOS)('detecta %s', (_nombre, texto) => {
      expect(auditarInvencion(carta({ inventario: texto }), NOVATO)).not.toEqual([]);
    });

    it('la misma frase NO se marca cuando la cartera sí da', () => {
      // "Manejo 24 inmuebles" es legítimo para quien tiene 24.
      expect(auditarInvencion(carta({ inventario: 'Manejo 24 inmuebles activos.' }), VETERANA)).toEqual([]);
    });
  });

  it('no marca dos veces el mismo hallazgo', () => {
    const h = auditarInvencion(
      carta({ experiencia: 'Amplia trayectoria.', propuesta: 'Amplia trayectoria.' }),
      VETERANA,
    );
    expect(new Set(h).size).toBe(h.length);
  });

  it('ignora los bloques vacíos en vez de tratarlos como sospechosos', () => {
    expect(auditarInvencion(carta({ inventario: '', experiencia: '   ' }), NOVATO)).toEqual([]);
  });
});

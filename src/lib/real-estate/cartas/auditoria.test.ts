import { describe, expect, it } from 'vitest';
import { auditarInvencion } from './auditoria';
import { cierresMencionables, inventarioMencionable, type CartaBloques, type CartaDatosAgente } from './tipos';

// El auditor es la red de seguridad DESPUES del modelo. Estos casos son los que
// aparecieron de verdad al generar cartas contra el modelo real, mas los que
// mas daño harian si aparecieran: una trayectoria que el agente no tiene.

const NOVATO: CartaDatosAgente = {
  nombre: 'Daniela Ordóñez',
  empresa: null,
  aniosEnRedinmo: 0,
  anioIngreso: 2026,
  nivel: 'Agente Inicial',
  zonas: ['Cumbayá'],
  especialidad: 'venta',
  inmueblesActivos: 0,
  composicionInventario: [],
  cierresRegistrados: 0,
  aniosExperienciaDeclarados: null,
  licencia: null,
  verificado: false,
};

const VETERANA: CartaDatosAgente = {
  ...NOVATO,
  nombre: 'Lucía Benalcázar',
  nivel: 'Agente Elite',
  aniosEnRedinmo: 3,
  anioIngreso: 2023,
  inmueblesActivos: 24,
  composicionInventario: [{ tipo: 'departamento', cantidad: 14 }],
  cierresRegistrados: 31,
  aniosExperienciaDeclarados: 9,
};

// Los datos reales de la carta que salió mal en producción, tal como quedaron
// congelados en datosUsados.
const LEX_LUTOR: CartaDatosAgente = {
  ...NOVATO,
  nombre: 'Lex Lutor',
  empresa: 'Bienes 4A',
  nivel: 'Agente Activo',
  inmueblesActivos: 4,
  composicionInventario: [
    { tipo: 'departamento', cantidad: 3 },
    { tipo: 'local comercial', cantidad: 1 },
  ],
  cierresRegistrados: 3,
  aniosExperienciaDeclarados: 15,
  licencia: '3156',
  verificado: true,
};

const TEXTO_LEX =
  'Cuento con 15 años de experiencia en el sector y he registrado tres cierres en la plataforma Redinmo.io como Agente Activo. Mi licencia profesional es la número 3156 y mi identidad y teléfono están verificados en la plataforma.';

function carta(parcial: Partial<CartaBloques>): CartaBloques {
  return {
    saludo: 'Estimado Patricio Andrade,',
    apertura: '',
    presentacion: 'Mi nombre es Daniela Ordóñez y me dedico a la venta de inmuebles.',
    experiencia: 'Conozco Cumbayá en detalle.',
    inventario: 'Busco lo que mis clientes necesitan.',
    propuesta: 'Le propongo acompañarle en la venta.',
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

    it('lee los números escritos en letras', () => {
      expect(auditarInvencion(carta({ experiencia: 'He registrado treinta y un cierres.' }), VETERANA)).toEqual([]);
      expect(auditarInvencion(carta({ experiencia: 'He registrado cuarenta cierres.' }), VETERANA)).not.toEqual([]);
    });

    it('"una propiedad" es un artículo, no una cifra', () => {
      expect(auditarInvencion(carta({ propuesta: 'La venta de una propiedad como la suya requiere método.' }), NOVATO)).toEqual([]);
    });
  });

  // ---- El caso de producción ----
  describe('la carta de Lex Lutor', () => {
    it('marca "tres cierres": por debajo del umbral no se menciona', () => {
      const h = auditarInvencion(carta({ experiencia: TEXTO_LEX }), LEX_LUTOR).join(' | ');
      expect(h).toMatch(/cierres/);
      expect(h).toContain('"3"');
    });

    it('marca el nivel de la plataforma, que afuera no significa nada', () => {
      const h = auditarInvencion(carta({ experiencia: TEXTO_LEX }), LEX_LUTOR).join(' | ');
      expect(h).toContain('Agente Activo');
    });

    it('NO marca los 15 años: los declaró el agente', () => {
      const h = auditarInvencion(carta({ experiencia: TEXTO_LEX }), LEX_LUTOR).join(' | ');
      expect(h).not.toMatch(/años de experiencia/);
    });

    it('SÍ los marca si el agente no los hubiera declarado', () => {
      const h = auditarInvencion(carta({ experiencia: TEXTO_LEX }), { ...LEX_LUTOR, aniosExperienciaDeclarados: null }).join(' | ');
      expect(h).toContain('años de experiencia "15" sin respaldo');
    });
  });

  describe('años de experiencia: cada cifra contra su fuente', () => {
    const SIN_DECLARAR = { ...VETERANA, aniosExperienciaDeclarados: null };

    it('sin años declarados, cualquier cifra de años es inventada, también en letras', () => {
      for (const texto of ['Tengo 12 años de experiencia.', 'Cuento con quince años de experiencia en el sector.', 'Llevo un año en el rubro.']) {
        expect(auditarInvencion(carta({ experiencia: texto }), SIN_DECLARAR), texto).not.toEqual([]);
      }
    });

    it('sin años declarados, tampoco se habla de experiencia sin cifra', () => {
      expect(auditarInvencion(carta({ experiencia: 'Tengo años de experiencia en la zona.' }), SIN_DECLARAR)).not.toEqual([]);
      expect(auditarInvencion(carta({ experiencia: 'Llevo más de una década en esto.' }), SIN_DECLARAR)).not.toEqual([]);
    });

    it('el agujero de antes: un número real de OTRA fuente no respalda los años', () => {
      // 24 son sus inmuebles, no sus años. La bolsa comun de numeros lo dejaba pasar.
      const h = auditarInvencion(carta({ experiencia: 'Tengo 24 años de experiencia.' }), VETERANA).join(' | ');
      expect(h).toContain('no coincide con los 9 que declaró el agente');
    });

    it('con años declarados, el número exacto pasa y el inflado no', () => {
      expect(auditarInvencion(carta({ experiencia: 'Tengo 9 años de experiencia en el sector.' }), VETERANA)).toEqual([]);
      expect(auditarInvencion(carta({ experiencia: 'Tengo nueve años de experiencia.' }), VETERANA)).toEqual([]);
      expect(auditarInvencion(carta({ experiencia: 'Tengo más de 9 años de experiencia.' }), VETERANA)).not.toEqual([]);
      expect(auditarInvencion(carta({ experiencia: 'Tengo casi 10 años de experiencia.' }), VETERANA)).not.toEqual([]);
      expect(auditarInvencion(carta({ experiencia: 'Tengo muchos años de experiencia.' }), VETERANA)).not.toEqual([]);
    });

    it('los años en Redinmo se validan contra la plataforma, no contra lo declarado', () => {
      expect(auditarInvencion(carta({ experiencia: 'Opero en Redinmo.io desde hace 3 años.' }), VETERANA)).toEqual([]);
      expect(auditarInvencion(carta({ experiencia: 'Llevo 9 años en la plataforma Redinmo.io.' }), VETERANA)).not.toEqual([]);
    });
  });

  describe('umbrales de volumen', () => {
    it('cada cifra se habilita por separado', () => {
      expect(cierresMencionables({ cierresRegistrados: 9, inmueblesActivos: 0 })).toBe(false);
      expect(cierresMencionables({ cierresRegistrados: 10, inmueblesActivos: 0 })).toBe(true);
      expect(inventarioMencionable({ cierresRegistrados: 0, inmueblesActivos: 4 })).toBe(false);
      expect(inventarioMencionable({ cierresRegistrados: 0, inmueblesActivos: 5 })).toBe(true);
    });

    it('con muchos cierres y cartera chica, cita los cierres y no la cartera', () => {
      const mixto = { ...VETERANA, inmueblesActivos: 2, composicionInventario: [{ tipo: 'casa', cantidad: 2 }] };
      expect(auditarInvencion(carta({ experiencia: 'He registrado 31 cierres.' }), mixto)).toEqual([]);
      expect(auditarInvencion(carta({ inventario: 'Represento 2 casas.' }), mixto)).not.toEqual([]);
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
      ['cuantificar sin cifra', 'He concretado varias operaciones en la zona.'],
    ];

    it.each(CASOS)('detecta %s', (_nombre, texto) => {
      expect(auditarInvencion(carta({ inventario: texto }), NOVATO)).not.toEqual([]);
    });

    // Falsos positivos que aparecieron contra el modelo real y mandaban cartas
    // correctas a la plantilla.
    it.each([
      ['el inmueble del destinatario', 'Le ofrezco un manejo serio y profesional de su inmueble.'],
      ['representar su propiedad', 'Represento su propiedad con el mismo cuidado que pondría en la mía.'],
    ])('NO marca %s', (_nombre, texto) => {
      expect(auditarInvencion(carta({ propuesta: texto }), NOVATO)).toEqual([]);
    });

    it('sigue marcando la cartera propia dicha sin cifra', () => {
      expect(auditarInvencion(carta({ inventario: 'Manejo propiedades en Cumbayá y Tumbaco.' }), NOVATO)).not.toEqual([]);
    });

    it('el número de licencia no es una cifra inventada', () => {
      const conLicencia = { ...LEX_LUTOR, cierresRegistrados: 12 };
      const h = auditarInvencion(carta({ experiencia: 'Me especializo en ventas. Mi licencia profesional es la número 3156.' }), conLicencia);
      expect(h).toEqual([]);
    });

    it('la misma frase NO se marca cuando la cartera sí da', () => {
      // "Manejo 24 inmuebles" es legítimo para quien tiene 24.
      expect(auditarInvencion(carta({ inventario: 'Manejo 24 inmuebles activos.' }), VETERANA)).toEqual([]);
    });
  });

  describe('estructura de la apertura', () => {
    const CTX = { contexto: 'nos conocimos en la feria', trato: 'femenino' as const, nombreDestinatario: 'Ing. Gabriela Muñoz' };

    it('sin contexto no hay apertura', () => {
      expect(auditarInvencion(carta({ apertura: 'Un gusto saludarle.' }), NOVATO, { contexto: null })).not.toEqual([]);
    });

    it('sin contexto no se alude a un encuentro previo', () => {
      const h = auditarInvencion(
        carta({ presentacion: 'Tras nuestra conversación, le cuento que soy Daniela Ordóñez.' }),
        NOVATO,
        { contexto: null },
      );
      expect(h.join(' ')).toContain('encuentro previo');
    });

    it('con contexto, retomarlo es correcto', () => {
      const h = auditarInvencion(carta({ apertura: 'Un gusto saludarla tras nuestra conversación en la feria.' }), NOVATO, CTX);
      expect(h).toEqual([]);
    });

    it('prohíbe paréntesis en el saludo y la apertura', () => {
      expect(auditarInvencion(carta({ apertura: '(Un gusto saludarla tras la feria.)' }), NOVATO, CTX)).not.toEqual([]);
    });

    it('marca el caso de producción: el nombre fundido al empezar', () => {
      const h = auditarInvencion(
        carta({ apertura: 'Ing. Gabriela Muñoz, un gusto saludarla tras nuestra conversación.' }),
        NOVATO,
        CTX,
      );
      expect(h.join(' ')).toContain('vuelve a nombrar al destinatario');
    });

    it('marca un saludo repetido dentro de la apertura', () => {
      expect(auditarInvencion(carta({ apertura: 'Estimada Gabriela, un gusto saludarla.' }), NOVATO, CTX)).not.toEqual([]);
    });
  });

  describe('concordancia de género con el saludo', () => {
    it('"Estimada" no puede seguir con "acompañarlo"', () => {
      const h = auditarInvencion(carta({ propuesta: 'Le propongo acompañarlo en la venta.' }), NOVATO, { trato: 'femenino' });
      expect(h.join(' ')).toContain('no concuerda');
    });

    it('con género indeterminado no se usa ni "la" ni "lo"', () => {
      expect(auditarInvencion(carta({ apertura: '' , cierre: 'Será un gusto saludarla.' }), NOVATO, { trato: 'indeterminado' })).not.toEqual([]);
      expect(auditarInvencion(carta({ cierre: 'Será un gusto saludarle.' }), NOVATO, { trato: 'indeterminado' })).toEqual([]);
    });
  });

  it('marca la tercera persona: la carta la firma el agente', () => {
    const h = auditarInvencion(carta({ presentacion: 'Daniela Ordóñez se dedica a la venta de inmuebles en Cumbayá.' }), NOVATO);
    expect(h.join(' ')).toContain('tercera persona');
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

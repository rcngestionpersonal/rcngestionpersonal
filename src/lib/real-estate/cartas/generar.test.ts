import { describe, expect, it } from 'vitest';
import { borradorDePlantilla } from './generar';
import { bloquesATexto, inventarioEsEscaso, type CartaDatosAgente } from './tipos';

// La regla critica de la Fase 4 (punto 2.2) es que la carta NO afirme
// trayectoria que los datos no respalden. El prompt se la pide al modelo, pero
// un prompt no es una garantia: lo que si se puede probar de forma
// determinista es el camino de plantilla, que es el que corre cuando no hay
// proveedor configurado y el que define el piso de comportamiento.
//
// Estas pruebas son ese piso: con un agente sin trayectoria, el texto no puede
// contener ni una cifra de volumen ni un adjetivo de veterania.

const AGENTE_NUEVO: CartaDatosAgente = {
  nombre: 'Ana Torres',
  empresa: null,
  aniosEnRedinmo: 0,
  anioIngreso: 2026,
  nivel: 'Agente Inicial',
  zonas: ['Cumbayá'],
  especialidad: 'venta',
  inmueblesActivos: 1,
  composicionInventario: [{ tipo: 'departamento', cantidad: 1 }],
  cierresRegistrados: 0,
  aniosDeExperiencia: null,
  licencia: null,
  verificado: false,
};

const AGENTE_CON_CARTERA: CartaDatosAgente = {
  ...AGENTE_NUEVO,
  nombre: 'Luis Paredes',
  empresa: 'Andes Realty',
  aniosEnRedinmo: 3,
  anioIngreso: 2023,
  nivel: 'Agente Elite',
  inmueblesActivos: 12,
  composicionInventario: [
    { tipo: 'casa', cantidad: 7 },
    { tipo: 'departamento', cantidad: 5 },
  ],
  cierresRegistrados: 9,
  aniosDeExperiencia: 8,
  verificado: true,
};

// Frases que solo puede decir quien tiene los numeros para sostenerlas.
const EXAGERACIONES = [
  'amplia trayectoria',
  'amplia experiencia',
  'larga trayectoria',
  'cientos',
  'decenas',
  'lider',
  'líder',
  'referente',
  'reconocido',
  'el mejor',
  'la mejor',
  'prestigio',
  'experto',
];

function base(entrada: CartaDatosAgente) {
  return {
    datos: entrada,
    destinatarioTipo: 'PROPIETARIO' as const,
    destinatarioNombre: 'María Jaramillo',
  };
}

describe('cartas: cero invención', () => {
  it('marca como escasa la cartera de un agente sin cierres', () => {
    expect(inventarioEsEscaso(AGENTE_NUEVO)).toBe(true);
    expect(inventarioEsEscaso(AGENTE_CON_CARTERA)).toBe(false);
  });

  it('con 0 cierres no menciona volumen ni inventa trayectoria', () => {
    const texto = bloquesATexto(borradorDePlantilla(base(AGENTE_NUEVO))).toLowerCase();

    for (const frase of EXAGERACIONES) {
      expect(texto, `no debería decir "${frase}"`).not.toContain(frase);
    }
    // Ni el conteo de cierres ni el de inmuebles aparecen cuando son bajos:
    // "1 inmueble" o "0 cierres" restan mas de lo que suman.
    expect(texto).not.toContain('cierres');
    expect(texto).not.toContain('1 inmueble');
    // Y sin embargo la carta existe y dice algo util: su zona y su especialidad.
    expect(texto).toContain('cumbayá');
    expect(texto).toContain('venta');
  });

  it('con cartera real sí puede citar sus números, y son los reales', () => {
    const texto = bloquesATexto(borradorDePlantilla(base(AGENTE_CON_CARTERA))).toLowerCase();

    expect(texto).toContain('12 inmuebles activos');
    expect(texto).toContain('9 cierres');
    // Aun con cartera, nada de adjetivos de veterania inventados.
    for (const frase of EXAGERACIONES) {
      expect(texto, `no debería decir "${frase}"`).not.toContain(frase);
    }
  });

  it('nunca inventa una empresa que el agente no registró', () => {
    const texto = bloquesATexto(borradorDePlantilla(base(AGENTE_NUEVO)));
    expect(texto).not.toContain('undefined');
    expect(texto).not.toContain('null');
    expect(texto).toContain('Ana Torres');
  });

  it('el saludo usa el nombre del destinatario, no un genérico', () => {
    const bloques = borradorDePlantilla(base(AGENTE_NUEVO));
    expect(bloques.saludo).toContain('María Jaramillo');
  });
});

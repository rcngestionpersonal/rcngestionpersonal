import { describe, expect, it } from 'vitest';
import { bloquesATextoPlano, construirDocumento } from '../documento';
import { obtenerPlantilla, plantillaActual, plantillasVigentes } from './index';
import {
  AVISO_MODULO,
  CONTRATO_DEFINICION,
  CONTRATO_MENU,
  CONTRATO_TIPOS,
  CONTRATO_TIPOS_LEGADO,
  MARCADOR_SIN_COMPLETAR,
  NOTA_PIE_PDF,
  camposFaltantes,
  esTipoArchivado,
  type ContratoTipo,
} from '../tipos';

// Pruebas de las plantillas de contrato. NO tocan la base: construirDocumento
// es puro, recibe los datos ya resueltos y devuelve bloques.

const AGENTE = {
  nombre: 'Ana Sarmiento',
  cedula: '1710804954',
  ruc: null,
  licencia: 'CBR-4821',
  direccion: 'Av. República del Salvador N36-109, Quito',
  telefono: '+593 96 870 7200',
  correo: 'ana@ejemplo.com',
  ciudad: 'Quito',
};

const INMUEBLE = {
  descripcion: 'un departamento denominado "Torres del Bosque 4B"',
  ubicacion: 'Jipijapa, Quito',
  caracteristicas: 'El inmueble cuenta con 120 m² de área, 3 dormitorios, 2 baños.',
};

// Un valor plausible para cada campo, para que ninguna cláusula se evalúe con
// la cadena vacía y pase por buena sin haberse ejercitado.
function datosDe(tipo: ContratoTipo): Record<string, string> {
  const datos: Record<string, string> = {};
  for (const seccion of CONTRATO_DEFINICION[tipo].secciones) {
    for (const campo of seccion.campos) {
      if (campo.porDefecto) {
        datos[campo.clave] = campo.porDefecto;
        continue;
      }
      switch (campo.tipo) {
        case 'correo':
          datos[campo.clave] = 'parte@ejemplo.com';
          break;
        case 'cedula':
          datos[campo.clave] = '1712345678';
          break;
        case 'telefono':
          datos[campo.clave] = '+593 99 123 4567';
          break;
        case 'dinero':
          datos[campo.clave] = '185000';
          break;
        case 'porcentaje':
          datos[campo.clave] = '3';
          break;
        case 'numero':
          datos[campo.clave] = '12';
          break;
        case 'fecha':
          datos[campo.clave] = '2026-10-15';
          break;
        case 'opcion':
        case 'opcionExplicada':
          datos[campo.clave] = campo.opciones?.[0]?.valor ?? '';
          break;
        case 'multiple':
          datos[campo.clave] = (campo.opciones ?? []).map((o) => o.valor).join(',');
          break;
        default:
          datos[campo.clave] = `Valor de ${campo.etiqueta}`;
      }
    }
  }
  return datos;
}

function documentoDe(tipo: ContratoTipo, extra: Record<string, string> = {}) {
  return construirDocumento({
    tipo,
    version: plantillaActual(tipo),
    datos: { ...datosDe(tipo), ...extra },
    agente: AGENTE,
    inmueble: INMUEBLE,
    fecha: new Date('2026-09-11T12:00:00Z'),
  });
}

function textoDe(tipo: ContratoTipo, extra: Record<string, string> = {}): string {
  return bloquesATextoPlano(documentoDe(tipo, extra).bloques);
}

function clausula(tipo: ContratoTipo, titulo: string, extra: Record<string, string> = {}): string {
  const b = documentoDe(tipo, extra).bloques.find((x) => x.tipo === 'clausula' && x.titulo === titulo);
  return b && 'texto' in b ? b.texto : '';
}

const VIVOS = CONTRATO_MENU.map((e) => e.tipo);

describe('plantillas de contrato', () => {
  it('solo se pueden generar corretaje y arrendamiento', () => {
    expect(VIVOS).toEqual(['CORRETAJE', 'ARRENDAMIENTO']);
    for (const tipo of VIVOS) expect(esTipoArchivado(tipo), tipo).toBe(false);
  });

  it('cada tipo genera un documento con cláusulas y bloque de firmas', () => {
    for (const tipo of CONTRATO_TIPOS) {
      const doc = documentoDe(tipo);
      expect(doc.bloques.filter((b) => b.tipo === 'clausula').length, tipo).toBeGreaterThan(4);
      expect(doc.bloques.some((b) => b.tipo === 'titulo'), tipo).toBe(true);
      expect(doc.bloques.some((b) => b.tipo === 'firmas'), tipo).toBe(true);
      expect(bloquesATextoPlano(doc.bloques).length, tipo).toBeGreaterThan(1500);
    }
  });

  it('ningún documento imprime marcas de campo sin resolver', () => {
    for (const tipo of CONTRATO_TIPOS) {
      const texto = textoDe(tipo);
      expect(texto, tipo).not.toContain('…………');
      expect(texto, tipo).not.toContain('undefined');
      expect(texto, tipo).not.toContain('[object Object]');
    }
  });

  // Los tipos retirados se abren y se imprimen; lo que no se puede es crearlos.
  describe('tipos retirados', () => {
    it('no aparecen en el selector', () => {
      for (const tipo of CONTRATO_TIPOS_LEGADO) {
        expect(VIVOS, tipo).not.toContain(tipo);
        expect(esTipoArchivado(tipo), tipo).toBe(true);
      }
    });

    it('conservan su definición y siguen generando su documento', () => {
      for (const tipo of CONTRATO_TIPOS_LEGADO) {
        expect(CONTRATO_DEFINICION[tipo], tipo).toBeDefined();
        expect(textoDe(tipo).length, tipo).toBeGreaterThan(1500);
      }
    });

    it('la reserva ya no se puede generar, pero una archivada se reimprime', () => {
      for (const tipo of ['RESERVA_COMPRAVENTA', 'RESERVA_ARRIENDO'] as const) {
        expect(VIVOS).not.toContain(tipo);
        expect(obtenerPlantilla(tipo, 'v1-2026-09').version).toBe('v1-2026-09');
      }
    });

    it('no se listan como plantillas vigentes del módulo', () => {
      const ofrecidas = plantillasVigentes().filter((p) => !CONTRATO_TIPOS_LEGADO.includes(p.tipo));
      expect(ofrecidas.map((p) => p.tipo).sort()).toEqual(['ARRENDAMIENTO', 'CORRETAJE']);
    });
  });

  // Un campo opcional vacío deja una marca visible, no un hueco que pase
  // desapercibido al revisar y termine en el documento firmado.
  it('los campos opcionales vacíos salen marcados, no en blanco', () => {
    const texto = textoDe('CORRETAJE', { propiedadCatastro: '', linderoNorte: '', linderoSur: '' });
    expect(texto).toContain(MARCADOR_SIN_COMPLETAR);
  });

  describe('corretaje: consignación para venta', () => {
    it('emite las once cláusulas, siempre las mismas', () => {
      for (const exclusividad of ['CON', 'SIN']) {
        const clausulas = documentoDe('CORRETAJE', { exclusividad }).bloques.filter((b) => b.tipo === 'clausula');
        expect(clausulas, exclusividad).toHaveLength(11);
      }
    });

    it('la exclusividad cambia el título y la cláusula séptima, y nada más', () => {
      const con = documentoDe('CORRETAJE', { exclusividad: 'CON' }).bloques.filter((b) => b.tipo === 'clausula');
      const sin = documentoDe('CORRETAJE', { exclusividad: 'SIN' }).bloques.filter((b) => b.tipo === 'clausula');
      const distintas = con.filter((c, i) => JSON.stringify(c) !== JSON.stringify(sin[i]));
      expect(distintas).toHaveLength(1);
      expect(distintas[0] && 'titulo' in distintas[0] ? distintas[0].titulo : '').toBe('EXCLUSIVIDAD');
    });

    it('con exclusividad, cobra aunque se venda por otra vía', () => {
      expect(clausula('CORRETAJE', 'EXCLUSIVIDAD', { exclusividad: 'CON' })).toContain('se abstiene de comercializar');
      expect(clausula('CORRETAJE', 'AUSENCIA DE EXCLUSIVIDAD', { exclusividad: 'SIN' })).toContain(
        'conserva la facultad de comercializar',
      );
    });

    // El IVA no se fija en ningún número duro: cambia por ley y el documento
    // quedaría desactualizado sin que nadie lo note.
    it('el IVA nunca se imprime como número si no se declara', () => {
      const sinTarifa = clausula('CORRETAJE', 'HONORARIOS', { ivaTarifa: '' });
      expect(sinTarifa).toContain('a la tarifa vigente');
      expect(sinTarifa).not.toMatch(/tarifa vigente del \d/);
      expect(clausula('CORRETAJE', 'HONORARIOS', { ivaTarifa: '15' })).toContain('a la tarifa vigente del 15%');
    });

    it('nunca escribe un 12% de IVA quemado', () => {
      expect(textoDe('CORRETAJE', { ivaTarifa: '' })).not.toContain('12%');
    });

    it('el alcance del comprador presentado cubre parientes, herederos y sociedades', () => {
      const texto = clausula('CORRETAJE', 'ALCANCE DEL COMPRADOR PRESENTADO');
      for (const palabra of ['parientes', 'herederos', 'beneficiarios', 'socios', 'sociedades']) {
        expect(texto, palabra).toContain(palabra);
      }
    });

    it('la señal la devuelve quien la tiene', () => {
      expect(clausula('CORRETAJE', 'DEPÓSITO O SEÑAL DE TRATO', { depositoEnPoderDe: 'CORREDOR' })).toContain(
        'en poder del Corredor',
      );
      expect(clausula('CORRETAJE', 'DEPÓSITO O SEÑAL DE TRATO', { depositoEnPoderDe: 'PROPIETARIO' })).toContain(
        'en poder del Propietario',
      );
      expect(
        clausula('CORRETAJE', 'DEPÓSITO O SEÑAL DE TRATO', {
          depositoEnPoderDe: 'PROPIETARIO',
          siDesisteComprador: 'SE_PIERDE',
        }),
      ).toContain('sin que deba realizarse desembolso alguno');
    });

    it('la información de la propiedad va al final, con sus linderos', () => {
      const doc = documentoDe('CORRETAJE');
      const ficha = doc.bloques.find((b) => b.tipo === 'ficha' && b.titulo === 'INFORMACIÓN DE LA PROPIEDAD');
      expect(ficha).toBeDefined();
      const etiquetas = ficha && 'filas' in ficha ? ficha.filas.map((f) => f.etiqueta) : [];
      expect(etiquetas).toEqual([
        'Precio de venta',
        'Dirección',
        'Ciudad',
        'Provincia',
        'Número de catastro',
        'Lindero norte',
        'Lindero sur',
        'Lindero este',
        'Lindero oeste',
      ]);
    });
  });

  describe('arrendamiento', () => {
    it('no contiene ninguna de las cláusulas irrenunciables', () => {
      const texto = textoDe('ARRENDAMIENTO').toLowerCase();
      for (const prohibida of [
        'desahucio',
        'renuncia a la jurisdicción',
        'renuncian a la jurisdicción',
        'por su propia cuenta los bienes',
        'cánones fijados por el municipio',
        'jefatura de catastros',
        'registro de arrendamientos',
      ]) {
        expect(texto, prohibida).not.toContain(prohibida);
      }
    });

    it('la terminación remite a la normativa vigente, sin vías de hecho', () => {
      const texto = clausula('ARRENDAMIENTO', 'CAUSALES DE TERMINACIÓN');
      expect(texto).toContain('conforme a la normativa vigente');
      expect(texto).toContain('las acciones legales que correspondan');
    });

    it('las controversias van a mediación y luego a jueces competentes', () => {
      const texto = clausula('ARRENDAMIENTO', 'SOLUCIÓN DE CONTROVERSIAS');
      expect(texto).toContain('mediación');
      expect(texto).toContain('jueces competentes');
      expect(texto).not.toContain('renuncia');
    });

    // Declaración mutua, no renuncia unilateral.
    describe('declaración sobre el canon', () => {
      const TITULO = 'DECLARACIÓN DE LAS PARTES SOBRE EL CANON';

      it('viene activada por defecto', () => {
        expect(CONTRATO_DEFINICION.ARRENDAMIENTO.secciones.flatMap((s) => s.campos).find((c) => c.clave === 'declaracionCanon')
          ?.porDefecto).toBe('SI');
        expect(clausula('ARRENDAMIENTO', TITULO)).not.toBe('');
      });

      it('se puede desactivar', () => {
        expect(clausula('ARRENDAMIENTO', TITULO, { declaracionCanon: 'NO' })).toBe('');
      });

      it('es una declaración de ambas partes y no usa la palabra renuncia', () => {
        const texto = clausula('ARRENDAMIENTO', TITULO);
        expect(texto).toContain('Las partes declaran');
        expect(texto).toContain('libre y voluntaria');
        expect(texto).toContain('condiciones vigentes del mercado');
        expect(texto.toLowerCase()).not.toContain('renuncia');
        expect(texto.toLowerCase()).not.toContain('municipio');
      });
    });

    it('el uso comercial añade la responsabilidad por permisos, y la vivienda no', () => {
      expect(clausula('ARRENDAMIENTO', 'DESTINO Y USO', { destino: 'LOCAL_COMERCIAL' })).toContain('permisos, patentes y licencias');
      expect(clausula('ARRENDAMIENTO', 'DESTINO Y USO', { destino: 'VIVIENDA' })).not.toContain('permisos, patentes');
    });

    it('la tabla de daños se imprime con sus conceptos', () => {
      const ficha = documentoDe('ARRENDAMIENTO').bloques.find(
        (b) => b.tipo === 'ficha' && b.titulo === 'VALORES DE LIQUIDACIÓN DE DAÑOS',
      );
      expect(ficha).toBeDefined();
      const etiquetas = ficha && 'filas' in ficha ? ficha.filas.map((f) => f.etiqueta) : [];
      expect(etiquetas[0]).toContain('Pintura');
      expect(etiquetas[1]).toContain('Piso');
      expect(etiquetas[2]).toContain('Cerradura');
      expect(etiquetas).toHaveLength(4);
    });
  });

  // El disclaimer informa en vez de advertir: las plantillas dejaron de ser
  // redacción improvisada.
  describe('disclaimer', () => {
    it('el pie del PDF es una sola línea y no llama referencial al documento', () => {
      expect(NOTA_PIE_PDF).toBe('Formato referencial. Redinmo no es parte del contrato.');
      expect(NOTA_PIE_PDF.split('.').filter(Boolean)).toHaveLength(2);
    });

    it('la nota del módulo nombra la base documental y el límite del servicio', () => {
      expect(AVISO_MODULO).toContain('formatos de uso común entre asociaciones de corredores de bienes raíces del Ecuador');
      expect(AVISO_MODULO).toContain('Redinmo no presta servicios legales');
      expect(AVISO_MODULO).toContain('revisa el documento con tu abogado');
    });

    it('ninguna plantilla viva se marca como pendiente de revisión legal', () => {
      for (const tipo of VIVOS) {
        expect(obtenerPlantilla(tipo, plantillaActual(tipo)).revisadaPorAbogado, tipo).toBe(true);
        expect(documentoDe(tipo).bloques.some((b) => b.tipo === 'aviso'), tipo).toBe(false);
      }
    });
  });

  describe('versionado por tipo', () => {
    it('cada tipo vivo tiene su propia versión actual', () => {
      expect(plantillaActual('CORRETAJE')).toBe('corretaje-v2-2026-09');
      expect(plantillaActual('ARRENDAMIENTO')).toBe('arrendamiento-v3-2026-09');
    });

    it('un contrato viejo sigue resolviendo la versión con la que se firmó', () => {
      expect(obtenerPlantilla('ARRENDAMIENTO', 'arrendamiento-v2-2026-09').version).toBe('arrendamiento-v2-2026-09');
      expect(obtenerPlantilla('CORRETAJE_EXCLUSIVO', 'corretaje-exclusivo-v1-2026-09').version).toBe(
        'corretaje-exclusivo-v1-2026-09',
      );
    });

    it('una versión desconocida cae a la actual de su tipo en vez de reventar', () => {
      expect(obtenerPlantilla('CORRETAJE', 'no-existe').version).toBe(plantillaActual('CORRETAJE'));
    });
  });

  // Decisión de producto ratificada: las cláusulas que más conflicto generan se
  // eligen a mano. Este test existe para que un default futuro falle en CI.
  describe('las decisiones con consecuencia se eligen conscientemente', () => {
    const SIN_DEFAULT: Array<[ContratoTipo, string]> = [
      ['CORRETAJE', 'exclusividad'],
      ['CORRETAJE', 'siDesisteComprador'],
    ];

    it('no tienen valor por defecto y son obligatorias', () => {
      for (const [tipo, clave] of SIN_DEFAULT) {
        const campo = CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos).find((c) => c.clave === clave);
        expect(campo, `${tipo}.${clave}`).toBeDefined();
        expect(campo?.porDefecto, `${tipo}.${clave} no puede traer default`).toBeUndefined();
        expect(campo?.obligatorio, `${tipo}.${clave} debe ser obligatorio`).toBe(true);
        expect(campo?.tipo, `${tipo}.${clave} debe verse como tarjetas`).toBe('opcionExplicada');
        for (const opcion of campo?.opciones ?? []) {
          expect(opcion.consecuencia, `${tipo}.${clave}/${opcion.valor}`).toBeTruthy();
        }
      }
    });

    it('un contrato sin elegirlas no se puede enviar a firma', () => {
      for (const [tipo, clave] of SIN_DEFAULT) {
        const etiqueta = CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos).find((c) => c.clave === clave)!.etiqueta;
        expect(camposFaltantes(tipo, { ...datosDe(tipo), [clave]: '' }), `${tipo}.${clave}`).toContain(etiqueta);
      }
    });
  });
});

import { describe, expect, it } from 'vitest';
import { bloquesATextoPlano, construirDocumento } from '../documento';
import { obtenerPlantilla, plantillaActual, plantillasVigentes } from './index';
import {
  CONTRATO_DEFINICION,
  CONTRATO_TIPOS,
  AVISO_MODULO_CASILLA,
  AVISO_MODULO_PARRAFOS,
  AVISO_PAGINA_FIRMA,
  AVISO_VISTA_PREVIA,
  NOTA_PIE_OBLIGATORIA,
  camposFaltantes,
  type ContratoTipo,
} from '../tipos';

// Pruebas de las plantillas de contrato. NO tocan la base: construirDocumento
// es puro, recibe los datos ya resueltos y devuelve bloques.
//
// Lo que vigilan es lo que duele si se rompe en silencio: que todo tipo que el
// agente puede generar produzca un documento, que las dos modalidades de
// corretaje sean documentos distintos y no el mismo texto con un campo
// cambiado, y que ningun documento vuelva a imprimir datos bancarios.

const AGENTE = {
  nombre: 'Ana Sarmiento',
  cedula: '1710804954',
  ruc: null,
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

// Un valor plausible para cada campo de cada tipo, para que ninguna cláusula
// se evalúe con la cadena vacía y pase por buena sin haberse ejercitado.
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
    fecha: new Date('2026-09-09T12:00:00Z'),
  });
}

describe('plantillas de contrato', () => {
  it('cada tipo genera un documento con cláusulas y bloque de firmas', () => {
    for (const tipo of CONTRATO_TIPOS) {
      const doc = documentoDe(tipo);
      expect(doc.bloques.filter((b) => b.tipo === 'clausula').length, tipo).toBeGreaterThan(4);
      expect(doc.bloques.some((b) => b.tipo === 'titulo'), tipo).toBe(true);
      expect(doc.bloques.some((b) => b.tipo === 'firmas'), tipo).toBe(true);
      expect(bloquesATextoPlano(doc.bloques).length, tipo).toBeGreaterThan(1500);
    }
  });

  it('ningún documento imprime "..." de un campo sin resolver', () => {
    for (const tipo of CONTRATO_TIPOS) {
      const texto = bloquesATextoPlano(documentoDe(tipo).bloques);
      expect(texto, tipo).not.toContain('…………');
      expect(texto, tipo).not.toContain('undefined');
      expect(texto, tipo).not.toContain('[object Object]');
    }
  });

  // Punto 2: el número de cuenta salió del formulario y no puede volver por
  // ninguna plantilla. Se comprueba sobre el texto generado, no sobre el
  // código, porque lo que circula por correo es el texto.
  it('ningún documento contiene campos de cuenta bancaria', () => {
    for (const tipo of CONTRATO_TIPOS) {
      const texto = bloquesATextoPlano(documentoDe(tipo).bloques).toLowerCase();
      expect(texto, tipo).not.toContain('número de cuenta');
      expect(texto, tipo).not.toContain('cuenta bancaria');
      expect(texto, tipo).not.toContain('cuenta corriente');
      expect(texto, tipo).not.toContain('cuenta de ahorros');
    }
    // Y el formulario tampoco lo pregunta.
    for (const tipo of CONTRATO_TIPOS) {
      const claves = CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos.map((c) => c.clave));
      expect(claves, tipo).not.toContain('cuentaBancaria');
    }
  });

  // Punto 2.4: las reservas remiten el respaldo al comprobante.
  it('las reservas remiten el respaldo del pago al comprobante de la transacción', () => {
    for (const tipo of ['RESERVA_COMPRAVENTA', 'RESERVA_ARRIENDO'] as const) {
      const texto = bloquesATextoPlano(documentoDe(tipo).bloques);
      expect(texto, tipo).toContain('comprobante emitido en la respectiva transacción');
      expect(texto, tipo).toContain('parte integrante del presente instrumento');
      expect(texto, tipo).toContain('canal separado');
    }
  });

  // La penalidad se deriva de quién tiene el dinero. Lo que se vigila aquí es
  // que nunca se le pida devolver a alguien que no lo recibió.
  describe('penalidad coherente con el tenedor de la reserva', () => {
    function penalidad(extra: Record<string, string>): string {
      const doc = documentoDe('RESERVA_COMPRAVENTA', extra);
      const clausula = doc.bloques.find((b) => b.tipo === 'clausula' && b.titulo === 'PENALIDAD POR DESISTIMIENTO');
      return clausula && 'texto' in clausula ? clausula.texto : '';
    }

    it('con la reserva en poder de la vendedora, el corredor no mueve dinero', () => {
      for (const comprador of ['SE_PIERDE', 'DEVOLUCION_TOTAL', 'DEVOLUCION_PARCIAL']) {
        for (const vendedor of ['DEVUELVE_DOBLE', 'DEVUELVE_SIMPLE']) {
          const texto = penalidad({
            reservaEntregadaA: 'VENDEDOR',
            siDesisteComprador: comprador,
            siDesisteVendedor: vendedor,
          });
          expect(texto, `${comprador}/${vendedor}`).toContain('en poder de la Parte Vendedora');
          expect(texto, `${comprador}/${vendedor}`).not.toContain('el Corredor devolverá');
          expect(texto, `${comprador}/${vendedor}`).not.toContain('el Corredor lo entregará');
        }
      }
    });

    it('con la reserva en poder del corredor, es el corredor quien entrega o devuelve', () => {
      const sePierde = penalidad({
        reservaEntregadaA: 'CORREDOR',
        siDesisteComprador: 'SE_PIERDE',
        siDesisteVendedor: 'DEVUELVE_DOBLE',
      });
      expect(sePierde).toContain('el Corredor lo entregará a la Parte Vendedora');
      expect(sePierde).toContain('el Corredor devolverá a la Parte Compradora');
      // Y devuelve solo lo que recibió: la indemnización la paga la vendedora.
      expect(sePierde).toContain('la Parte Vendedora le pagará directamente');
      expect(sePierde).toContain('no responde con su patrimonio');
    });

    it('el corredor solo queda como depositario cuando tiene el dinero', () => {
      const conCorredor = penalidad({
        reservaEntregadaA: 'CORREDOR',
        siDesisteComprador: 'SE_PIERDE',
        siDesisteVendedor: 'DEVUELVE_DOBLE',
      });
      const conVendedora = penalidad({
        reservaEntregadaA: 'VENDEDOR',
        siDesisteComprador: 'SE_PIERDE',
        siDesisteVendedor: 'DEVUELVE_DOBLE',
      });
      expect(conCorredor).toContain('simple depositario');
      expect(conVendedora).not.toContain('simple depositario');
    });

    it('si nadie tiene que desembolsar, la cláusula lo dice en vez de fingir una devolución', () => {
      const texto = penalidad({
        reservaEntregadaA: 'VENDEDOR',
        siDesisteComprador: 'SE_PIERDE',
        siDesisteVendedor: 'DEVUELVE_SIMPLE',
      });
      expect(texto).toContain('que ya lo tiene en su poder');
      expect(texto).toContain('sin que deba realizarse desembolso alguno');
    });

    it('la indemnización del doble se imprime como cifra, no como cálculo pendiente', () => {
      const texto = penalidad({
        reservaEntregadaA: 'VENDEDOR',
        siDesisteComprador: 'SE_PIERDE',
        siDesisteVendedor: 'DEVUELVE_DOBLE',
        montoReserva: '9000',
      });
      expect(texto).toContain('USD $9.000,00');
    });

    it('la reserva de arriendo aplica la misma regla con el agente', () => {
      function noConcreta(extra: Record<string, string>): string {
        const doc = documentoDe('RESERVA_ARRIENDO', extra);
        const clausula = doc.bloques.find(
          (b) => b.tipo === 'clausula' && b.titulo === 'SI EL ARRENDAMIENTO NO SE CONCRETA',
        );
        return clausula && 'texto' in clausula ? clausula.texto : '';
      }
      expect(noConcreta({ reservaEntregadaA: 'AGENTE', siNoSeConcreta: 'SE_PIERDE' })).toContain(
        'el Agente lo entregará al arrendador',
      );
      expect(noConcreta({ reservaEntregadaA: 'ARRENDADOR', siNoSeConcreta: 'SE_PIERDE' })).toContain(
        'que ya lo tiene en su poder',
      );
      expect(noConcreta({ reservaEntregadaA: 'AGENTE', siNoSeConcreta: 'DEVOLUCION_TOTAL' })).toContain(
        'el Agente devolverá al Interesado',
      );
      expect(noConcreta({ reservaEntregadaA: 'ARRENDADOR', siNoSeConcreta: 'DEVOLUCION_TOTAL' })).toContain(
        'el arrendador devolverá al Interesado',
      );
    });
  });

  // Punto 1.4 y 1.5: son dos documentos distintos, y cada uno lo dice.
  describe('modalidades de corretaje', () => {
    it('son plantillas distintas, no el mismo texto con un campo cambiado', () => {
      const exclusivo = bloquesATextoPlano(documentoDe('CORRETAJE_EXCLUSIVO').bloques);
      const abierto = bloquesATextoPlano(documentoDe('CORRETAJE_ABIERTO').bloques);
      expect(exclusivo).not.toEqual(abierto);
      expect(plantillaActual('CORRETAJE_EXCLUSIVO')).not.toEqual(plantillaActual('CORRETAJE_ABIERTO'));
    });

    it('la exclusiva declara la exclusividad en el título y en la primera cláusula', () => {
      const doc = documentoDe('CORRETAJE_EXCLUSIVO');
      const titulo = doc.bloques.find((b) => b.tipo === 'titulo');
      expect(titulo && 'texto' in titulo ? titulo.texto : '').toContain('EXCLUSIVO');
      const primera = doc.bloques.find((b) => b.tipo === 'clausula');
      expect(primera && 'titulo' in primera ? primera.titulo : '').toContain('EXCLUSIVA');
      expect(primera && 'texto' in primera ? primera.texto : '').toContain('DE MANERA EXCLUSIVA');
    });

    it('la abierta declara la no exclusividad en el título y en la primera cláusula', () => {
      const doc = documentoDe('CORRETAJE_ABIERTO');
      const titulo = doc.bloques.find((b) => b.tipo === 'titulo');
      expect(titulo && 'texto' in titulo ? titulo.texto : '').toContain('NO EXCLUSIVO');
      const primera = doc.bloques.find((b) => b.tipo === 'clausula');
      expect(primera && 'titulo' in primera ? primera.titulo : '').toContain('ABIERTA');
      expect(primera && 'texto' in primera ? primera.texto : '').toContain('conserva la facultad de encargar');
    });

    it('solo la exclusiva cobra comisión por la operación hecha por fuera', () => {
      const exclusivo = bloquesATextoPlano(documentoDe('CORRETAJE_EXCLUSIVO').bloques);
      const abierto = bloquesATextoPlano(documentoDe('CORRETAJE_ABIERTO').bloques);
      expect(exclusivo).toContain('OPERACIONES CELEBRADAS POR FUERA DE ESTE ENCARGO');
      expect(abierto).not.toContain('OPERACIONES CELEBRADAS POR FUERA DE ESTE ENCARGO');
    });

    it('solo la abierta devenga la comisión por el interesado presentado', () => {
      const abierto = bloquesATextoPlano(documentoDe('CORRETAJE_ABIERTO').bloques);
      const exclusivo = bloquesATextoPlano(documentoDe('CORRETAJE_EXCLUSIVO').bloques);
      expect(abierto).toContain('DEVENGO DE LA COMISIÓN');
      expect(abierto).toContain('REGISTRO DE INTERESADOS PRESENTADOS');
      expect(exclusivo).not.toContain('REGISTRO DE INTERESADOS PRESENTADOS');
    });

    it('el anexo de interesados lista los nombres que el agente escribió', () => {
      const texto = bloquesATextoPlano(
        documentoDe('CORRETAJE_ABIERTO', { interesadosPresentados: 'María Andrade\nJorge Villacís' }).bloques,
      );
      expect(texto).toContain('María Andrade; Jorge Villacís');
    });
  });

  // Punto 5.2: una versión publicada no cambia. Un contrato viejo pide la suya
  // y la recibe, no la actual.
  describe('versionado por tipo', () => {
    it('cada tipo tiene su propia versión actual', () => {
      const versiones = plantillasVigentes().map((p) => p.version);
      expect(new Set(versiones).size).toBe(versiones.length);
    });

    it('un contrato viejo sigue resolviendo la plantilla global v1', () => {
      for (const tipo of ['ARRENDAMIENTO', 'RESERVA_ARRIENDO', 'RESERVA_COMPRAVENTA', 'CORRETAJE'] as const) {
        expect(obtenerPlantilla(tipo, 'v1-2026-09').version, tipo).toBe('v1-2026-09');
      }
    });

    it('una versión desconocida cae a la actual de su tipo en vez de reventar', () => {
      expect(obtenerPlantilla('CORRETAJE_EXCLUSIVO', 'no-existe').version).toBe(
        plantillaActual('CORRETAJE_EXCLUSIVO'),
      );
    });
  });

  // Decisión de producto ratificada: las cláusulas de desistimiento se eligen
  // a mano. Este test existe para que un cambio futuro que les ponga default
  // "para mejorar la usabilidad" falle en CI en vez de pasar inadvertido.
  describe('las cláusulas de desistimiento se eligen conscientemente', () => {
    const SIN_DEFAULT: Array<[ContratoTipo, string]> = [
      ['RESERVA_COMPRAVENTA', 'siDesisteComprador'],
      ['RESERVA_COMPRAVENTA', 'siDesisteVendedor'],
      ['RESERVA_ARRIENDO', 'siNoSeConcreta'],
    ];

    function definicionDe(tipo: ContratoTipo, clave: string) {
      const campo = CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos).find((c) => c.clave === clave);
      expect(campo, `${tipo}.${clave} debe existir`).toBeDefined();
      return campo!;
    }

    it('no tienen valor por defecto y son obligatorias', () => {
      for (const [tipo, clave] of SIN_DEFAULT) {
        const campo = definicionDe(tipo, clave);
        expect(campo.porDefecto, `${tipo}.${clave} no puede traer default`).toBeUndefined();
        expect(campo.obligatorio, `${tipo}.${clave} debe ser obligatorio`).toBe(true);
      }
    });

    it('muestran todas las alternativas con su consecuencia práctica', () => {
      for (const [tipo, clave] of SIN_DEFAULT) {
        const campo = definicionDe(tipo, clave);
        expect(campo.tipo, `${tipo}.${clave} debe verse como tarjetas, no como desplegable`).toBe('opcionExplicada');
        expect(campo.opciones?.length ?? 0).toBeGreaterThan(1);
        for (const opcion of campo.opciones ?? []) {
          expect(opcion.consecuencia, `${tipo}.${clave}/${opcion.valor} sin consecuencia`).toBeTruthy();
          expect((opcion.consecuencia ?? '').length).toBeGreaterThan(40);
        }
      }
    });

    it('un contrato sin elegirlas no se puede enviar a firma', () => {
      for (const [tipo, clave] of SIN_DEFAULT) {
        const datos = { ...datosDe(tipo), [clave]: '' };
        const etiqueta = definicionDe(tipo, clave).etiqueta;
        expect(camposFaltantes(tipo, datos), `${tipo}.${clave}`).toContain(etiqueta);
      }
    });
  });

  // El aviso obligatorio no depende de lo que mande el formulario, y su tono
  // cambia según quién lo lee: enfático para el agente, que decide usar el
  // documento; preciso y neutro para las partes, que lo reciben de él.
  describe('avisos según quién los lee', () => {
    // Palabras que dejan al agente explicando por qué mandó algo dudoso.
    const SUGIEREN_PROVISIONAL = ['referencial', 'se recomienda revisión', 'aún no ha sido validada', 'propuesta'];

    it('lo que ven las PARTES no insinúa que el documento sea provisional', () => {
      for (const texto of [NOTA_PIE_OBLIGATORIA, AVISO_PAGINA_FIRMA]) {
        for (const palabra of SUGIEREN_PROVISIONAL) {
          expect(texto.toLowerCase(), palabra).not.toContain(palabra.toLowerCase());
        }
      }
    });

    it('lo que ven las partes sí conserva el deslinde y el derecho a consultar', () => {
      expect(NOTA_PIE_OBLIGATORIA).toContain('no es parte de este contrato');
      expect(NOTA_PIE_OBLIGATORIA).toContain('modelo contractual de uso habitual');
      expect(AVISO_PAGINA_FIRMA).toContain('consultarlo con un profesional de su confianza');
      expect(AVISO_PAGINA_FIRMA).toContain('solicitar aclaraciones a quien se lo envió');
      expect(AVISO_PAGINA_FIRMA).toContain('no es parte del contrato');
    });

    it('lo que ve el AGENTE sigue siendo explícito', () => {
      expect(AVISO_MODULO_PARRAFOS.join(' ')).toContain('no contemplan las particularidades');
      expect(AVISO_MODULO_PARRAFOS.join(' ')).toContain('Recomendamos que un abogado revise');
      expect(AVISO_MODULO_CASILLA).toContain('referenciales');
      expect(AVISO_VISTA_PREVIA).toContain('revisión por un abogado');
    });

    // Punto 3.3: donde hay un riesgo concreto, el aviso se mantiene para todos.
    it('la advertencia del arrendamiento se mantiene, porque ahí el riesgo es real', () => {
      const texto = bloquesATextoPlano(documentoDe('ARRENDAMIENTO').bloques);
      expect(texto).toContain('normas de orden público');
      expect(texto).toContain('registrar este contrato ante la autoridad competente');
    });
  });
});

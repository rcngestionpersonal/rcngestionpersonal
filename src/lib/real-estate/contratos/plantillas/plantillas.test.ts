import { describe, expect, it } from 'vitest';
import { construirDocumento, prepararDocumento } from '../documento';
import { PENDIENTES_REVISION_LEGAL } from '../revision-legal';
import { obtenerPlantilla, plantillaActual, plantillasVigentes } from './index';
import {
  AVISO_MODULO,
  CONTRATO_DEFINICION,
  CONTRATO_MENU,
  CONTRATO_TIPOS,
  CONTRATO_TIPOS_LEGADO,
  MARCADOR_SIN_COMPLETAR,
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

function entradaDe(tipo: ContratoTipo, extra: Record<string, string> = {}) {
  return {
    tipo,
    version: plantillaActual(tipo),
    datos: { ...datosDe(tipo), ...extra },
    agente: AGENTE,
    inmueble: INMUEBLE,
    fecha: new Date('2026-09-11T12:00:00Z'),
  };
}

function documentoDe(tipo: ContratoTipo, extra: Record<string, string> = {}) {
  return construirDocumento(entradaDe(tipo, extra));
}

function textoDe(tipo: ContratoTipo, extra: Record<string, string> = {}): string {
  return prepararDocumento(entradaDe(tipo, extra)).texto;
}

function clausula(tipo: ContratoTipo, titulo: string, extra: Record<string, string> = {}): string {
  const b = documentoDe(tipo, extra).bloques.find((x) => x.tipo === 'clausula' && x.titulo === titulo);
  return b && 'texto' in b ? b.texto : '';
}

const VIVOS = CONTRATO_MENU.map((e) => e.tipo);

describe('plantillas de contrato', () => {
  it('se generan el corretaje, las dos reservas y los tres arrendamientos', () => {
    expect(VIVOS).toEqual([
      'CORRETAJE',
      'RESERVA_COMPRAVENTA',
      'ARRENDAMIENTO_RESIDENCIAL',
      'ARRENDAMIENTO_COMERCIAL',
      'ARRENDAMIENTO_INDUSTRIAL',
      'RESERVA_ARRIENDO',
    ]);
    for (const tipo of VIVOS) expect(esTipoArchivado(tipo), tipo).toBe(false);
  });

  it('cada tipo genera un documento con cláusulas y bloque de firmas', () => {
    for (const tipo of CONTRATO_TIPOS) {
      const doc = documentoDe(tipo);
      expect(doc.bloques.filter((b) => b.tipo === 'clausula').length, tipo).toBeGreaterThan(4);
      expect(doc.bloques.some((b) => b.tipo === 'titulo'), tipo).toBe(true);
      expect(doc.bloques.some((b) => b.tipo === 'firmas'), tipo).toBe(true);
      expect(textoDe(tipo).length, tipo).toBeGreaterThan(1500);
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

    it('las reservas volvieron (compraventa ya en v4), y una de la primera etapa se sigue reimprimiendo con la v1', () => {
      for (const tipo of ['RESERVA_COMPRAVENTA', 'RESERVA_ARRIENDO'] as const) {
        expect(VIVOS).toContain(tipo);
        expect(esTipoArchivado(tipo), tipo).toBe(false);
        expect(plantillaActual(tipo), tipo).toMatch(tipo === 'RESERVA_COMPRAVENTA' ? /-v4-2026-09$/ : /-v3-2026-09$/);
        expect(obtenerPlantilla(tipo, 'v1-2026-09').version).toBe('v1-2026-09');
      }
      // La v3 de compraventa sigue registrada para los contratos que la usan.
      expect(obtenerPlantilla('RESERVA_COMPRAVENTA', 'reserva-compraventa-v3-2026-09').version).toBe('reserva-compraventa-v3-2026-09');
    });

    it('no se listan como plantillas vigentes del módulo', () => {
      const ofrecidas = plantillasVigentes().filter((p) => !CONTRATO_TIPOS_LEGADO.includes(p.tipo));
      expect(ofrecidas.map((p) => p.tipo).sort()).toEqual([
        'ARRENDAMIENTO_COMERCIAL',
        'ARRENDAMIENTO_INDUSTRIAL',
        'ARRENDAMIENTO_RESIDENCIAL',
        'CORRETAJE',
        'RESERVA_ARRIENDO',
        'RESERVA_COMPRAVENTA',
      ]);
    });
  });

  // Un campo opcional vacío deja una marca visible, no un hueco que pase
  // desapercibido al revisar y termine en el documento firmado.
  it('los campos opcionales vacíos salen marcados, no en blanco', () => {
    const texto = textoDe('CORRETAJE', { propiedadPredio: '', propiedadDireccion: '', propiedadProvincia: '' });
    expect(texto).toContain(MARCADOR_SIN_COMPLETAR);
  });

  describe('corretaje: encargo de venta', () => {
    it('emite las once cláusulas, siempre las mismas', () => {
      for (const exclusividad of ['CON', 'SIN']) {
        const clausulas = documentoDe('CORRETAJE', { exclusividad }).bloques.filter((b) => b.tipo === 'clausula');
        expect(clausulas, exclusividad).toHaveLength(11);
      }
    });

    // Lo que se sacó: la señal es de los contratos de reserva, no del encargo.
    it('no menciona señal, arras, depósito ni desistimiento', () => {
      const texto = textoDe('CORRETAJE').toLowerCase();
      for (const palabra of ['señal', 'arras', 'depósito', 'depositario', 'desistimiento']) {
        expect(texto, palabra).not.toContain(palabra);
      }
      const claves = documentoDe('CORRETAJE').bloques.filter((b) => b.tipo === 'clausula').map((c) => ('clave' in c ? c.clave : ''));
      expect(claves).not.toContain('senal');
      const campos = CONTRATO_DEFINICION.CORRETAJE.secciones.flatMap((x) => x.campos.map((c) => c.clave));
      for (const campo of ['depositoEnPoderDe', 'siDesisteComprador', 'retencionDetalle', 'devolucionPlazoDias']) {
        expect(campos, campo).not.toContain(campo);
      }
    });

    it('no menciona linderos ni los pide en el formulario', () => {
      expect(textoDe('CORRETAJE').toLowerCase()).not.toContain('lindero');
      const campos = CONTRATO_DEFINICION.CORRETAJE.secciones.flatMap((x) => x.campos.map((c) => c.clave));
      expect(campos.filter((c) => c.startsWith('lindero'))).toEqual([]);
    });

    it('dice "número de predio", no catastro, y conserva lo escrito con la clave anterior', () => {
      const texto = textoDe('CORRETAJE', { propiedadPredio: '55-44-33' });
      expect(texto).toContain('Número de predio');
      expect(texto).toContain('55-44-33');
      expect(texto.toLowerCase()).not.toContain('catastro');
      // Un borrador guardado con la clave vieja no pierde el dato.
      expect(textoDe('CORRETAJE', { propiedadPredio: '', propiedadCatastro: '99-88-77' })).toContain('99-88-77');
    });

    it('el inmueble se describe con el texto del agente, completo y sin recortar', () => {
      const descripcion =
        'Casa de tres pisos en la Av. Ficticia N45-67 y calle Inventada, sector norte, con 320 m² de terreno y 280 m² de construcción, 4 dormitorios, 3 baños y medio, 2 parqueaderos cubiertos, bodega y patio posterior.';
      const doc = documentoDe('CORRETAJE', { inmuebleDescripcion: descripcion });
      const inmueble = doc.bloques.find((b) => b.tipo === 'clausula' && 'clave' in b && b.clave === 'inmueble');
      expect(inmueble && 'texto' in inmueble ? inmueble.texto : '').toContain(descripcion);
    });

    it('el formulario pide la descripción con un mínimo razonable y la puede traer del inmueble', () => {
      const campo = CONTRATO_DEFINICION.CORRETAJE.secciones.flatMap((x) => x.campos).find((c) => c.clave === 'inmuebleDescripcion');
      expect(campo?.tipo).toBe('area');
      expect(campo?.obligatorio).toBe(true);
      expect(campo?.minimo).toBe(120);
      expect(campo?.desdeInmueble).toBe(true);
      expect(camposFaltantes('CORRETAJE', { ...datosDe('CORRETAJE'), inmuebleDescripcion: 'Casa bonita.' })).toContain(
        'Descripción del inmueble (al menos 120 caracteres)',
      );
    });

    it('el cierre solo acepta y suscribe', () => {
      const cierre = clausula('CORRETAJE', 'ACEPTACIÓN Y SUSCRIPCIÓN');
      expect(cierre).toContain('han leído íntegramente este contrato');
      expect(cierre).toContain('dos ejemplares de igual valor');
      expect(cierre.toLowerCase()).not.toContain('señal');
      expect(cierre.toLowerCase()).not.toContain('consignación');
    });

    describe('jurisdicción y controversias', () => {
      const conVia = (via: string, extra: Record<string, string> = {}) =>
        clausula('CORRETAJE', 'LEY APLICABLE Y SOLUCIÓN DE CONTROVERSIAS', { controversiasVia: via, ...extra });

      it('por defecto: mediación y, si no hay acuerdo, jueces de la ciudad del inmueble', () => {
        const campo = CONTRATO_DEFINICION.CORRETAJE.secciones.flatMap((x) => x.campos).find((c) => c.clave === 'controversiasVia');
        expect(campo?.porDefecto).toBe('MEDIACION_JUECES');
        const texto = conVia('MEDIACION_JUECES', { propiedadCiudad: 'Quito', jurisdiccionCiudad: 'INMUEBLE', centroMediacion: '' });
        expect(texto).toContain('se someterá a mediación en el Centro de Arbitraje y Mediación de la Cámara de Comercio de Quito, de la ciudad de Quito');
        expect(texto).toContain('se someten a los jueces competentes de Quito');
      });

      it('arbitraje: mediación previa, laudo definitivo y renuncia a la jurisdicción ordinaria', () => {
        const texto = conVia('ARBITRAJE', { propiedadCiudad: 'Manta', jurisdiccionCiudad: 'INMUEBLE', centroMediacion: '' });
        expect(texto).toContain('mediación en el Centro de Arbitraje y Mediación de la Cámara de Comercio de Manta');
        expect(texto).toContain('arbitraje en derecho');
        expect(texto).toContain('definitivo e inapelable');
        expect(texto).toContain('renunciando a fuero y a la jurisdicción ordinaria');
      });

      it('solo jueces: sin mediación ni centro', () => {
        const texto = conVia('JUECES', { propiedadCiudad: 'Cuenca', jurisdiccionCiudad: 'INMUEBLE' });
        expect(texto).toContain('se someten a los jueces competentes de Cuenca');
        expect(texto.toLowerCase()).not.toContain('mediación');
        expect(texto.toLowerCase()).not.toContain('arbitraje');
      });

      it('la ciudad elegida manda sobre la del inmueble, y "Otra" usa lo escrito', () => {
        expect(conVia('JUECES', { propiedadCiudad: 'Quito', jurisdiccionCiudad: 'GUAYAQUIL' })).toContain('jueces competentes de Guayaquil');
        expect(conVia('JUECES', { propiedadCiudad: 'Quito', jurisdiccionCiudad: 'OTRA', jurisdiccionCiudadOtra: 'Loja' })).toContain(
          'jueces competentes de Loja',
        );
      });

      it('el centro que escribe el agente reemplaza al propuesto', () => {
        expect(conVia('ARBITRAJE', { propiedadCiudad: 'Quito', centroMediacion: 'Centro de Mediación de la Función Judicial' })).toContain(
          'Centro de Mediación de la Función Judicial',
        );
      });

      it('el aviso del arbitraje es para la pantalla, no para el documento', () => {
        const campo = CONTRATO_DEFINICION.CORRETAJE.secciones.flatMap((x) => x.campos).find((c) => c.clave === 'controversiasVia');
        const arbitraje = campo?.opciones?.find((o) => o.valor === 'ARBITRAJE');
        expect(arbitraje?.consecuencia).toBe('El arbitraje excluye la vía judicial ordinaria y tiene costos del centro.');
        expect(textoDe('CORRETAJE', { controversiasVia: 'ARBITRAJE' })).not.toContain('costos del centro');
      });

      it('queda anotada en los pendientes legales, no en el PDF', () => {
        const pendiente = PENDIENTES_REVISION_LEGAL.find((p) => p.tipo === 'CORRETAJE' && p.clausula === 'controversias');
        expect(pendiente).toBeDefined();
        expect(pendiente?.plantilla).toBe(plantillaActual('CORRETAJE'));
        expect(textoDe('CORRETAJE').toLowerCase()).not.toContain('revisión del abogado');
      });
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

    it('la información de la propiedad va al final, sin linderos y con el número de predio', () => {
      const doc = documentoDe('CORRETAJE');
      const ficha = doc.bloques.find((b) => b.tipo === 'ficha' && b.titulo === 'INFORMACIÓN DE LA PROPIEDAD');
      expect(ficha).toBeDefined();
      const etiquetas = ficha && 'filas' in ficha ? ficha.filas.map((f) => f.etiqueta) : [];
      expect(etiquetas).toEqual(['Precio de venta', 'Dirección', 'Ciudad', 'Provincia', 'Número de predio']);
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

  // El contrato es del agente y de sus clientes: la plataforma no firma el
  // documento con su marca, ni antes ni después de editarlo.
  describe('sin marca de la plataforma', () => {
    it('ningún documento, vivo o retirado, nombra a Redinmo', () => {
      for (const tipo of CONTRATO_TIPOS) {
        expect(textoDe(tipo).toLowerCase(), tipo).not.toContain('redinmo');
      }
    });

    it('la nota del módulo presenta los modelos como sugerencia y el documento como del agente', () => {
      expect(AVISO_MODULO).toContain('modelos que la plataforma te sugiere');
      expect(AVISO_MODULO).toContain('El documento es tuyo y de tus clientes');
      expect(AVISO_MODULO).toContain('consúltalo con un abogado');
    });

    // Las reservas volvieron con el mismo estado que tenían al retirarse:
    // pendientes de revisión legal, con el aviso arriba del documento.
    const PENDIENTES_DE_REVISION: ContratoTipo[] = ['RESERVA_COMPRAVENTA', 'RESERVA_ARRIENDO'];

    it('las reservas siguen marcadas como pendientes de revisión legal', () => {
      for (const tipo of PENDIENTES_DE_REVISION) {
        const plantilla = obtenerPlantilla(tipo, plantillaActual(tipo));
        expect(plantilla.revisadaPorAbogado, tipo).toBe(false);
        expect(plantilla.avisoSinRevisar, tipo).toContain('PLANTILLA EN REVISIÓN');
      }
    });

    it('ninguna otra plantilla viva se marca como pendiente de revisión legal', () => {
      for (const tipo of VIVOS.filter((t) => !PENDIENTES_DE_REVISION.includes(t))) {
        expect(obtenerPlantilla(tipo, plantillaActual(tipo)).revisadaPorAbogado, tipo).toBe(true);
        expect(documentoDe(tipo).bloques.some((b) => b.tipo === 'aviso'), tipo).toBe(false);
      }
    });
  });

  describe('versionado por tipo', () => {
    it('cada tipo vivo tiene su propia versión actual', () => {
      expect(plantillaActual('CORRETAJE')).toBe('corretaje-v4-2026-09');
      expect(plantillaActual('ARRENDAMIENTO_RESIDENCIAL')).toBe('arrendamiento-residencial-v1-2026-09');
      expect(plantillaActual('ARRENDAMIENTO_COMERCIAL')).toBe('arrendamiento-comercial-v1-2026-09');
      expect(plantillaActual('ARRENDAMIENTO_INDUSTRIAL')).toBe('arrendamiento-industrial-v1-2026-09');
      expect(plantillaActual('RESERVA_COMPRAVENTA')).toBe('reserva-compraventa-v4-2026-09');
      expect(plantillaActual('RESERVA_ARRIENDO')).toBe('reserva-arriendo-v3-2026-09');
      expect(plantillaActual('ARRENDAMIENTO')).toBe('arrendamiento-v3-2026-09');
    });

    it('un contrato viejo sigue resolviendo la versión con la que se firmó', () => {
      // La v2 intermedia se elimino al retirar el tipo: un contrato que la pidiera
      // cae a la v3, que es la unica que quedo en la base.
      expect(obtenerPlantilla('ARRENDAMIENTO', 'arrendamiento-v2-2026-09').version).toBe('arrendamiento-v3-2026-09');
      expect(obtenerPlantilla('CORRETAJE_EXCLUSIVO', 'corretaje-exclusivo-v1-2026-09').version).toBe(
        'corretaje-exclusivo-v1-2026-09',
      );
    });

    it('la v2 del corretaje sigue registrada: nunca se edita ni se borra una versión publicada', () => {
      expect(obtenerPlantilla('CORRETAJE', 'corretaje-v2-2026-09').version).toBe('corretaje-v2-2026-09');
      expect(obtenerPlantilla('CORRETAJE', 'corretaje-v2-2026-09').admiteEdicion).toBe(false);
      expect(obtenerPlantilla('CORRETAJE', 'corretaje-v3-2026-09').admiteEdicion).toBe(true);
      expect(obtenerPlantilla('CORRETAJE', 'corretaje-v4-2026-09').admiteEdicion).toBe(true);
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
      ['RESERVA_COMPRAVENTA', 'siDesisteComprador'],
      ['RESERVA_COMPRAVENTA', 'siDesisteVendedor'],
      ['RESERVA_ARRIENDO', 'siNoSeConcreta'],
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

    it('un contrato sin elegirlas no se puede enviar para aprobación', () => {
      for (const [tipo, clave] of SIN_DEFAULT) {
        const etiqueta = CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos).find((c) => c.clave === clave)!.etiqueta;
        expect(camposFaltantes(tipo, { ...datosDe(tipo), [clave]: '' }), `${tipo}.${clave}`).toContain(etiqueta);
      }
    });
  });
});

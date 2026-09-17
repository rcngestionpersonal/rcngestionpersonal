// Registro de versiones de plantilla, UNA LÍNEA POR TIPO DE DOCUMENTO.
//
// Cada tipo tiene su historia de versiones y su "actual". Para publicar un texto
// nuevo se agrega otro archivo y se lo registra aquí; NUNCA se edita una versión
// ya publicada, porque hay contratos firmados que dependen de ella palabra por
// palabra. Un contrato guarda la versión que usó, y se resuelve por (tipo,
// versión).
//
// Los tipos RETIRADOS siguen registrados con sus versiones antiguas. No se puede
// generar uno nuevo, pero los que existen se abren, se imprimen y se descargan.

import * as v1 from './v1-2026-09';
import * as corretajeExclusivoV1 from './corretaje-exclusivo-v1';
import * as corretajeAbiertoV1 from './corretaje-abierto-v1';
import * as arrendamientoV3 from './arrendamiento-v3';
import * as corretajeV2 from './corretaje-v2';
import * as corretajeV3 from './corretaje-v3';
import type { ContratoTipo } from '../tipos';
import type { EstiloNumeracion } from '../clausulas';
import type { BloqueDocumento, DatosDocumento } from './base';

export type { BloqueDocumento, DatosDocumento };

export type Plantilla = {
  version: string;
  revisadaPorAbogado: boolean;
  avisoSinRevisar: string;
  // Cómo se encabezan sus cláusulas. Las publicadas antes del editor siguen en
  // romanos: así se imprimieron.
  estilo: EstiloNumeracion;
  // Sus cláusulas tienen clave y admiten el editor. Las anteriores no.
  admiteEdicion: boolean;
  construirBloques: (tipo: ContratoTipo, datos: DatosDocumento) => BloqueDocumento[];
};

// Adaptador para las plantillas de un solo documento, que ya no reciben el tipo.
function deUnTipo(
  modulo: {
    PLANTILLA_VERSION: string;
    PLANTILLA_REVISADA_POR_ABOGADO: boolean;
    AVISO_PLANTILLA_SIN_REVISAR: string;
    construirBloques: (d: DatosDocumento) => BloqueDocumento[];
  },
  conEditor = false,
): Plantilla {
  return {
    version: modulo.PLANTILLA_VERSION,
    revisadaPorAbogado: modulo.PLANTILLA_REVISADA_POR_ABOGADO,
    avisoSinRevisar: modulo.AVISO_PLANTILLA_SIN_REVISAR,
    estilo: conEditor ? 'ordinal' : 'romano',
    admiteEdicion: conEditor,
    construirBloques: (_tipo, datos) => modulo.construirBloques(datos),
  };
}

// La v1 global: cubre los cuatro tipos que existían cuando se publicó. Sigue
// registrada porque puede haber contratos que la usen.
const V1_GLOBAL: Plantilla = {
  version: v1.PLANTILLA_VERSION,
  revisadaPorAbogado: v1.PLANTILLA_REVISADA_POR_ABOGADO,
  avisoSinRevisar: v1.AVISO_PLANTILLA_SIN_REVISAR,
  estilo: 'romano',
  admiteEdicion: false,
  construirBloques: v1.construirBloques,
};

type LineaDeVersiones = { actual: string; versiones: Record<string, Plantilla> };

const REGISTRO: Record<ContratoTipo, LineaDeVersiones> = {
  CORRETAJE: {
    actual: corretajeV3.PLANTILLA_VERSION,
    versiones: {
      [v1.PLANTILLA_VERSION]: V1_GLOBAL,
      [corretajeV2.PLANTILLA_VERSION]: deUnTipo(corretajeV2),
      [corretajeV3.PLANTILLA_VERSION]: deUnTipo(corretajeV3, true),
    },
  },
  // --- RETIRADOS: solo lectura, se conservan para reimprimir ---
  // El arrendamiento se retiro el 2026-09-15. Se conserva unicamente la v3, que
  // es la version con la que se genero el contrato que existe en la base; la v2
  // intermedia se elimino porque ningun contrato la usaba.
  ARRENDAMIENTO: {
    actual: arrendamientoV3.PLANTILLA_VERSION,
    versiones: {
      [v1.PLANTILLA_VERSION]: V1_GLOBAL,
      [arrendamientoV3.PLANTILLA_VERSION]: deUnTipo(arrendamientoV3),
    },
  },
  CORRETAJE_EXCLUSIVO: {
    actual: corretajeExclusivoV1.PLANTILLA_VERSION,
    versiones: { [corretajeExclusivoV1.PLANTILLA_VERSION]: deUnTipo(corretajeExclusivoV1) },
  },
  CORRETAJE_ABIERTO: {
    actual: corretajeAbiertoV1.PLANTILLA_VERSION,
    versiones: { [corretajeAbiertoV1.PLANTILLA_VERSION]: deUnTipo(corretajeAbiertoV1) },
  },
  RESERVA_ARRIENDO: {
    actual: v1.PLANTILLA_VERSION,
    versiones: { [v1.PLANTILLA_VERSION]: V1_GLOBAL },
  },
  RESERVA_COMPRAVENTA: {
    actual: v1.PLANTILLA_VERSION,
    versiones: { [v1.PLANTILLA_VERSION]: V1_GLOBAL },
  },
};

export function plantillaActual(tipo: ContratoTipo): string {
  return REGISTRO[tipo].actual;
}

// Un contrato viejo pide su versión; si por lo que sea ya no existe, cae a la
// actual de su tipo antes que romper la descarga de un documento firmado.
export function obtenerPlantilla(tipo: ContratoTipo, version: string): Plantilla {
  const linea = REGISTRO[tipo];
  return linea.versiones[version] ?? linea.versiones[linea.actual];
}

export function versionesDisponibles(tipo: ContratoTipo): string[] {
  return Object.keys(REGISTRO[tipo].versiones);
}

export function plantillasVigentes(): Array<{ tipo: ContratoTipo; version: string; revisada: boolean }> {
  return (Object.keys(REGISTRO) as ContratoTipo[]).map((tipo) => {
    const linea = REGISTRO[tipo];
    return { tipo, version: linea.actual, revisada: linea.versiones[linea.actual].revisadaPorAbogado };
  });
}

// Registro de versiones de plantilla, UNA LÍNEA POR TIPO DE DOCUMENTO.
//
// Antes había una sola versión global que cubría los cuatro tipos. No sirve
// desde que el corretaje tiene dos modalidades: exclusivo y abierto son dos
// documentos distintos y cada uno se corrige, se revisa y se publica a su
// propio ritmo (punto 1.4). Ahora cada tipo tiene su historia de versiones y
// su "actual".
//
// Para publicar un texto nuevo se agrega otro archivo y se lo registra aquí;
// NUNCA se edita una versión ya publicada, porque hay contratos firmados que
// dependen de ella palabra por palabra (punto 5.2). Un contrato guarda la
// versión que usó, y se resuelve por (tipo, versión).

import * as v1 from './v1-2026-09';
import * as corretajeExclusivoV1 from './corretaje-exclusivo-v1';
import * as corretajeAbiertoV1 from './corretaje-abierto-v1';
import * as arrendamientoV2 from './arrendamiento-v2';
import * as reservaArriendoV2 from './reserva-arriendo-v2';
import * as reservaCompraventaV2 from './reserva-compraventa-v2';
import type { ContratoTipo } from '../tipos';
import type { BloqueDocumento, DatosDocumento } from './base';

export type { BloqueDocumento, DatosDocumento };

export type Plantilla = {
  version: string;
  revisadaPorAbogado: boolean;
  avisoSinRevisar: string;
  construirBloques: (tipo: ContratoTipo, datos: DatosDocumento) => BloqueDocumento[];
};

// Adaptador para las plantillas nuevas, que ya no reciben el tipo: cada una
// sirve a un solo documento y no tiene un switch adentro.
function deUnTipo(modulo: {
  PLANTILLA_VERSION: string;
  PLANTILLA_REVISADA_POR_ABOGADO: boolean;
  AVISO_PLANTILLA_SIN_REVISAR: string;
  construirBloques: (d: DatosDocumento) => BloqueDocumento[];
}): Plantilla {
  return {
    version: modulo.PLANTILLA_VERSION,
    revisadaPorAbogado: modulo.PLANTILLA_REVISADA_POR_ABOGADO,
    avisoSinRevisar: modulo.AVISO_PLANTILLA_SIN_REVISAR,
    construirBloques: (_tipo, datos) => modulo.construirBloques(datos),
  };
}

// La v1 global: sigue viva porque hay contratos que la usan. Cubre los cuatro
// tipos que existían cuando se publicó y a ninguno le es la versión actual,
// salvo al CORRETAJE legado, que ya no se puede generar.
const V1_GLOBAL: Plantilla = {
  version: v1.PLANTILLA_VERSION,
  revisadaPorAbogado: v1.PLANTILLA_REVISADA_POR_ABOGADO,
  avisoSinRevisar: v1.AVISO_PLANTILLA_SIN_REVISAR,
  construirBloques: v1.construirBloques,
};

type LineaDeVersiones = { actual: string; versiones: Record<string, Plantilla> };

const REGISTRO: Record<ContratoTipo, LineaDeVersiones> = {
  CORRETAJE: {
    // Legado: no se generan nuevos, pero los existentes se siguen imprimiendo.
    actual: v1.PLANTILLA_VERSION,
    versiones: { [v1.PLANTILLA_VERSION]: V1_GLOBAL },
  },
  CORRETAJE_EXCLUSIVO: {
    actual: corretajeExclusivoV1.PLANTILLA_VERSION,
    versiones: { [corretajeExclusivoV1.PLANTILLA_VERSION]: deUnTipo(corretajeExclusivoV1) },
  },
  CORRETAJE_ABIERTO: {
    actual: corretajeAbiertoV1.PLANTILLA_VERSION,
    versiones: { [corretajeAbiertoV1.PLANTILLA_VERSION]: deUnTipo(corretajeAbiertoV1) },
  },
  ARRENDAMIENTO: {
    actual: arrendamientoV2.PLANTILLA_VERSION,
    versiones: {
      [v1.PLANTILLA_VERSION]: V1_GLOBAL,
      [arrendamientoV2.PLANTILLA_VERSION]: deUnTipo(arrendamientoV2),
    },
  },
  RESERVA_ARRIENDO: {
    actual: reservaArriendoV2.PLANTILLA_VERSION,
    versiones: {
      [v1.PLANTILLA_VERSION]: V1_GLOBAL,
      [reservaArriendoV2.PLANTILLA_VERSION]: deUnTipo(reservaArriendoV2),
    },
  },
  RESERVA_COMPRAVENTA: {
    actual: reservaCompraventaV2.PLANTILLA_VERSION,
    versiones: {
      [v1.PLANTILLA_VERSION]: V1_GLOBAL,
      [reservaCompraventaV2.PLANTILLA_VERSION]: deUnTipo(reservaCompraventaV2),
    },
  },
};

// La versión con la que se generan los contratos nuevos de ese tipo.
export function plantillaActual(tipo: ContratoTipo): string {
  return REGISTRO[tipo].actual;
}

// Un contrato viejo pide su versión; si por lo que sea ya no existe (nunca
// debería pasar, las versiones no se borran), cae a la actual de su tipo antes
// que romper la descarga de un documento firmado.
export function obtenerPlantilla(tipo: ContratoTipo, version: string): Plantilla {
  const linea = REGISTRO[tipo];
  return linea.versiones[version] ?? linea.versiones[linea.actual];
}

export function versionesDisponibles(tipo: ContratoTipo): string[] {
  return Object.keys(REGISTRO[tipo].versiones);
}

// Resumen de las versiones vigentes, para mostrarlo en el módulo del agente.
export function plantillasVigentes(): Array<{ tipo: ContratoTipo; version: string; revisada: boolean }> {
  return (Object.keys(REGISTRO) as ContratoTipo[]).map((tipo) => {
    const linea = REGISTRO[tipo];
    return { tipo, version: linea.actual, revisada: linea.versiones[linea.actual].revisadaPorAbogado };
  });
}

// ¿Alguna de las plantillas que el agente puede generar hoy sigue sin pasar
// revisión legal? Es lo que decide si el módulo muestra el aviso de plantilla
// en revisión.
export function hayPlantillasSinRevisar(): boolean {
  return plantillasVigentes().some((p) => !p.revisada);
}

export const AVISO_PLANTILLA_SIN_REVISAR = v1.AVISO_PLANTILLA_SIN_REVISAR;

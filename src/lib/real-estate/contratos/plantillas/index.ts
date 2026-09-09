// Registro de versiones de plantilla.
//
// Cada contrato guarda la version que uso. Para publicar un texto nuevo se
// agrega otro archivo (v2-...) y se lo registra aca; NUNCA se edita una
// version ya publicada, porque hay contratos firmados que dependen de ella
// palabra por palabra (punto 5.2).

import * as v1 from './v1-2026-09';
import type { ContratoTipo } from '../tipos';
import type { BloqueDocumento, DatosDocumento } from './v1-2026-09';

export type { BloqueDocumento, DatosDocumento };

type Plantilla = {
  version: string;
  revisadaPorAbogado: boolean;
  avisoSinRevisar: string;
  construirBloques: (tipo: ContratoTipo, datos: DatosDocumento) => BloqueDocumento[];
};

const VERSIONES: Record<string, Plantilla> = {
  [v1.PLANTILLA_VERSION]: {
    version: v1.PLANTILLA_VERSION,
    revisadaPorAbogado: v1.PLANTILLA_REVISADA_POR_ABOGADO,
    avisoSinRevisar: v1.AVISO_PLANTILLA_SIN_REVISAR,
    construirBloques: v1.construirBloques,
  },
};

// La version con la que se generan los contratos nuevos.
export const PLANTILLA_ACTUAL = v1.PLANTILLA_VERSION;

// Un contrato viejo pide su version; si por lo que sea ya no existe (nunca
// deberia pasar, las versiones no se borran), cae a la actual antes que
// romper la descarga de un documento firmado.
export function obtenerPlantilla(version: string): Plantilla {
  return VERSIONES[version] ?? VERSIONES[PLANTILLA_ACTUAL];
}

export function versionesDisponibles(): string[] {
  return Object.keys(VERSIONES);
}

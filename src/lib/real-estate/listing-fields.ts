// Fuente unica de verdad de los campos condicionales por tipo de inmueble
// (Fase 8, Bloque A). La usan el formulario de Inmuebles, el formulario de
// Pedidos (mismos campos, pero opcionales/"al menos") y la ficha del
// inmueble para saber que mostrar. Ninguna de estas opciones pondera ni
// filtra el matching todavia - eso es el Bloque B (src/lib/real-estate/matching.ts
// sigue intacto).
import { ANTIGUEDAD_OPTIONS } from './closed-deals-config';

export { ANTIGUEDAD_OPTIONS };

export type OptionDef = { value: string; labelEs: string; labelEn: string };

export const AMOBLADO_OPTIONS: OptionDef[] = [
  { value: 'SI', labelEs: 'Amoblado', labelEn: 'Furnished' },
  { value: 'NO', labelEs: 'Sin amoblar', labelEn: 'Unfurnished' },
  { value: 'SEMI', labelEs: 'Semiamoblado', labelEn: 'Semi-furnished' },
];

export const SERVICIOS_OPTIONS: OptionDef[] = [
  { value: 'TODOS', labelEs: 'Todos los servicios', labelEn: 'All utilities' },
  { value: 'PARCIALES', labelEs: 'Servicios parciales', labelEn: 'Partial utilities' },
  { value: 'NINGUNO', labelEs: 'Sin servicios', labelEn: 'No utilities' },
];

export const USO_SUELO_TERRENO_OPTIONS: OptionDef[] = [
  { value: 'RESIDENCIAL_URBANO', labelEs: 'Residencial urbano', labelEn: 'Urban residential' },
  { value: 'RURAL', labelEs: 'Rural', labelEn: 'Rural' },
  { value: 'COMERCIAL', labelEs: 'Comercial', labelEn: 'Commercial' },
  { value: 'INDUSTRIAL', labelEs: 'Industrial', labelEn: 'Industrial' },
  { value: 'AGRICOLA', labelEs: 'Agrícola', labelEn: 'Agricultural' },
];

export const NIVEL_LOCAL_OPTIONS: OptionDef[] = [
  { value: 'PLANTA_BAJA', labelEs: 'Planta baja', labelEn: 'Ground floor' },
  { value: 'MEZZANINE', labelEs: 'Mezzanine', labelEn: 'Mezzanine' },
  { value: 'PISO_SUPERIOR', labelEs: 'Piso superior', labelEn: 'Upper floor' },
];

export const DISTRIBUCION_LOCAL_OPTIONS: OptionDef[] = [
  { value: 'UNA_PLANTA', labelEs: 'Una planta', labelEn: 'Single floor' },
  { value: 'DUPLEX', labelEs: 'Dúplex', labelEn: 'Duplex' },
];

export const ESTADO_OCUPACION_OPTIONS: OptionDef[] = [
  { value: 'VACIO', labelEs: 'Vacío', labelEn: 'Vacant' },
  { value: 'ARRENDADO', labelEs: 'Arrendado', labelEn: 'Leased' },
];

export const ESQUINERO_MEDIANERO_OPTIONS: OptionDef[] = [
  { value: 'ESQUINERO', labelEs: 'Esquinero', labelEn: 'Corner lot' },
  { value: 'MEDIANERO', labelEs: 'Medianero', labelEn: 'Mid-block lot' },
];

export type PropertyTypeValue = 'HOUSE' | 'APARTMENT' | 'SUITE' | 'OFFICE' | 'LAND' | 'COMMERCIAL' | 'WAREHOUSE' | 'FARM' | 'OTHER';
export type OperationTypeValue = 'SALE' | 'RENT' | 'BOTH';

// Que campos aplican para un tipo+operacion - el agente nunca ve un campo que
// no le sirve (seccion 2). FARM/OTHER no tienen taxonomia propia todavia:
// se tratan como el set minimo (metraje) para no bloquear su carga.
export type ListingFieldFlags = {
  areaM2Label: { es: string; en: string };
  showDormitorios: boolean;
  showBanos: boolean;
  showParqueos: boolean;
  showAntiguedad: boolean;
  showEsIndependienteCasa: boolean;
  showEsIndependienteLocal: boolean;
  showAlicuota: boolean;
  showAmoblado: boolean;
  showTerrenoCasa: boolean;
  showPiso: boolean;
  showAscensor: boolean;
  showAreasComunales: boolean;
  showEsquineroMedianero: boolean;
  showUsoSueloTerreno: boolean;
  showPisosPermitidos: boolean;
  showServiciosBasicos: boolean;
  showFrenteM: boolean;
  showNivelLocal: boolean;
  showDistribucionLocal: boolean;
  showEstadoOcupacion: boolean;
  showAlturaLibreM: boolean;
  showAccesoCamion: boolean;
};

export function listingFieldsFor(propertyType: string, operationType: OperationTypeValue): ListingFieldFlags {
  const isRentPossible = operationType !== 'SALE';
  const base: ListingFieldFlags = {
    areaM2Label: { es: 'Metraje (m²)', en: 'Area (m²)' },
    showDormitorios: false,
    showBanos: false,
    showParqueos: false,
    showAntiguedad: false,
    showEsIndependienteCasa: false,
    showEsIndependienteLocal: false,
    showAlicuota: false,
    showAmoblado: false,
    showTerrenoCasa: false,
    showPiso: false,
    showAscensor: false,
    showAreasComunales: false,
    showEsquineroMedianero: false,
    showUsoSueloTerreno: false,
    showPisosPermitidos: false,
    showServiciosBasicos: false,
    showFrenteM: false,
    showNivelLocal: false,
    showDistribucionLocal: false,
    showEstadoOcupacion: false,
    showAlturaLibreM: false,
    showAccesoCamion: false,
  };

  switch (propertyType) {
    case 'HOUSE':
      return {
        ...base,
        areaM2Label: { es: 'Construcción (m²)', en: 'Built area (m²)' },
        showDormitorios: true,
        showBanos: true,
        showParqueos: true,
        showAntiguedad: true,
        showEsIndependienteCasa: true,
        showAlicuota: true, // solo relevante si esIndependiente=false (conjunto), ver UI
        showAmoblado: isRentPossible,
        showTerrenoCasa: true,
      };
    case 'APARTMENT':
    case 'SUITE':
      return {
        ...base,
        areaM2Label: { es: 'Metraje habitable (m²)', en: 'Livable area (m²)' },
        showDormitorios: true,
        showBanos: true,
        showParqueos: true,
        showAntiguedad: true,
        showPiso: true,
        showAscensor: true,
        showAreasComunales: true,
        showAlicuota: true,
        showAmoblado: isRentPossible,
      };
    case 'LAND':
      return {
        ...base,
        areaM2Label: { es: 'Superficie (m²)', en: 'Surface (m²)' },
        showEsquineroMedianero: true,
        showUsoSueloTerreno: true,
        showPisosPermitidos: true,
        showServiciosBasicos: true,
        showFrenteM: true,
      };
    case 'COMMERCIAL':
      return {
        ...base,
        areaM2Label: { es: 'Metraje (m²)', en: 'Area (m²)' },
        showEsIndependienteLocal: true,
        showNivelLocal: true,
        showDistribucionLocal: true,
        showEstadoOcupacion: true,
        showAntiguedad: true,
        showBanos: true,
        showParqueos: true,
      };
    case 'OFFICE':
      return {
        ...base,
        areaM2Label: { es: 'Metraje (m²)', en: 'Area (m²)' },
        showAmoblado: true,
        showBanos: true,
        showParqueos: true,
        showAntiguedad: true,
        showPiso: true,
        showAscensor: true,
        showEstadoOcupacion: true,
      };
    case 'WAREHOUSE':
      return {
        ...base,
        areaM2Label: { es: 'Metraje (m²)', en: 'Area (m²)' },
        showAlturaLibreM: true,
        showAccesoCamion: true,
        showServiciosBasicos: true,
        showAntiguedad: true,
      };
    default:
      // FARM/OTHER: sin taxonomia propia en esta fase - solo el metraje general.
      return base;
  }
}

// Etiqueta derivada (seccion 2.1): NUNCA se calcula restando construccion del
// terreno total (una casa de 180m2 construidos puede pisar solo 90m2 en dos
// plantas) - se muestra como confirmacion si CUALQUIERA de las tres areas
// libres declaradas supera 250m2, nunca como campo a llenar.
export function hasAreaVerdeAmplia(input: {
  terrenoTotalM2?: number | null;
  areaLibrePropiaM2?: number | null;
  terrenoLibreExclusivoM2?: number | null;
}): boolean {
  const values = [input.terrenoTotalM2, input.areaLibrePropiaM2, input.terrenoLibreExclusivoM2];
  return values.some((v) => typeof v === 'number' && v > 250);
}

// Ficha con datos incompletos (seccion 5.2): un inmueble "completo" tiene al
// menos su area principal y, cuando el tipo lo pide, dormitorios/banos -
// heuristica simple a proposito, no un requisito estricto (todo sigue siendo
// opcional para no contradecir la seccion 1).
export function isListingDetailIncomplete(
  listing: { areaM2?: number | null; bedrooms?: number | null; bathrooms?: number | null },
  propertyType: string,
  operationType: OperationTypeValue,
): boolean {
  const flags = listingFieldsFor(propertyType, operationType);
  if (!listing.areaM2) return true;
  if (flags.showDormitorios && !listing.bedrooms) return true;
  if (flags.showBanos && !listing.bathrooms) return true;
  return false;
}

// Arma las filas de datos duros de la ficha (Fase 2, seccion 3.2) a partir de
// listing-fields.ts, la fuente unica de verdad de que campo aplica a cada
// tipo de inmueble (Fase 8, Bloque A). Reutiliza los mismos catalogos de
// opciones (ANTIGUEDAD_OPTIONS, AMOBLADO_OPTIONS, etc.) y las mismas
// etiquetas ES/EN de UI_STRINGS que ya usa el formulario de Inmuebles, para
// que la ficha nunca diverja del resto de la app.
import {
  AMOBLADO_OPTIONS,
  ANTIGUEDAD_OPTIONS,
  DISTRIBUCION_LOCAL_OPTIONS,
  ESQUINERO_MEDIANERO_OPTIONS,
  ESTADO_OCUPACION_OPTIONS,
  NIVEL_LOCAL_OPTIONS,
  SERVICIOS_OPTIONS,
  USO_SUELO_TERRENO_OPTIONS,
  hasAreaVerdeAmplia,
  listingFieldsFor,
  type OperationTypeValue,
  type OptionDef,
} from '@/lib/real-estate/listing-fields';
import { UI_STRINGS, type Language } from '@/lib/i18n/dictionary';

export type FichaIconKey =
  | 'area'
  | 'bed'
  | 'bath'
  | 'halfBath'
  | 'parking'
  | 'age'
  | 'floor'
  | 'elevator'
  | 'commonAreas'
  | 'furnished'
  | 'extraSpaces'
  | 'balcony'
  | 'landUse'
  | 'frontage'
  | 'level'
  | 'layout'
  | 'occupancy'
  | 'ceiling'
  | 'truck'
  | 'corner'
  | 'greenArea'
  | 'independent'
  | 'fee';

export type FichaFieldRow = { icon: FichaIconKey; value: string; caption: string };

// Subconjunto de Listing que la ficha puede leer: excluye a proposito
// ownerName/ownerPhone/address (Fase 2, seccion 4 - privacidad) a nivel de
// tipo, no solo en runtime, para que sea imposible que un futuro campo de la
// ficha termine leyendolos por accidente.
export type FichaListingFields = {
  propertyType: string;
  operationType: OperationTypeValue;
  areaM2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  mediosBanos?: number | null;
  parkingSpaces?: number | null;
  espaciosAdicionales?: number | null;
  antiguedad?: string | null;
  esIndependiente?: boolean | null;
  amoblado?: string | null;
  alicuotaMensual?: number | null;
  piso?: number | null;
  tieneAscensor?: boolean | null;
  areasComunales?: boolean | null;
  esquineroOMedianero?: string | null;
  usoSueloTerreno?: string | null;
  pisosPermitidos?: number | null;
  serviciosBasicos?: string | null;
  frenteM?: number | null;
  nivelLocal?: string | null;
  distribucionLocal?: string | null;
  estadoOcupacion?: string | null;
  canonMensualActual?: number | null;
  alturaLibreM?: number | null;
  accesoCamion?: boolean | null;
  terrenoTotalM2?: number | null;
  areaLibrePropiaM2?: number | null;
  terrenoLibreExclusivoM2?: number | null;
  balconOTerraza?: boolean | null;
};

function label(key: string, lang: Language): string {
  return UI_STRINGS[lang][key] ?? key;
}

function optionLabel(options: OptionDef[], value: string | null | undefined, lang: Language): string | null {
  if (!value) return null;
  const found = options.find((o) => o.value === value);
  if (!found) return null;
  return lang === 'es' ? found.labelEs : found.labelEn;
}

function num(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function money(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return `$${v.toLocaleString('en-US')}`;
}

// Franja principal (seccion 3.2): m2, dormitorios, espacios adicionales,
// banos completos, medios banos, parqueos y antiguedad - SOLO los que
// apliquen segun el tipo de inmueble.
export function fichaPrimaryRows(listing: FichaListingFields, lang: Language): FichaFieldRow[] {
  const flags = listingFieldsFor(listing.propertyType, listing.operationType);
  const rows: FichaFieldRow[] = [];

  if (listing.areaM2) {
    rows.push({ icon: 'area', value: `${listing.areaM2} m²`, caption: lang === 'es' ? flags.areaM2Label.es : flags.areaM2Label.en });
  }
  if (flags.showDormitorios && listing.bedrooms) {
    rows.push({ icon: 'bed', value: num(listing.bedrooms)!, caption: label('inmuebles.form.dormitorios', lang) });
  }
  if (flags.showEspaciosYMediosBanos && listing.espaciosAdicionales) {
    rows.push({ icon: 'extraSpaces', value: num(listing.espaciosAdicionales)!, caption: label('inmuebles.form.espaciosAdicionales', lang) });
  }
  if (flags.showBanos && listing.bathrooms) {
    rows.push({ icon: 'bath', value: num(listing.bathrooms)!, caption: label('inmuebles.form.banos', lang) });
  }
  if (flags.showEspaciosYMediosBanos && listing.mediosBanos) {
    rows.push({ icon: 'halfBath', value: num(listing.mediosBanos)!, caption: label('inmuebles.form.mediosBanos', lang) });
  }
  if (flags.showParqueos && listing.parkingSpaces) {
    rows.push({ icon: 'parking', value: num(listing.parkingSpaces)!, caption: label('inmuebles.form.parqueos', lang) });
  }
  if (flags.showAntiguedad && listing.antiguedad) {
    const opt = optionLabel([...ANTIGUEDAD_OPTIONS], listing.antiguedad, lang);
    if (opt) rows.push({ icon: 'age', value: opt, caption: label('inmuebles.form.antiguedad', lang) });
  }

  return rows;
}

// Chips secundarios: el resto de campos condicionales por tipo (informativos,
// nunca ponderan el matching - ver listing-fields.ts). Se omiten en silencio
// los que el agente no cargo, igual que en el formulario.
export function fichaExtraChips(listing: FichaListingFields, lang: Language): FichaFieldRow[] {
  const flags = listingFieldsFor(listing.propertyType, listing.operationType);
  const chips: FichaFieldRow[] = [];

  if (flags.showEsIndependienteCasa || flags.showEsIndependienteLocal) {
    if (listing.esIndependiente === true) {
      chips.push({ icon: 'independent', value: lang === 'es' ? 'Independiente' : 'Standalone', caption: '' });
    } else if (listing.esIndependiente === false) {
      chips.push({ icon: 'independent', value: lang === 'es' ? 'En conjunto' : 'In a complex', caption: '' });
    }
  }
  if (flags.showAmoblado && listing.amoblado) {
    const opt = optionLabel([...AMOBLADO_OPTIONS], listing.amoblado, lang);
    if (opt) chips.push({ icon: 'furnished', value: opt, caption: '' });
  }
  if (flags.showPiso && listing.piso) {
    chips.push({ icon: 'floor', value: `${lang === 'es' ? 'Piso' : 'Floor'} ${listing.piso}`, caption: '' });
  }
  if (flags.showAscensor && listing.tieneAscensor === true) {
    chips.push({ icon: 'elevator', value: label('inmuebles.form.ascensor', lang), caption: '' });
  }
  if (flags.showAreasComunales && listing.areasComunales === true) {
    chips.push({ icon: 'commonAreas', value: label('inmuebles.form.areasComunales', lang), caption: '' });
  }
  if (flags.showAlicuota && listing.alicuotaMensual) {
    chips.push({ icon: 'fee', value: `${money(listing.alicuotaMensual)}/${lang === 'es' ? 'mes' : 'mo'}`, caption: '' });
  }
  if (flags.showEsquineroMedianero && listing.esquineroOMedianero) {
    const opt = optionLabel([...ESQUINERO_MEDIANERO_OPTIONS], listing.esquineroOMedianero, lang);
    if (opt) chips.push({ icon: 'corner', value: opt, caption: '' });
  }
  if (flags.showUsoSueloTerreno && listing.usoSueloTerreno) {
    const opt = optionLabel([...USO_SUELO_TERRENO_OPTIONS], listing.usoSueloTerreno, lang);
    if (opt) chips.push({ icon: 'landUse', value: opt, caption: '' });
  }
  if (flags.showPisosPermitidos && listing.pisosPermitidos) {
    chips.push({ icon: 'level', value: `${listing.pisosPermitidos} ${lang === 'es' ? 'pisos permitidos' : 'buildable floors'}`, caption: '' });
  }
  if (flags.showServiciosBasicos && listing.serviciosBasicos) {
    const opt = optionLabel([...SERVICIOS_OPTIONS], listing.serviciosBasicos, lang);
    if (opt) chips.push({ icon: 'commonAreas', value: opt, caption: '' });
  }
  if (flags.showFrenteM && listing.frenteM) {
    chips.push({ icon: 'frontage', value: `${listing.frenteM} m ${lang === 'es' ? 'de frente' : 'frontage'}`, caption: '' });
  }
  if (flags.showNivelLocal && listing.nivelLocal) {
    const opt = optionLabel([...NIVEL_LOCAL_OPTIONS], listing.nivelLocal, lang);
    if (opt) chips.push({ icon: 'level', value: opt, caption: '' });
  }
  if (flags.showDistribucionLocal && listing.distribucionLocal) {
    const opt = optionLabel([...DISTRIBUCION_LOCAL_OPTIONS], listing.distribucionLocal, lang);
    if (opt) chips.push({ icon: 'layout', value: opt, caption: '' });
  }
  if (flags.showEstadoOcupacion && listing.estadoOcupacion) {
    const opt = optionLabel([...ESTADO_OCUPACION_OPTIONS], listing.estadoOcupacion, lang);
    if (opt) chips.push({ icon: 'occupancy', value: opt, caption: '' });
  }
  if (flags.showAlturaLibreM && listing.alturaLibreM) {
    chips.push({ icon: 'ceiling', value: `${listing.alturaLibreM} m ${lang === 'es' ? 'altura libre' : 'clear height'}`, caption: '' });
  }
  if (flags.showAccesoCamion && listing.accesoCamion === true) {
    chips.push({ icon: 'truck', value: label('inmuebles.form.accesoCamion', lang), caption: '' });
  }
  if (flags.showEspaciosYMediosBanos && listing.balconOTerraza === true) {
    chips.push({ icon: 'balcony', value: label('inmuebles.form.balconOTerraza', lang), caption: '' });
  }
  if (
    flags.showTerrenoCasa &&
    hasAreaVerdeAmplia({
      terrenoTotalM2: listing.terrenoTotalM2,
      areaLibrePropiaM2: listing.areaLibrePropiaM2,
      terrenoLibreExclusivoM2: listing.terrenoLibreExclusivoM2,
    })
  ) {
    chips.push({ icon: 'greenArea', value: label('inmuebles.form.areaVerdeAmplia', lang), caption: '' });
  }

  return chips;
}

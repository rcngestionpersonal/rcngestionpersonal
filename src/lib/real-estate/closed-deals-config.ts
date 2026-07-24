// Constantes y helpers puros (sin Prisma) del Mapa de Precios de Cierre, compartidos
// entre el formulario de registro, la API y la vista de consulta.

export const CLOSED_DEAL_PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'SUITE', 'LAND', 'COMMERCIAL', 'OFFICE', 'WAREHOUSE', 'FARM'] as const;
export type ClosedDealPropertyType = (typeof CLOSED_DEAL_PROPERTY_TYPES)[number];

export const ANTIGUEDAD_OPTIONS = [
  { value: 'A_ESTRENAR', labelEs: 'A estrenar', labelEn: 'Brand new' },
  { value: 'UNO_A_CINCO', labelEs: '1-5 años', labelEn: '1-5 years' },
  { value: 'SEIS_A_QUINCE', labelEs: '6-15 años', labelEn: '6-15 years' },
  { value: 'DIECISEIS_A_TREINTA', labelEs: '16-30 años', labelEn: '16-30 years' },
  { value: 'MAS_TREINTA', labelEs: '+30 años', labelEn: '30+ years' },
] as const;

export const ESTADO_OPTIONS = [
  { value: 'EXCELENTE', labelEs: 'Excelente', labelEn: 'Excellent' },
  { value: 'BUENO', labelEs: 'Bueno', labelEn: 'Good' },
  { value: 'PARA_REMODELAR', labelEs: 'Para remodelar', labelEn: 'Needs remodeling' },
  { value: 'OBRA_GRIS', labelEs: 'Obra gris', labelEn: 'Unfinished/shell' },
] as const;

export const USO_SUELO_OPTIONS = [
  { value: 'RESIDENCIAL', labelEs: 'Residencial', labelEn: 'Residential' },
  { value: 'COMERCIAL', labelEs: 'Comercial', labelEn: 'Commercial' },
  { value: 'AGRICOLA', labelEs: 'Agrícola', labelEn: 'Agricultural' },
  { value: 'MIXTO', labelEs: 'Mixto', labelEn: 'Mixed' },
] as const;

export const UBICACION_COMERCIAL_OPTIONS = [
  { value: 'CENTRO_COMERCIAL_EDIFICIO', labelEs: 'Centro comercial / edificio corporativo', labelEn: 'Mall / corporate building' },
  { value: 'CALLE', labelEs: 'A la calle', labelEn: 'Street-facing' },
] as const;

export const TIEMPO_MERCADO_OPTIONS = [
  { value: 'MENOS_1', labelEs: 'Menos de 1 mes', labelEn: 'Less than 1 month' },
  { value: 'UNO_A_TRES', labelEs: '1-3 meses', labelEn: '1-3 months' },
  { value: 'TRES_A_SEIS', labelEs: '3-6 meses', labelEn: '3-6 months' },
  { value: 'SEIS_A_DOCE', labelEs: '6-12 meses', labelEn: '6-12 months' },
  { value: 'MAS_DOCE', labelEs: '+12 meses', labelEn: '12+ months' },
] as const;

export const FORMA_PAGO_OPTIONS = [
  { value: 'CONTADO', labelEs: 'Contado', labelEn: 'Cash' },
  { value: 'CREDITO', labelEs: 'Crédito hipotecario', labelEn: 'Mortgage loan' },
  { value: 'MIXTO', labelEs: 'Mixto (entrada + crédito)', labelEn: 'Mixed (down payment + loan)' },
  { value: 'OTRO', labelEs: 'Otro', labelEn: 'Other' },
] as const;

export const ENTIDAD_FINANCIERA_OPTIONS = [
  'BIESS',
  'Banco Pichincha',
  'Banco Pacífico',
  'Produbanco',
  'Banco Guayaquil',
  'Banco Bolivariano',
  'Banco Internacional',
  'Mutualista Pichincha',
  'Cooperativa',
  'Otra',
];

// Terreno no tiene "antiguedad" ni "estado del inmueble" en el sentido convencional
// (construccion), asi que estos campos dejan de ser obligatorios para ese tipo.
export function requiresAntiguedadYEstado(propertyType: string): boolean {
  return propertyType !== 'LAND';
}

// Privacidad por diseno: redondea lat/lng a 3 decimales (~110m) antes de guardar, para
// que ningun cierre sea rastreable a una direccion/casa especifica.
export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// Color de pin por tipo de inmueble (paleta del design system), visible en la leyenda
// del mapa de cierres.
export const PROPERTY_PIN_COLORS: Record<string, string> = {
  HOUSE: '#2dd4bf',
  APARTMENT: '#818cf8',
  SUITE: '#818cf8',
  LAND: '#f59e0b',
  COMMERCIAL: '#fb7185',
  OFFICE: '#fb7185',
  WAREHOUSE: '#fb7185',
  FARM: '#84cc16',
};

export function pinColorFor(propertyType: string): string {
  return PROPERTY_PIN_COLORS[propertyType] ?? '#94a3b8';
}

export type ClosedDealDetails = {
  esIndependiente?: boolean;
  plantas?: number;
  alicuotaMensual?: number;
  piso?: number;
  tieneAscensor?: boolean;
  tieneBodega?: boolean;
  urbanizadoConServicios?: boolean;
  usoSuelo?: string;
  frenteM?: number;
  esEsquinero?: boolean;
  ubicacionComercial?: string;
};

export type ClosedDealValidationInput = {
  propertyType: string;
  price: number;
  publicationPrice?: number;
  areaM2?: number;
  landAreaM2?: number;
  closedAt: string;
  details?: ClosedDealDetails;
};

export type ClosedDealValidationResult = {
  errors: Record<string, string>;
  warnings: string[];
};

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

// Validaciones "anti-datos basura": bloqueantes (errors) y no bloqueantes (warnings).
export function validateClosedDeal(input: ClosedDealValidationInput): ClosedDealValidationResult {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  if (!(input.price > 0 && input.price < 10_000_000)) {
    errors.price = 'El precio de cierre debe ser mayor a 0 y menor a 10,000,000.';
  }
  if (input.areaM2 !== undefined && !(input.areaM2 > 10 && input.areaM2 < 100_000)) {
    errors.areaM2 = 'El metraje debe estar entre 10 y 100,000 m².';
  }
  if (input.landAreaM2 !== undefined && !(input.landAreaM2 > 10 && input.landAreaM2 < 100_000)) {
    errors.landAreaM2 = 'El terreno debe estar entre 10 y 100,000 m².';
  }

  const closedDate = new Date(input.closedAt);
  const now = new Date();
  if (Number.isNaN(closedDate.getTime())) {
    errors.closedAt = 'Fecha de cierre inválida.';
  } else {
    if (closedDate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
      errors.closedAt = 'La fecha de cierre no puede ser futura.';
    } else if (now.getTime() - closedDate.getTime() > 5 * MS_PER_YEAR) {
      errors.closedAt = 'La fecha de cierre no puede ser mayor a 5 años atrás.';
    }
  }

  const isHouseSinglePlanta =
    input.propertyType === 'HOUSE' && input.details?.esIndependiente && input.details?.plantas === 1;
  if (isHouseSinglePlanta && input.areaM2 !== undefined && input.landAreaM2 !== undefined && input.areaM2 > input.landAreaM2) {
    errors.areaM2 = 'En una casa independiente de 1 planta, la construcción no puede superar el terreno.';
  }

  if (input.publicationPrice && input.publicationPrice > 0 && input.price > input.publicationPrice * 1.2) {
    warnings.push('¿Seguro? Es inusual cerrar por encima del precio publicado.');
  }

  return { errors, warnings };
}

// $/m2: casa independiente y terreno usan superficie de terreno como base;
// el resto (departamento, suite, casa en conjunto, local/oficina/bodega, quinta)
// usa el metraje construido/habitable principal.
export function pricePerM2(deal: {
  propertyType: string;
  price: number;
  areaM2?: number | null;
  landAreaM2?: number | null;
  details?: ClosedDealDetails | null;
}): number | null {
  if (deal.propertyType === 'LAND') {
    return deal.landAreaM2 ? deal.price / deal.landAreaM2 : null;
  }
  return deal.areaM2 ? deal.price / deal.areaM2 : null;
}

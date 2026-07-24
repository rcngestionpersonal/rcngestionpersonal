// Etiquetas en espanol para texto generado en el servidor (resumenes de pedidos, etc.).
// Independiente del diccionario de UI (src/lib/i18n), que es para el cliente.

const PROPERTY_TYPE_LABEL_ES: Record<string, string> = {
  HOUSE: 'casa',
  APARTMENT: 'departamento',
  SUITE: 'suite',
  OFFICE: 'oficina',
  LAND: 'terreno',
  COMMERCIAL: 'local comercial',
  WAREHOUSE: 'bodega/galpón',
  FARM: 'quinta/hacienda',
  OTHER: 'inmueble',
};

export function propertyTypeLabelEs(value: string): string {
  return PROPERTY_TYPE_LABEL_ES[value] ?? value.toLowerCase();
}

export function operationActionLabelEs(value: 'SALE' | 'RENT' | 'BOTH' | string): string {
  if (value === 'RENT') return 'alquilar';
  if (value === 'SALE') return 'comprar';
  return 'comprar o alquilar';
}

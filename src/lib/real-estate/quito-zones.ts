// Config editable de zonas/sectores de Quito para el Mapa de Precios de Cierre.
// Vive separado de los componentes para poder sumar barrios sin tocar codigo de UI.

export type ZoneBounds = { south: number; west: number; north: number; east: number };

export type QuitoZone = {
  key: string;
  labelEs: string;
  labelEn: string;
  sectors: string[];
  // Centroide aproximado (para el pin de cierres legacy sin coordenadas) y bounding box
  // (para la geocerca simple del mini-mapa selector y el zoom del panel de zonas).
  centroid: [number, number];
  bounds: ZoneBounds;
};

export const QUITO_ZONES: QuitoZone[] = [
  {
    key: 'NORTE',
    labelEs: 'Norte',
    labelEn: 'North',
    sectors: ['El Condado', 'Ponceano', 'Carcelén', 'Cotocollao', 'La Florida'],
    centroid: [-0.1230, -78.4890],
    bounds: { south: -0.1550, west: -78.5150, north: -0.0950, east: -78.4600 },
  },
  {
    key: 'CENTRO_NORTE',
    labelEs: 'Centro-Norte',
    labelEn: 'Central-North',
    sectors: [
      'La Carolina',
      'República del Salvador',
      'González Suárez',
      'La Floresta',
      'Bellavista',
      'Iñaquito',
      'Quito Tenis',
      'El Batán',
      'Monteserrín',
      'Jipijapa',
    ],
    centroid: [-0.1807, -78.4837],
    bounds: { south: -0.2050, west: -78.5050, north: -0.1550, east: -78.4650 },
  },
  {
    key: 'CENTRO_HISTORICO',
    labelEs: 'Centro Histórico',
    labelEn: 'Historic Center',
    sectors: ['San Juan', 'La Tola', 'San Marcos', 'García Moreno'],
    centroid: [-0.2201, -78.5123],
    bounds: { south: -0.2400, west: -78.5300, north: -0.2050, east: -78.4950 },
  },
  {
    key: 'SUR',
    labelEs: 'Sur',
    labelEn: 'South',
    sectors: ['Quitumbe', 'Solanda', 'Chillogallo', 'La Villaflora', 'El Recreo', 'San Bartolo'],
    centroid: [-0.2950, -78.5470],
    bounds: { south: -0.3600, west: -78.5800, north: -0.2400, east: -78.4950 },
  },
  {
    key: 'CUMBAYA_TUMBACO',
    labelEs: 'Cumbayá-Tumbaco',
    labelEn: 'Cumbayá-Tumbaco',
    sectors: ['Cumbayá centro', 'La Primavera', 'Lumbisí', 'Tumbaco centro', 'Puembo', 'Pifo'],
    centroid: [-0.2000, -78.4330],
    bounds: { south: -0.2450, west: -78.4700, north: -0.1600, east: -78.3400 },
  },
  {
    key: 'VALLE_CHILLOS',
    labelEs: 'Valle de los Chillos',
    labelEn: 'Los Chillos Valley',
    sectors: ['San Rafael', 'Sangolquí', 'Conocoto', 'La Armenia', 'Capelo'],
    centroid: [-0.3270, -78.4460],
    bounds: { south: -0.3800, west: -78.4900, north: -0.2750, east: -78.4000 },
  },
  {
    key: 'CALDERON_CARAPUNGO',
    labelEs: 'Calderón-Carapungo',
    labelEn: 'Calderón-Carapungo',
    sectors: ['Calderón centro', 'Carapungo', 'Marianas'],
    centroid: [-0.0700, -78.4350],
    bounds: { south: -0.1100, west: -78.4750, north: -0.0250, east: -78.3900 },
  },
  {
    key: 'POMASQUI_SAN_ANTONIO',
    labelEs: 'Pomasqui-San Antonio',
    labelEn: 'Pomasqui-San Antonio',
    sectors: ['Pomasqui', 'San Antonio de Pichincha', 'Mitad del Mundo'],
    centroid: [-0.0180, -78.4500],
    bounds: { south: -0.0500, west: -78.4850, north: 0.0150, east: -78.4100 },
  },
  {
    key: 'PERIFERIA_RURAL',
    labelEs: 'Periferia rural',
    labelEn: 'Rural outskirts',
    sectors: [],
    centroid: [-0.1900, -78.4900],
    bounds: { south: -0.5000, west: -78.6500, north: 0.1500, east: -78.2500 },
  },
];

export function zoneLabel(key: string, lang: 'es' | 'en'): string {
  const zone = QUITO_ZONES.find((z) => z.key === key);
  if (!zone) return key;
  return lang === 'es' ? zone.labelEs : zone.labelEn;
}

export function sectorsForZone(key: string): string[] {
  return QUITO_ZONES.find((z) => z.key === key)?.sectors ?? [];
}

export function zoneCentroid(key: string): [number, number] | null {
  return QUITO_ZONES.find((z) => z.key === key)?.centroid ?? null;
}

// Geocerca simple por bounding box: sugiere una zona a partir de un pin en el mapa,
// dejando al agente corregir manualmente. PERIFERIA_RURAL se prueba al final por ser
// la caja mas amplia (catch-all fuera de las otras 8 zonas).
export function zoneForCoordinates(lat: number, lng: number): string | null {
  const ordered = [...QUITO_ZONES].sort((a, b) => (a.key === 'PERIFERIA_RURAL' ? 1 : b.key === 'PERIFERIA_RURAL' ? -1 : 0));
  for (const zone of ordered) {
    const b = zone.bounds;
    if (lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east) return zone.key;
  }
  return null;
}

export const MIN_SAMPLE_SIZE = 3;

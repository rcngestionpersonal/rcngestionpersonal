const ZONE_COLOR_PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#78716c',
  '#64748b',
  '#a3a3a3',
];

export function buildZoneColorMap(zoneNames: string[]): Map<string, string> {
  const sorted = [...new Set(zoneNames)].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, string>();
  sorted.forEach((zone, index) => {
    map.set(zone, ZONE_COLOR_PALETTE[index % ZONE_COLOR_PALETTE.length]);
  });
  return map;
}

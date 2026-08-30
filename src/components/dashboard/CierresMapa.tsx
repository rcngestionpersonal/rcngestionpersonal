'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { LocateFixed } from 'lucide-react';
import {
  ANTIGUEDAD_OPTIONS,
  ESTADO_OPTIONS,
  FORMA_PAGO_OPTIONS,
  TIEMPO_MERCADO_OPTIONS,
  pinColorFor,
  pricePerM2,
} from '@/lib/real-estate/closed-deals-config';
import { QUITO_ZONES, zoneLabel, type ZoneBounds } from '@/lib/real-estate/quito-zones';
import { DARK_TILE_FILTER, tileLayerConfig } from '@/lib/real-estate/map-tiles';
import { useDarkTheme } from './useDarkTheme';
import type { ClosedDealItem } from './types';

// Los bundlers rompen las rutas por defecto de los iconos de Leaflet; se resuelven via CDN.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const QUITO_CENTER: [number, number] = [-0.19, -78.49];
const QUITO_ZOOM = 11;
const RECENT_MS = 60 * 24 * 60 * 60 * 1000;

export type MapFilters = {
  propertyType?: string;
  sector?: string;
  paymentMethod?: string;
  priceMin?: number;
  priceMax?: number;
  ppm2Min?: number;
  ppm2Max?: number;
  dateFrom?: string;
  dateTo?: string;
  antiguedad?: string;
};

type MapDeal = ClosedDealItem & { estimatedLocation?: boolean };

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// Glifo monolínea (18x18, centrado en 9,9) por tipo de inmueble - mismo lenguaje
// visual que los iconos lucide del resto del dashboard, para que el pin del mapa
// se lea de un vistazo (casa, edificio, bodega...) en vez de ser un punto ciego.
function propertyGlyph(propertyType: string): string {
  const s = 'fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  switch (propertyType) {
    case 'HOUSE':
      return `<path d="M3 9.5 9 4l6 5.5" ${s}/><path d="M4.5 8v6.5h9V8" ${s}/><path d="M7.5 14.5v-4h3v4" ${s}/>`;
    case 'APARTMENT':
    case 'SUITE':
      return `<rect x="5" y="2.5" width="8" height="13" rx="0.8" ${s}/><path d="M7 5.5h.01M11 5.5h.01M7 8.5h.01M11 8.5h.01M7 11.5h.01M11 11.5h.01" ${s}/>`;
    case 'OFFICE':
      return `<rect x="3" y="7" width="12" height="8" rx="0.8" ${s}/><path d="M6.5 7V5.3c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3V7" ${s}/>`;
    case 'COMMERCIAL':
      return `<path d="M3 6.5 4 3h10l1 3.5" ${s}/><path d="M3.5 6.5v8h11v-8" ${s}/><path d="M7.3 14.5V10h3.4v4.5" ${s}/>`;
    case 'WAREHOUSE':
      return `<path d="M2.5 8 9 3.5 15.5 8" ${s}/><rect x="3.5" y="8" width="11" height="6.5" ${s}/><path d="M6 14.5V11h2.5v3.5" ${s}/>`;
    case 'LAND':
      return `<path d="M9 2.5 15.5 6v6L9 15.5 2.5 12V6z" ${s}/><path d="M9 2.5v13M2.5 6l6.5 3.5M15.5 6 9 9.5" ${s}/>`;
    case 'FARM':
      return `<path d="M9 15V8" ${s}/><path d="M9 8c0-2.5-2-4-4.5-4C4.8 6.7 6.5 8.7 9 8Z" ${s}/><path d="M9 10c0-2.2 1.8-3.5 4-3.5-.2 2.4-1.8 4.1-4 3.5Z" ${s}/>`;
    default:
      return `<circle cx="9" cy="9" r="3" ${s}/>`;
  }
}

function coloredDivIcon(color: string, propertyType: string, recent: boolean): L.DivIcon {
  const halo = recent
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid #34d399;animation:pulseHalo 1.8s ease-out infinite;"></div>`
    : '';
  // Pin "gota" clasico (36x44) con el glifo del tipo de inmueble centrado en el
  // circulo superior - mismo lenguaje visual que un mapa de puntos de interes.
  const svg = `
    <svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.35))">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 11.3 14.3 22.6 16.3 24.1a1.1 1.1 0 0 0 1.4 0C19.7 39.6 34 28.3 34 17 34 7.6 26.4 0 17 0Z" fill="${color}" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>
      <g transform="translate(8,3)">${propertyGlyph(propertyType)}</g>
    </svg>`;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:34px;height:42px;">${halo}${svg}</div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38],
  });
}

function metrajeRow(deal: MapDeal, lang: 'es' | 'en'): string | null {
  const isLand = deal.propertyType === 'LAND';
  const value = isLand ? deal.landAreaM2 : deal.areaM2;
  if (!value) return null;
  const label = isLand ? (lang === 'es' ? 'Superficie' : 'Surface') : lang === 'es' ? 'Metraje' : 'Area';
  return `<div class="cm-row"><span>${label}</span><span>${value} m²</span></div>`;
}

function buildPopupHtml(
  deal: MapDeal,
  lang: 'es' | 'en',
  tProperty: (v: string) => string,
): string {
  const ppm2 = pricePerM2({ propertyType: deal.propertyType, price: deal.price, areaM2: deal.areaM2, landAreaM2: deal.landAreaM2 });
  const isRecent = Date.now() - new Date(deal.closedAt).getTime() < RECENT_MS;
  const gapPct = deal.publicationPrice && deal.publicationPrice > 0 ? ((deal.price - deal.publicationPrice) / deal.publicationPrice) * 100 : null;
  const antiguedadLabel = ANTIGUEDAD_OPTIONS.find((o) => o.value === deal.antiguedad);
  const estadoLabel = ESTADO_OPTIONS.find((o) => o.value === deal.estadoInmueble);
  const pagoLabel = FORMA_PAGO_OPTIONS.find((o) => o.value === deal.paymentMethod);
  const tiempoLabel = TIEMPO_MERCADO_OPTIONS.find((o) => o.value === deal.timeOnMarket);
  const sector = deal.sector ? escapeHtml(deal.sector) : zoneLabel(deal.zone ?? '', lang);
  const fechaCierre = new Date(deal.closedAt).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { month: 'short', year: 'numeric' });

  const rows: string[] = [];
  const bedbath: string[] = [];
  if (deal.bedrooms) bedbath.push(`${deal.bedrooms} ${lang === 'es' ? 'hab.' : 'bed.'}`);
  if (deal.bathrooms) bedbath.push(`${deal.bathrooms} ${lang === 'es' ? 'baños' : 'bath.'}`);
  if (bedbath.length > 0) rows.push(`<div class="cm-row"><span>${lang === 'es' ? 'Habitaciones/baños' : 'Bed/bath'}</span><span>${bedbath.join(' · ')}</span></div>`);
  const metraje = metrajeRow(deal, lang);
  if (metraje) rows.push(metraje);
  if (antiguedadLabel) rows.push(`<div class="cm-row"><span>${lang === 'es' ? 'Antigüedad' : 'Age'}</span><span>${lang === 'es' ? antiguedadLabel.labelEs : antiguedadLabel.labelEn}</span></div>`);
  if (estadoLabel) rows.push(`<div class="cm-row"><span>${lang === 'es' ? 'Estado' : 'Condition'}</span><span>${lang === 'es' ? estadoLabel.labelEs : estadoLabel.labelEn}</span></div>`);
  if (pagoLabel) {
    const entity = deal.financialEntity ? ` (${escapeHtml(deal.financialEntity)})` : '';
    rows.push(`<div class="cm-row"><span>${lang === 'es' ? 'Forma de pago' : 'Payment'}</span><span>${lang === 'es' ? pagoLabel.labelEs : pagoLabel.labelEn}${entity}</span></div>`);
  }
  if (tiempoLabel) rows.push(`<div class="cm-row"><span>${lang === 'es' ? 'Tiempo en mercado' : 'Time on market'}</span><span>${lang === 'es' ? tiempoLabel.labelEs : tiempoLabel.labelEn}</span></div>`);

  return `
    <div class="cm-popup">
      <div class="cm-head">
        <span>${escapeHtml(tProperty(deal.propertyType))} · ${sector}</span>
        ${isRecent ? `<span class="cm-badge cm-badge-recent">${lang === 'es' ? 'Reciente' : 'Recent'}</span>` : ''}
      </div>
      ${deal.estimatedLocation ? `<span class="cm-badge cm-badge-est">${lang === 'es' ? 'Ubicación estimada' : 'Estimated location'}</span>` : ''}
      <div class="cm-price">${fmtUsd(deal.price)}${ppm2 ? ` <span class="cm-ppm2">· ${fmtUsd(ppm2)}/m²</span>` : ''}</div>
      ${
        deal.publicationPrice
          ? `<div class="cm-pub">${fmtUsd(deal.publicationPrice)} <span style="text-decoration:line-through">→</span> ${gapPct !== null ? `${gapPct > 0 ? '+' : ''}${gapPct.toFixed(1)}%` : ''}</div>`
          : ''
      }
      ${rows.join('')}
      <div class="cm-row cm-foot"><span>${lang === 'es' ? 'Cerrado' : 'Closed'}</span><span>${fechaCierre}</span></div>
    </div>
  `;
}

function unionBounds(boundsList: ZoneBounds[]): ZoneBounds | null {
  if (boundsList.length === 0) return null;
  return boundsList.reduce((acc, b) => ({
    south: Math.min(acc.south, b.south),
    west: Math.min(acc.west, b.west),
    north: Math.max(acc.north, b.north),
    east: Math.max(acc.east, b.east),
  }));
}

export default function CierresMapa({
  filters,
  focusZoneKey,
  lang,
  tProperty,
  onCountChange,
  myZones,
  pendingFocus,
  onFocusHandled,
}: {
  filters: MapFilters;
  focusZoneKey?: string | null;
  lang: 'es' | 'en';
  tProperty: (v: string) => string;
  onCountChange?: (count: number) => void;
  myZones?: string[];
  pendingFocus?: { lat: number; lng: number } | null;
  onFocusHandled?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const [deals, setDeals] = useState<MapDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const isDark = useDarkTheme();

  async function fetchViewport() {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('south', String(b.getSouth()));
      params.set('west', String(b.getWest()));
      params.set('north', String(b.getNorth()));
      params.set('east', String(b.getEast()));
      params.set('limit', '500');
      if (filtersRef.current.propertyType) params.set('propertyType', filtersRef.current.propertyType);
      const res = await fetch(`/api/real-estate/closed-deals?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      setDeals((data?.deals ?? []) as MapDeal[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(QUITO_CENTER, QUITO_ZOOM);
    const tiles = tileLayerConfig();
    tileLayerRef.current = L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 19 }).addTo(map);

    const cluster = L.markerClusterGroup({ maxClusterRadius: 55, spiderfyOnMaxZoom: true });
    cluster.addTo(map);
    clusterRef.current = cluster;
    mapRef.current = map;

    map.on('moveend', fetchViewport);
    fetchViewport();

    return () => {
      map.off('moveend', fetchViewport);
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.propertyType]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pane = map.getPane('tilePane');
    if (pane) pane.style.filter = isDark ? DARK_TILE_FILTER : '';
  }, [isDark]);

  // Al registrar un cierre nuevo, el padre pide centrar y acercar el mapa a su pin
  // (seccion 4.4 del pedido) - moveend ya esta conectado a fetchViewport, asi que
  // flyTo por si solo refresca los pins visibles al terminar la animacion.
  useEffect(() => {
    if (!pendingFocus) return;
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([pendingFocus.lat, pendingFocus.lng], Math.max(map.getZoom(), 15), { duration: 1.1 });
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocus]);

  function locateToMyZones() {
    const map = mapRef.current;
    if (!map) return;
    const zoneBounds = (myZones ?? [])
      .map((key) => QUITO_ZONES.find((z) => z.key === key)?.bounds)
      .filter((b): b is ZoneBounds => Boolean(b));
    const bounds = unionBounds(zoneBounds);
    if (!bounds) {
      map.setView(QUITO_CENTER, QUITO_ZOOM);
      return;
    }
    map.fitBounds(
      [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ],
      { maxZoom: 14 },
    );
  }

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') return false;
      const ppm2 = pricePerM2({ propertyType: d.propertyType, price: d.price, areaM2: d.areaM2, landAreaM2: d.landAreaM2 });
      if (filters.sector && d.sector !== filters.sector) return false;
      if (filters.paymentMethod && d.paymentMethod !== filters.paymentMethod) return false;
      if (filters.antiguedad && d.antiguedad !== filters.antiguedad) return false;
      if (filters.priceMin !== undefined && d.price < filters.priceMin) return false;
      if (filters.priceMax !== undefined && d.price > filters.priceMax) return false;
      if (filters.ppm2Min !== undefined && (!ppm2 || ppm2 < filters.ppm2Min)) return false;
      if (filters.ppm2Max !== undefined && (!ppm2 || ppm2 > filters.ppm2Max)) return false;
      if (filters.dateFrom && d.closedAt.slice(0, 10) < filters.dateFrom) return false;
      if (filters.dateTo && d.closedAt.slice(0, 10) > filters.dateTo) return false;
      return true;
    });
  }, [deals, filters]);

  useEffect(() => {
    onCountChange?.(filteredDeals.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDeals.length]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    const recentMs = RECENT_MS;
    for (const deal of filteredDeals) {
      const marker = L.marker([deal.latitude as number, deal.longitude as number], {
        icon: coloredDivIcon(pinColorFor(deal.propertyType), deal.propertyType, Date.now() - new Date(deal.closedAt).getTime() < recentMs),
      });
      marker.bindPopup(buildPopupHtml(deal, lang, tProperty), { maxWidth: 260 });
      cluster.addLayer(marker);
    }
  }, [filteredDeals, lang, tProperty]);

  useEffect(() => {
    if (!focusZoneKey) return;
    const map = mapRef.current;
    const zone = QUITO_ZONES.find((z) => z.key === focusZoneKey);
    if (!map || !zone) return;
    const b = zone.bounds;
    map.fitBounds(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { maxZoom: 14 },
    );
  }, [focusZoneKey]);

  return (
    <div className="relative">
      <style>{`
        @keyframes pulseHalo { 0% { opacity: 0.9; transform: scale(0.8); } 100% { opacity: 0; transform: scale(1.6); } }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: var(--surface); color: var(--text); }
        .cm-popup { font-family: inherit; min-width: 190px; }
        .cm-head { display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color: var(--text-2); }
        .cm-badge { display:inline-block; border-radius:9999px; padding:1px 7px; font-size:9px; font-weight:700; margin-top:3px; }
        .cm-badge-recent { background:#d1fae5; color:#047857; }
        .cm-badge-est { background:#fef3c7; color:#92400e; }
        .cm-price { font-size:18px; font-weight:800; color: var(--text); margin-top:4px; }
        .cm-ppm2 { font-size:12px; font-weight:600; color: var(--text-2); }
        .cm-pub { font-size:11px; color: var(--text-3); margin-top:1px; }
        .cm-row { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:11.5px; color: var(--text-2); margin-top:3px; }
        .cm-row span:first-child { color: var(--text-3); }
        .cm-foot { border-top:1px solid var(--line); margin-top:6px; padding-top:5px; }
      `}</style>
      <div ref={containerRef} className="h-[420px] w-full rounded-2xl sm:h-[560px]" />

      <button
        type="button"
        onClick={locateToMyZones}
        aria-label={lang === 'es' ? 'Centrar en mi zona' : 'Center on my area'}
        title={lang === 'es' ? 'Centrar en mi zona' : 'Center on my area'}
        className="absolute left-3 top-3 z-[500] flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface/95 text-text-2 shadow-md transition-colors duration-150 hover:text-brand"
      >
        <LocateFixed className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </button>

      {loading ? (
        <div className="pointer-events-none absolute left-3 top-16 rounded-full border border-line-strong bg-bg/90 px-3 py-1 text-[11px] font-semibold text-text-2">
          …
        </div>
      ) : null}

      {!loading && filteredDeals.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-bg/75 p-6 text-center backdrop-blur-sm">
          <p className="max-w-sm text-sm text-text-2">{lang === 'es' ? 'No hay cierres visibles con estos filtros en esta zona del mapa.' : 'No closings visible with these filters in this map area.'}</p>
        </div>
      ) : null}
    </div>
  );
}

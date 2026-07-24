'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import {
  ANTIGUEDAD_OPTIONS,
  ESTADO_OPTIONS,
  FORMA_PAGO_OPTIONS,
  TIEMPO_MERCADO_OPTIONS,
  pinColorFor,
  pricePerM2,
} from '@/lib/real-estate/closed-deals-config';
import { QUITO_ZONES, zoneLabel } from '@/lib/real-estate/quito-zones';
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

function coloredDivIcon(color: string, recent: boolean): L.DivIcon {
  const halo = recent
    ? `<div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid #34d399;animation:pulseHalo 1.8s ease-out infinite;"></div>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:16px;height:16px;">${halo}<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.9);box-shadow:0 0 4px rgba(0,0,0,0.5);"></div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
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

export default function CierresMapa({
  filters,
  focusZoneKey,
  lang,
  tProperty,
  onCountChange,
}: {
  filters: MapFilters;
  focusZoneKey?: string | null;
  lang: 'es' | 'en';
  tProperty: (v: string) => string;
  onCountChange?: (count: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const [deals, setDeals] = useState<MapDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

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
        icon: coloredDivIcon(pinColorFor(deal.propertyType), Date.now() - new Date(deal.closedAt).getTime() < recentMs),
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
        .cm-popup { font-family: inherit; min-width: 190px; }
        .cm-head { display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#334155; }
        .cm-badge { display:inline-block; border-radius:9999px; padding:1px 7px; font-size:9px; font-weight:700; margin-top:3px; }
        .cm-badge-recent { background:#d1fae5; color:#047857; }
        .cm-badge-est { background:#fef3c7; color:#92400e; }
        .cm-price { font-size:18px; font-weight:800; color:#0f172a; margin-top:4px; }
        .cm-ppm2 { font-size:12px; font-weight:600; color:#475569; }
        .cm-pub { font-size:11px; color:#64748b; margin-top:1px; }
        .cm-row { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:11.5px; color:#334155; margin-top:3px; }
        .cm-row span:first-child { color:#94a3b8; }
        .cm-foot { border-top:1px solid #e2e8f0; margin-top:6px; padding-top:5px; }
      `}</style>
      <div ref={containerRef} className="h-[420px] w-full rounded-2xl sm:h-[560px]" />

      {loading ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/15 bg-[#0b0d14]/90 px-3 py-1 text-[11px] font-semibold text-white/60">
          …
        </div>
      ) : null}

      {!loading && filteredDeals.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#0b0d14]/75 p-6 text-center backdrop-blur-sm">
          <p className="max-w-sm text-sm text-white/70">{lang === 'es' ? 'No hay cierres visibles con estos filtros en esta zona del mapa.' : 'No closings visible with these filters in this map area.'}</p>
        </div>
      ) : null}
    </div>
  );
}

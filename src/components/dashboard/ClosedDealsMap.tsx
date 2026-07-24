'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Los bundlers rompen las rutas por defecto de los iconos de Leaflet; se resuelven via CDN.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER: [number, number] = [-0.1807, -78.4678]; // Quito

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  popupHtml: string;
  color?: string;
};

function coloredDivIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,0.9);box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export default function ClosedDealsMap({
  points,
  pickable,
  pickedPosition,
  onPick,
}: {
  points: MapPoint[];
  pickable?: boolean;
  pickedPosition?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      onPickRef.current?.(event.latlng.lat, event.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = points.map((point) => {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: point.color ? coloredDivIcon(point.color) : undefined,
      }).addTo(map);
      marker.bindPopup(point.popupHtml);
      return marker;
    });

    if (points.length > 0 && !pickable) {
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
    }
  }, [points, pickable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pickMarkerRef.current) {
      pickMarkerRef.current.remove();
      pickMarkerRef.current = null;
    }

    if (pickedPosition) {
      pickMarkerRef.current = L.marker([pickedPosition.lat, pickedPosition.lng], {
        opacity: 0.9,
      }).addTo(map);
      map.setView([pickedPosition.lat, pickedPosition.lng], Math.max(map.getZoom(), 13));
    }
  }, [pickedPosition]);

  return (
    <div
      ref={containerRef}
      className={`h-64 w-full rounded-2xl sm:h-80 ${pickable ? 'cursor-crosshair' : ''}`}
    />
  );
}

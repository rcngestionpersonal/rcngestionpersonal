// Set de iconos de linea para la ficha (Fase 2, seccion 3.2). satori no
// ejecuta components de lucide-react tal cual: internamente usan
// useContext() para resolver sus props por defecto, y satori llama a los
// function components sin el dispatcher de hooks de React montado (no es
// react-dom) - eso revienta con "Cannot read properties of null (reading
// 'useContext')". La salida es la misma data de trazos (paths) que usa
// lucide, tomada de sus fuentes (ISC license) pero envuelta en componentes
// planos sin hooks, seguros para satori.
import type { ReactNode } from 'react';

type IconNode = { tag: 'path' | 'circle' | 'rect'; attrs: Record<string, string> };

function renderNode(node: IconNode, key: number): ReactNode {
  if (node.tag === 'circle') {
    return <circle key={key} cx={node.attrs.cx} cy={node.attrs.cy} r={node.attrs.r} />;
  }
  if (node.tag === 'rect') {
    return <rect key={key} width={node.attrs.width} height={node.attrs.height} x={node.attrs.x} y={node.attrs.y} rx={node.attrs.rx} />;
  }
  return <path key={key} d={node.attrs.d} />;
}

export type FichaIconProps = { size?: number; color?: string; strokeWidth?: number };

function makeIcon(nodes: IconNode[]) {
  return function FichaIcon({ size = 24, color = 'currentColor', strokeWidth = 1.8 }: FichaIconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {nodes.map((n, i) => renderNode(n, i))}
      </svg>
    );
  };
}

export const IconArea = makeIcon([
  { tag: 'path', attrs: { d: 'M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z' } },
  { tag: 'path', attrs: { d: 'm14.5 12.5 2-2' } },
  { tag: 'path', attrs: { d: 'm11.5 9.5 2-2' } },
  { tag: 'path', attrs: { d: 'm8.5 6.5 2-2' } },
  { tag: 'path', attrs: { d: 'm17.5 15.5 2-2' } },
]);

export const IconBed = makeIcon([
  { tag: 'path', attrs: { d: 'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8' } },
  { tag: 'path', attrs: { d: 'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4' } },
  { tag: 'path', attrs: { d: 'M12 4v6' } },
  { tag: 'path', attrs: { d: 'M2 18h20' } },
]);

export const IconBath = makeIcon([
  { tag: 'path', attrs: { d: 'M10 4 8 6' } },
  { tag: 'path', attrs: { d: 'M17 19v2' } },
  { tag: 'path', attrs: { d: 'M2 12h20' } },
  { tag: 'path', attrs: { d: 'M7 19v2' } },
  { tag: 'path', attrs: { d: 'M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5' } },
]);

export const IconParking = makeIcon([
  {
    tag: 'path',
    attrs: {
      d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2',
    },
  },
  { tag: 'circle', attrs: { cx: '7', cy: '17', r: '2' } },
  { tag: 'path', attrs: { d: 'M9 17h6' } },
  { tag: 'circle', attrs: { cx: '17', cy: '17', r: '2' } },
]);

export const IconAge = makeIcon([
  { tag: 'path', attrs: { d: 'M8 2v4' } },
  { tag: 'path', attrs: { d: 'M16 2v4' } },
  { tag: 'rect', attrs: { width: '18', height: '18', x: '3', y: '4', rx: '2' } },
  { tag: 'path', attrs: { d: 'M3 10h18' } },
]);

export const IconFurnished = makeIcon([
  { tag: 'path', attrs: { d: 'M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3' } },
  {
    tag: 'path',
    attrs: {
      d: 'M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z',
    },
  },
  { tag: 'path', attrs: { d: 'M5 18v2' } },
  { tag: 'path', attrs: { d: 'M19 18v2' } },
]);

export const IconElevator = makeIcon([
  { tag: 'path', attrs: { d: 'm21 16-4 4-4-4' } },
  { tag: 'path', attrs: { d: 'M17 20V4' } },
  { tag: 'path', attrs: { d: 'm3 8 4-4 4 4' } },
  { tag: 'path', attrs: { d: 'M7 4v16' } },
]);

export const IconGreenArea = makeIcon([
  { tag: 'path', attrs: { d: 'M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z' } },
  { tag: 'path', attrs: { d: 'M7 16v6' } },
  { tag: 'path', attrs: { d: 'M13 19v3' } },
  { tag: 'path', attrs: { d: 'M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5' } },
]);

export const IconBalcony = makeIcon([
  { tag: 'circle', attrs: { cx: '12', cy: '12', r: '4' } },
  { tag: 'path', attrs: { d: 'M12 2v2' } },
  { tag: 'path', attrs: { d: 'M12 20v2' } },
  { tag: 'path', attrs: { d: 'm4.93 4.93 1.41 1.41' } },
  { tag: 'path', attrs: { d: 'm17.66 17.66 1.41 1.41' } },
  { tag: 'path', attrs: { d: 'M2 12h2' } },
  { tag: 'path', attrs: { d: 'M20 12h2' } },
  { tag: 'path', attrs: { d: 'm6.34 17.66-1.41 1.41' } },
  { tag: 'path', attrs: { d: 'm19.07 4.93-1.41 1.41' } },
]);

export const IconLandUse = makeIcon([
  {
    tag: 'path',
    attrs: {
      d: 'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z',
    },
  },
  { tag: 'path', attrs: { d: 'M15 5.764v15' } },
  { tag: 'path', attrs: { d: 'M9 3.236v15' } },
]);

export const IconLevel = makeIcon([
  { tag: 'path', attrs: { d: 'M10 12h4' } },
  { tag: 'path', attrs: { d: 'M10 8h4' } },
  { tag: 'path', attrs: { d: 'M14 21v-3a2 2 0 0 0-4 0v3' } },
  { tag: 'path', attrs: { d: 'M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2' } },
  { tag: 'path', attrs: { d: 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16' } },
]);

export const IconOccupancy = makeIcon([
  { tag: 'path', attrs: { d: 'm15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4' } },
  { tag: 'path', attrs: { d: 'm21 2-9.6 9.6' } },
  { tag: 'circle', attrs: { cx: '7.5', cy: '15.5', r: '5.5' } },
]);

export const IconCeiling = makeIcon([
  { tag: 'path', attrs: { d: 'm5 12 7-7 7 7' } },
  { tag: 'path', attrs: { d: 'M12 19V5' } },
]);

export const IconTruck = makeIcon([
  { tag: 'path', attrs: { d: 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2' } },
  { tag: 'path', attrs: { d: 'M15 18H9' } },
  { tag: 'path', attrs: { d: 'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14' } },
  { tag: 'circle', attrs: { cx: '17', cy: '18', r: '2' } },
  { tag: 'circle', attrs: { cx: '7', cy: '18', r: '2' } },
]);

export const IconCorner = makeIcon([
  { tag: 'path', attrs: { d: 'm15 10 5 5-5 5' } },
  { tag: 'path', attrs: { d: 'M4 4v7a4 4 0 0 0 4 4h12' } },
]);

export const IconExtraSpaces = makeIcon([
  { tag: 'rect', attrs: { width: '18', height: '18', x: '3', y: '3', rx: '2' } },
  { tag: 'path', attrs: { d: 'M8 12h8' } },
  { tag: 'path', attrs: { d: 'M12 8v8' } },
]);

export const IconFee = makeIcon([
  {
    tag: 'path',
    attrs: {
      d: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1',
    },
  },
  { tag: 'path', attrs: { d: 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4' } },
]);

export const IconIndependent = makeIcon([
  { tag: 'path', attrs: { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' } },
  {
    tag: 'path',
    attrs: {
      d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    },
  },
]);

export const IconWarehouse = makeIcon([
  { tag: 'path', attrs: { d: 'M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11' } },
  {
    tag: 'path',
    attrs: {
      d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z',
    },
  },
  { tag: 'path', attrs: { d: 'M6 13h12' } },
  { tag: 'path', attrs: { d: 'M6 17h12' } },
]);

export const IconBuilding = makeIcon([
  { tag: 'path', attrs: { d: 'M10 12h4' } },
  { tag: 'path', attrs: { d: 'M10 8h4' } },
  { tag: 'path', attrs: { d: 'M14 21v-3a2 2 0 0 0-4 0v3' } },
  { tag: 'path', attrs: { d: 'M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2' } },
  { tag: 'path', attrs: { d: 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16' } },
]);

// Pin de mapa - usado en la franja de sector y en la tarjeta de "zona
// aproximada". (Distinto del MapPinFallback dibujado a mano de
// InmueblesTab.tsx: ese trazo de dos jorobas se ve como un corazon a este
// tamano/contraste, asi que aqui se usa el pin de una sola cupula.)
export const IconMapPin = makeIcon([
  { tag: 'path', attrs: { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' } },
  { tag: 'circle', attrs: { cx: '12', cy: '10', r: '3' } },
]);

// Icono de marca (BrandMark en templates.tsx) - el caracter "✦" no existe en
// el font embebido (Plus Jakarta Sans, unico peso disponible para satori) y
// satori no trae fallback de fuente para simbolos: se pinta como glifo roto.
// Este es un icono real (relleno, no trazo) en vez de un caracter Unicode.
export function IconSparkleFilled({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
    </svg>
  );
}

export const IconShieldCheck = makeIcon([
  {
    tag: 'path',
    attrs: {
      d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    },
  },
  { tag: 'path', attrs: { d: 'm9 12 2 2 4-4' } },
]);

export const IconPhone = makeIcon([
  {
    tag: 'path',
    attrs: {
      d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384',
    },
  },
]);

export const FICHA_ICONS = {
  area: IconArea,
  bed: IconBed,
  bath: IconBath,
  halfBath: IconBath,
  parking: IconParking,
  age: IconAge,
  floor: IconLevel,
  elevator: IconElevator,
  commonAreas: IconGreenArea,
  furnished: IconFurnished,
  extraSpaces: IconExtraSpaces,
  balcony: IconBalcony,
  landUse: IconLandUse,
  frontage: IconArea,
  level: IconLevel,
  layout: IconExtraSpaces,
  occupancy: IconOccupancy,
  ceiling: IconCeiling,
  truck: IconTruck,
  corner: IconCorner,
  greenArea: IconGreenArea,
  independent: IconIndependent,
  fee: IconFee,
} as const;

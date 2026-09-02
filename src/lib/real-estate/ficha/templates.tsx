// Arboles JSX puramente presentacionales que satori convierte a SVG
// (rediseno de la ficha). Reglas de satori a tener en cuenta en todo este
// archivo:
// - No hay layout "block" ni CSS grid: todo contenedor con hijos necesita
//   display:'flex' explicito (yoga, el motor de layout de satori, solo
//   entiende flexbox) - el "mosaico" de fotos se arma con filas/columnas
//   flex anidadas, nunca con display:'grid'.
// - Nada de emojis en el texto: satori no trae fuente de emoji por defecto y
//   los pinta como caja vacia ("tofu") - se usan los iconos de icons.tsx en
//   su lugar.
// - Nada de fetch a URLs remotas: toda imagen (fotos, foto de agente, QR) ya
//   debe venir resuelta a data URI antes de llegar aqui (ver photos.ts y
//   render.ts).
// - Solo hay 4 pesos de fuente embebidos (400/600/700/800, ver fonts-data.ts)
//   - donde el pedido de diseno pide 500 se usa 600 (el mas cercano
//   disponible), nunca se agrega un 5to peso solo por esto.
import type { ReactNode } from 'react';
import type { FichaPalette } from './palettes';
import type { FichaFieldRow, FichaMapRow } from './fields';
import {
  FICHA_ICONS,
  IconBuilding,
  IconIndependent,
  IconMapPin,
  IconShieldCheck,
  IconSparkleFilled,
  IconWarehouse,
  type FichaIconProps,
} from './icons';

const FONT = 'Plus Jakarta Sans';

export type FichaListingSnapshot = {
  propertyTypeLabel: string;
  operationLabel: string;
  sectorLine: string;
  title: string;
  price: number;
  currency: string;
  pricePerM2: string | null;
  description: string | null;
  photoDataUri: string | null;
  // Resto de fotos ademas de la portada, ya resueltas a data URI - hasta 6
  // (7 fotos reales en total contando la portada, seccion 2.3.d del rediseno:
  // el 8vo slot del mosaico es siempre la tarjeta "Ver todas las fotos", no
  // una foto real, ver hasMorePhotos).
  galleryPhotoDataUris: string[];
  // true cuando el inmueble tiene mas fotos de las 7 que se muestran (o sea,
  // llego al tope de 8 que permite la galeria) - solo entonces se dibuja la
  // tarjeta "Ver todas las fotos" como 8vo elemento del mosaico.
  hasMorePhotos: boolean;
  placeholderKind: 'house' | 'land' | 'warehouse' | 'building';
  primaryRows: FichaFieldRow[];
  extraChips: FichaFieldRow[];
  mapDataRows: FichaMapRow[];
  referencia: string;
  fechaLabel: string;
};

export type FichaAgentSnapshot = {
  displayName: string;
  photoDataUri: string | null;
  phone: string;
  email: string | null;
  agencyName: string | null;
  licenseNumber: string | null;
  verified: boolean;
  qrDataUri: string | null;
};

export type FichaColegasSnapshot = {
  comisionCompartida: string;
  exclusividad: string;
  coordinacionVisitas: string;
  tiempoPublicado: string;
};

type Lang = 'es' | 'en';

function placeholderIcon(kind: FichaListingSnapshot['placeholderKind'], props: FichaIconProps): ReactNode {
  if (kind === 'land') return <IconMapPin {...props} />;
  if (kind === 'warehouse') return <IconWarehouse {...props} />;
  if (kind === 'building') return <IconBuilding {...props} />;
  return <IconIndependent {...props} />;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function fmtPrice(price: number, currency: string): string {
  const amount = `$${price.toLocaleString('en-US')}`;
  return currency && currency !== 'USD' ? `${amount} ${currency}` : amount;
}

// Distribuye `n` celdas en un ancho total con separaciones `gap` entre ellas,
// sin dejar resto (la ultima celda absorbe el redondeo).
function splitWidths(total: number, gap: number, n: number): number[] {
  const usable = total - gap * (n - 1);
  const base = Math.floor(usable / n);
  const widths = new Array(n).fill(base);
  widths[n - 1] = usable - base * (n - 1);
  return widths;
}

function BrandMark({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.4) }}>
      <IconSparkleFilled size={size} color={color} />
      <span style={{ fontSize: size, fontWeight: 800, letterSpacing: 1, color }}>REDINMO</span>
    </div>
  );
}

function Chip({
  label,
  variant,
  palette,
}: {
  label: string;
  variant: 'solid-violeta' | 'outline-violeta' | 'solid-teal';
  palette: FichaPalette;
}) {
  const darkContrast = palette.key === 'oscura' ? '#16112c' : '#ffffff';
  const style =
    variant === 'outline-violeta'
      ? { background: 'transparent', border: `1px solid ${palette.violetaLine}`, color: palette.violeta }
      : variant === 'solid-teal'
        ? { background: palette.teal, border: '1px solid transparent', color: palette.tealContrast }
        : { background: palette.violeta, border: '1px solid transparent', color: darkContrast };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 4,
        padding: '6px 12px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {label}
    </div>
  );
}

// Imagen a sangre dentro de un contenedor con overflow:hidden y radio propio
// - unica forma segura en satori de lograr "object-fit: cover" recortado.
function CoverImg({ uri, width, height, radius }: { uri: string; width: number | string; height: number; radius: number }) {
  return (
    <div style={{ display: 'flex', width, height, borderRadius: radius, overflow: 'hidden', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={uri} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

function PlaceholderTile({
  width,
  height,
  radius,
  palette,
  kind,
}: {
  width: number | string;
  height: number;
  radius: number;
  palette: FichaPalette;
  kind: FichaListingSnapshot['placeholderKind'];
}) {
  const iconSize = Math.max(18, Math.round(height * 0.28));
  return (
    <div
      style={{
        display: 'flex',
        width,
        height,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundImage: `linear-gradient(135deg, ${palette.placeholderFrom}, ${palette.placeholderTo})`,
      }}
    >
      {placeholderIcon(kind, { size: iconSize, color: palette.text3, strokeWidth: 1.4 })}
    </div>
  );
}

function ViewAllCard({ width, height, radius, palette, lang }: { width: number | string; height: number; radius: number; palette: FichaPalette; lang: Lang }) {
  const fontSize = height >= 100 ? 15 : 11;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        textAlign: 'center',
        backgroundImage: `linear-gradient(135deg, ${palette.gradFrom}, ${palette.gradTo})`,
      }}
    >
      <span style={{ fontSize, fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>{lang === 'es' ? 'Ver todas' : 'View all'}</span>
      <span style={{ fontSize, fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>{lang === 'es' ? 'las fotos' : 'the photos'}</span>
    </div>
  );
}

// Mosaico adaptivo (seccion 2.3.c/d y 8.2 del rediseno): con 8 fotos dibuja
// el bento completo (principal 2 filas + 4 secundarias + franja de 3, la
// ultima siempre la tarjeta "ver todas"); con menos fotos redistribuye sin
// dejar huecos vacios ni placeholders repetidos de mas.
function PhotoMosaic({
  listing,
  palette,
  lang,
  width,
}: {
  listing: FichaListingSnapshot;
  palette: FichaPalette;
  lang: Lang;
  width: number;
}) {
  const gap = 6;
  const coreH = 236;
  const stripH = 66;
  const radius = 10;

  const photos = [listing.photoDataUri, ...listing.galleryPhotoDataUris].filter((u): u is string => Boolean(u)).slice(0, 7);
  const n = photos.length;
  const hasMore = listing.hasMorePhotos && n >= 7;
  const total = Math.max(1, n + (hasMore ? 1 : 0));

  const tile = (index: number, w: number | string, h: number) => {
    if (index < n) return <CoverImg key={index} uri={photos[index]} width={w} height={h} radius={radius} />;
    if (hasMore && index === total - 1) return <ViewAllCard key={index} width={w} height={h} radius={radius} palette={palette} lang={lang} />;
    return <PlaceholderTile key={index} width={w} height={h} radius={radius} palette={palette} kind={listing.placeholderKind} />;
  };

  if (total <= 1) {
    return <div style={{ display: 'flex' }}>{tile(0, width, coreH)}</div>;
  }

  if (total === 2) {
    const [w0, w1] = splitWidths(width, gap, 2);
    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap }}>
        {tile(0, w0, coreH)}
        {tile(1, w1, coreH)}
      </div>
    );
  }

  if (total === 3) {
    const [wMain, wCol] = splitWidths(width, gap, 2);
    const cellH = (coreH - gap) / 2;
    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap }}>
        {tile(0, wMain, coreH)}
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          {tile(1, wCol, cellH)}
          {tile(2, wCol, cellH)}
        </div>
      </div>
    );
  }

  if (total === 4) {
    const [w0, w1] = splitWidths(width, gap, 2);
    const cellH = (coreH - gap) / 2;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap }}>
          {tile(0, w0, cellH)}
          {tile(1, w1, cellH)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap }}>
          {tile(2, w0, cellH)}
          {tile(3, w1, cellH)}
        </div>
      </div>
    );
  }

  // 5, 6, 7 u 8 (limite): nucleo fijo de 5 celdas (principal 2fr + dos
  // columnas 1fr de 2 celdas c/u) y, a partir de 6, una franja debajo con el
  // resto (1 a 3 celdas mas, la ultima de todas es la tarjeta si hasMore).
  // Reparto 2fr/1fr/1fr con 2 separaciones (3 columnas): unidad = (ancho -
  // 2*gap) / 4, la columna principal toma 2 unidades.
  const unit = (width - gap * 2) / 4;
  const wMain = Math.round(unit * 2);
  const wCol2 = Math.round(unit);
  const wCol3 = width - wMain - wCol2 - gap * 2;
  const coreCellH = (coreH - gap) / 2;
  const core = (
    <div style={{ display: 'flex', flexDirection: 'row', gap }}>
      {tile(0, wMain, coreH)}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {tile(1, wCol2, coreCellH)}
        {tile(2, wCol2, coreCellH)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {tile(3, wCol3, coreCellH)}
        {tile(4, wCol3, coreCellH)}
      </div>
    </div>
  );

  const remaining = total - 5;
  if (remaining <= 0) return core;

  const stripWidths = splitWidths(width, gap, remaining);
  let idx = 5;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {core}
      <div style={{ display: 'flex', flexDirection: 'row', gap }}>
        {stripWidths.map((w) => tile(idx++, w, stripH))}
      </div>
    </div>
  );
}

// Nota tecnica: satori 0.33.4 tiene un bug reproducible donde dos columnas
// flex distintas con exactamente 2 hijos <span> (aca, y el titular del
// encabezado) generan un clip-path invalido que hace panickear a resvg
// (geom.rs, Option::unwrap on None) - ver investigacion en el historial de
// commits. La franja de specs se arma por eso en DOS filas apiladas
// (valores arriba, etiquetas abajo) en vez de N columnas de 2 lineas cada
// una, evitando esa forma de arbol por completo. Visualmente es identico.
function SpecsStrip({ rows, palette, width }: { rows: FichaFieldRow[]; palette: FichaPalette; width: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        boxSizing: 'border-box',
        border: `1px solid ${palette.line}`,
        background: palette.surface,
        padding: '13px 6px',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flex: 1,
              justifyContent: 'center',
              borderLeft: i > 0 ? `1px solid ${palette.line}` : 'none',
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, color: palette.text, lineHeight: 1 }}>{row.value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', flex: 1, justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: palette.text3, textAlign: 'center' }}>
              {row.caption}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMap({ sectorLine, palette }: { sectorLine: string; palette: FichaPalette }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        height: 92,
        borderRadius: 14,
        border: `1px dashed ${palette.lineStrong}`,
        background: palette.surface2,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', position: 'absolute', top: '50%', left: 0, width: '100%', height: 1, background: palette.line }} />
      <div style={{ display: 'flex', position: 'absolute', top: 0, left: '33%', width: 1, height: '100%', background: palette.line }} />
      <div style={{ display: 'flex', position: 'absolute', top: 0, left: '66%', width: 1, height: '100%', background: palette.line }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: 999,
          background: palette.violetaDim,
        }}
      >
        <IconMapPin size={22} color={palette.violeta} strokeWidth={1.8} />
      </div>
      <span style={{ display: 'flex', position: 'absolute', bottom: 8, fontSize: 10, fontWeight: 700, color: palette.text3 }}>{sectorLine}</span>
    </div>
  );
}

function DataRow({ label, value, palette }: { label: string; value: string; palette: FichaPalette }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: palette.text3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: palette.text, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function CharacteristicItem({ row, palette }: { row: FichaFieldRow; palette: FichaPalette }) {
  const Icon = FICHA_ICONS[row.icon];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '48%' }}>
      <Icon size={14} color={palette.violeta} strokeWidth={1.9} />
      <span style={{ fontSize: 12, fontWeight: 600, color: palette.text2 }}>{row.value}</span>
    </div>
  );
}

function BodyTwoColumns({
  listing,
  palette,
  lang,
  width,
}: {
  listing: FichaListingSnapshot;
  palette: FichaPalette;
  lang: Lang;
  width: number;
}) {
  const characteristics = listing.extraChips.slice(0, 4);
  return (
    <div style={{ display: 'flex', flexDirection: 'row', width, gap: 26 }}>
      <div style={{ display: 'flex', flex: 1.35, flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: palette.text3 }}>
            {lang === 'es' ? 'Descripción' : 'Description'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 400, lineHeight: 1.5, color: palette.text2, maxHeight: 59, overflow: 'hidden' }}>
            {listing.description?.trim() || (lang === 'es' ? 'Consulta con el agente todos los detalles de este inmueble.' : 'Contact the agent for full details on this listing.')}
          </span>
        </div>
        {characteristics.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: palette.text3 }}>
              {lang === 'es' ? 'Características' : 'Features'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 12 }}>
              {characteristics.map((row, i) => (
                <CharacteristicItem key={i} row={row} palette={palette} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 9 }}>
        <MiniMap sectorLine={listing.sectorLine} palette={palette} />
        <DataRow label={lang === 'es' ? 'Sector' : 'Area'} value={listing.sectorLine} palette={palette} />
        {listing.mapDataRows.map((row, i) => (
          <DataRow key={i} label={row.label} value={row.value} palette={palette} />
        ))}
      </div>
    </div>
  );
}

function CondicionesColegas({ colegas, palette, lang, width }: { colegas: FichaColegasSnapshot; palette: FichaPalette; lang: Lang; width: number }) {
  const items: Array<[string, string]> = [
    [lang === 'es' ? 'Comisión compartida' : 'Shared commission', colegas.comisionCompartida],
    [lang === 'es' ? 'Exclusividad' : 'Exclusivity', colegas.exclusividad],
    [lang === 'es' ? 'Visitas' : 'Showings', colegas.coordinacionVisitas],
    [lang === 'es' ? 'Tiempo publicado' : 'Time listed', colegas.tiempoPublicado],
  ];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        boxSizing: 'border-box',
        gap: 11,
        borderRadius: 16,
        border: `1px solid ${palette.tealLine}`,
        background: palette.tealDim,
        padding: '15px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconSparkleFilled size={11} color={palette.teal} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: palette.teal }}>
          {lang === 'es' ? 'Condiciones para colegas' : 'Conditions for colleagues'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          {items.map(([label], i) => (
            <span key={i} style={{ display: 'flex', flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: palette.text3 }}>
              {label}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          {items.map(([, value], i) => (
            <span key={i} style={{ display: 'flex', flex: 1, fontSize: 16, fontWeight: 800, color: palette.text, lineHeight: 1.2 }}>
              {value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentBlock({ agent, palette, lang }: { agent: FichaAgentSnapshot; palette: FichaPalette; lang: Lang }) {
  const photoSize = 96;
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: photoSize,
          height: photoSize,
          borderRadius: 999,
          border: `2px solid ${palette.violeta}`,
          overflow: 'hidden',
          backgroundImage: `linear-gradient(135deg, ${palette.placeholderFrom}, ${palette.placeholderTo})`,
          flexShrink: 0,
        }}
      >
        {agent.photoDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agent.photoDataUri} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 34, fontWeight: 800, color: palette.text }}>{initials(agent.displayName)}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: palette.text }}>{agent.displayName}</span>
          {agent.verified ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, borderRadius: 999, background: palette.tealDim, padding: '3px 9px' }}>
              <IconShieldCheck size={11} color={palette.teal} strokeWidth={2.2} />
              <span style={{ fontSize: 10, fontWeight: 700, color: palette.teal }}>{lang === 'es' ? 'AGENTE VERIFICADO' : 'VERIFIED AGENT'}</span>
            </div>
          ) : null}
        </div>
        {agent.agencyName ? <span style={{ fontSize: 14, fontWeight: 600, color: palette.violeta }}>{agent.agencyName}</span> : null}
        <span style={{ fontSize: 16, fontWeight: 600, color: palette.text2 }}>
          {lang === 'es' ? 'Teléfono ' : 'Phone '}
          <span style={{ fontWeight: 700, color: palette.text }}>{agent.phone}</span>
        </span>
        {agent.email ? (
          <span style={{ fontSize: 16, fontWeight: 600, color: palette.text2 }}>
            {lang === 'es' ? 'Correo ' : 'Email '}
            <span style={{ fontWeight: 700, color: palette.text }}>{agent.email}</span>
          </span>
        ) : null}
      </div>
      {agent.qrDataUri ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 82, height: 82, borderRadius: 12, background: '#ffffff', padding: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={agent.qrDataUri} alt="" style={{ width: '100%', height: '100%' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: palette.text3 }}>
            {lang === 'es' ? 'Escanear' : 'Scan'}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export type FichaA4Version = 'cliente' | 'colega' | 'sin_marca';

// Ficha A4 completa (rediseno seccion 2): una sola pagina, sin banner de
// foto a sangre - portada y detalle viven en el mismo lienzo.
export function fichaA4Page({
  version,
  listing,
  agent,
  colegas,
  palette,
  lang,
  width,
  height,
}: {
  version: FichaA4Version;
  listing: FichaListingSnapshot;
  agent: FichaAgentSnapshot | null;
  colegas: FichaColegasSnapshot | null;
  palette: FichaPalette;
  lang: Lang;
  width: number;
  height: number;
}) {
  const marginX = 36;
  const contentW = width - marginX * 2;
  const showColegas = version === 'colega' && colegas !== null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width,
        height,
        background: palette.bg,
        fontFamily: FONT,
        padding: `26px ${marginX}px 22px`,
        overflow: 'hidden',
      }}
    >
      {/* Barra superior */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 13,
          borderBottom: `1px solid ${palette.line}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
          <Chip label={listing.operationLabel} variant="solid-violeta" palette={palette} />
          <Chip label={listing.propertyTypeLabel} variant="outline-violeta" palette={palette} />
          {version === 'colega' ? <Chip label={lang === 'es' ? 'Para colegas' : 'For colleagues'} variant="solid-teal" palette={palette} /> : null}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: palette.text3 }}>
          {lang === 'es' ? 'Ref.' : 'Ref.'} {listing.referencia} · {listing.fechaLabel}
        </span>
      </div>

      {/* Encabezado */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: palette.violeta }}>{listing.sectorLine}</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: palette.text, lineHeight: 1.15, marginTop: 5, maxHeight: 65, overflow: 'hidden' }}>{listing.title}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: palette.text3 }}>
            {lang === 'es' ? 'Precio' : 'Price'}
          </span>
          <span style={{ fontSize: 33, fontWeight: 800, color: palette.teal, lineHeight: 1, marginTop: 3 }}>{fmtPrice(listing.price, listing.currency)}</span>
          {listing.pricePerM2 ? <span style={{ fontSize: 12.5, fontWeight: 600, color: palette.text3, marginTop: 3 }}>{listing.pricePerM2}</span> : null}
        </div>
      </div>

      <div style={{ display: 'flex', marginTop: 16 }}>
        <PhotoMosaic listing={listing} palette={palette} lang={lang} width={contentW} />
      </div>

      {listing.primaryRows.length > 0 ? (
        <div style={{ display: 'flex', marginTop: 16 }}>
          <SpecsStrip rows={listing.primaryRows.slice(0, 6)} palette={palette} width={contentW} />
        </div>
      ) : null}

      <div style={{ display: 'flex', marginTop: 18 }}>
        <BodyTwoColumns listing={listing} palette={palette} lang={lang} width={contentW} />
      </div>

      {showColegas ? (
        <div style={{ display: 'flex', marginTop: 16 }}>
          <CondicionesColegas colegas={colegas} palette={palette} lang={lang} width={contentW} />
        </div>
      ) : null}

      <div style={{ display: 'flex', flex: 1 }} />

      {agent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', width: '100%', height: 2, background: palette.violeta }} />
          <AgentBlock agent={agent} palette={palette} lang={lang} />
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
        }}
      >
        <BrandMark color={palette.text3} size={10.5} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: palette.text3, textAlign: 'right' }}>
            {lang === 'es' ? 'Ficha generada en Redinmo, la red de agentes inmobiliarios verificados.' : 'Sheet generated on Redinmo, the network of verified real estate agents.'}
          </span>
          {version === 'colega' ? (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: palette.teal, textAlign: 'right' }}>
              {lang === 'es'
                ? 'Coordina esta propiedad directamente con el agente que la gestiona.'
                : 'Coordinate this property directly with the managing agent.'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Version cuadrada para redes (seccion 5.1): foto a sangre en la mitad
// superior + franja de precio/specs + chips + pie de agente compacto. Sin QR
// ni descripcion - en redes nadie lee parrafos.
export function fichaSocialPost({
  listing,
  agent,
  palette,
  width,
  height,
}: {
  listing: FichaListingSnapshot;
  agent: FichaAgentSnapshot | null;
  palette: FichaPalette;
  width: number;
  height: number;
}) {
  const heroH = Math.round(height * 0.52);
  const characteristics = listing.extraChips.slice(0, 4);
  const specs = listing.primaryRows.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, background: palette.bg, fontFamily: FONT }}>
      <div style={{ display: 'flex', position: 'relative', width: '100%', height: heroH }}>
        {listing.photoDataUri ? (
          <CoverImg uri={listing.photoDataUri} width={width} height={heroH} radius={0} />
        ) : (
          <PlaceholderTile width={width} height={heroH} radius={0} palette={palette} kind={listing.placeholderKind} />
        )}
        <div style={{ display: 'flex', position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.82) 100%)` }} />
        <div style={{ display: 'flex', position: 'absolute', top: 44, left: 44 }}>
          <Chip label={listing.operationLabel} variant="solid-violeta" palette={palette} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: 44, right: 44, bottom: 34, gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#ffffff' }}>{listing.sectorLine}</span>
          <span style={{ fontSize: 40, fontWeight: 800, color: '#ffffff', lineHeight: 1.12, maxHeight: 96, overflow: 'hidden' }}>{listing.title}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '30px 44px', gap: 26, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: palette.teal, lineHeight: 1 }}>{fmtPrice(listing.price, listing.currency)}</span>
            {listing.pricePerM2 ? <span style={{ fontSize: 17, fontWeight: 600, color: palette.text3 }}>{listing.pricePerM2}</span> : null}
          </div>

          {specs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 20, border: `1px solid ${palette.line}`, background: palette.surface, padding: '20px 10px' }}>
              <div style={{ display: 'flex', flexDirection: 'row' }}>
                {specs.map((row, i) => (
                  <div key={i} style={{ display: 'flex', flex: 1, justifyContent: 'center', borderLeft: i > 0 ? `1px solid ${palette.line}` : 'none' }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: palette.text, lineHeight: 1 }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'row' }}>
                {specs.map((row, i) => (
                  <div key={i} style={{ display: 'flex', flex: 1, justifyContent: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: palette.text3 }}>{row.caption}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {characteristics.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {characteristics.map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 999, border: `1px solid ${palette.lineStrong}`, background: palette.surface2, padding: '10px 16px' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: palette.text2 }}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {agent ? (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${palette.line}`, paddingTop: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 62,
                  height: 62,
                  borderRadius: 999,
                  border: `2px solid ${palette.violeta}`,
                  overflow: 'hidden',
                  backgroundImage: `linear-gradient(135deg, ${palette.placeholderFrom}, ${palette.placeholderTo})`,
                  flexShrink: 0,
                }}
              >
                {agent.photoDataUri ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agent.photoDataUri} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 22, fontWeight: 800, color: palette.text }}>{initials(agent.displayName)}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: palette.text }}>{agent.displayName}</span>
                {agent.agencyName ? <span style={{ fontSize: 13, fontWeight: 600, color: palette.violeta }}>{agent.agencyName}</span> : null}
                <span style={{ fontSize: 14, fontWeight: 600, color: palette.text2 }}>{agent.phone}</span>
              </div>
            </div>
            <BrandMark color={palette.text3} size={13} />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <BrandMark color={palette.text3} size={14} />
          </div>
        )}
      </div>
    </div>
  );
}

// Version vertical para estado de WhatsApp / historias (seccion 5.2): deja
// zonas seguras arriba (~110px) y abajo (~170px) donde WhatsApp superpone su
// interfaz - nada importante puede caer ahi.
export function fichaSocialStory({
  listing,
  agent,
  palette,
  lang,
  width,
  height,
}: {
  listing: FichaListingSnapshot;
  agent: FichaAgentSnapshot | null;
  palette: FichaPalette;
  lang: Lang;
  width: number;
  height: number;
}) {
  const safeTop = 110;
  const safeBottom = 170;
  const heroH = Math.round(height * 0.42);
  const characteristics = listing.extraChips.slice(0, 5);
  const specs = listing.primaryRows.slice(0, 3);
  const secondaryPhotos = listing.galleryPhotoDataUris.slice(0, 2);
  const extraCount = Math.max(0, listing.galleryPhotoDataUris.length - 2 + (listing.hasMorePhotos ? 1 : 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, background: palette.bg, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: safeTop }}>
        <BrandMark color={palette.text3} size={19} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 48px', gap: 22, justifyContent: 'flex-start' }}>
        <div style={{ display: 'flex', position: 'relative', width: '100%', height: heroH, borderRadius: 24, overflow: 'hidden' }}>
          {listing.photoDataUri ? (
            <CoverImg uri={listing.photoDataUri} width="100%" height={heroH} radius={0} />
          ) : (
            <PlaceholderTile width="100%" height={heroH} radius={0} palette={palette} kind={listing.placeholderKind} />
          )}
          <div style={{ display: 'flex', position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.82) 100%)` }} />
          <div style={{ display: 'flex', position: 'absolute', top: 24, left: 24 }}>
            <Chip label={listing.operationLabel} variant="solid-violeta" palette={palette} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: 24, right: 24, bottom: 24, gap: 6 }}>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#ffffff' }}>{listing.sectorLine}</span>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#ffffff', lineHeight: 1.15, maxHeight: 74, overflow: 'hidden' }}>{listing.title}</span>
          </div>
        </div>

        {secondaryPhotos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'row', gap: 14, height: 150 }}>
            {secondaryPhotos.map((uri, i) => (
              <div key={i} style={{ display: 'flex', position: 'relative', flex: 1, borderRadius: 20, overflow: 'hidden' }}>
                <CoverImg uri={uri} width="100%" height={150} radius={0} />
                {i === 1 && extraCount > 0 ? (
                  <div style={{ display: 'flex', position: 'absolute', inset: 0, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,13,24,0.62)' }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>+{extraCount} {lang === 'es' ? 'fotos' : 'photos'}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 42, fontWeight: 800, color: palette.teal, lineHeight: 1 }}>{fmtPrice(listing.price, listing.currency)}</span>
          {listing.pricePerM2 ? <span style={{ fontSize: 14, fontWeight: 600, color: palette.text3 }}>{listing.pricePerM2}</span> : null}
        </div>

        {specs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderRadius: 18, border: `1px solid ${palette.line}`, background: palette.surface, padding: '16px 8px' }}>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              {specs.map((row, i) => (
                <div key={i} style={{ display: 'flex', flex: 1, justifyContent: 'center', borderLeft: i > 0 ? `1px solid ${palette.line}` : 'none' }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: palette.text, lineHeight: 1 }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              {specs.map((row, i) => (
                <div key={i} style={{ display: 'flex', flex: 1, justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: palette.text3 }}>{row.caption}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {characteristics.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {characteristics.map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', borderRadius: 999, border: `1px solid ${palette.lineStrong}`, background: palette.surface2, padding: '8px 14px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: palette.text2 }}>{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', flex: 1 }} />

        {agent ? (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, border: `1px solid ${palette.line}`, background: palette.surface, padding: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 58,
                height: 58,
                borderRadius: 999,
                border: `2px solid ${palette.violeta}`,
                overflow: 'hidden',
                backgroundImage: `linear-gradient(135deg, ${palette.placeholderFrom}, ${palette.placeholderTo})`,
                flexShrink: 0,
              }}
            >
              {agent.photoDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agent.photoDataUri} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 800, color: palette.text }}>{initials(agent.displayName)}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: palette.text }}>{agent.displayName}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>{agent.phone}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', height: safeBottom, paddingTop: 12 }}>
        <BrandMark color={palette.text3} size={12} />
      </div>
    </div>
  );
}

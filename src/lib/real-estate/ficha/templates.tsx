// Arboles JSX puramente presentacionales que satori convierte a SVG (Fase 2).
// Reglas de satori a tener en cuenta en todo este archivo:
// - No hay layout "block": todo contenedor con hijos necesita
//   display:'flex' explicito (yoga, el motor de layout de satori, solo
//   entiende flexbox).
// - Nada de emojis en el texto: satori no trae fuente de emoji por defecto y
//   los pinta como caja vacia ("tofu") - se usan los iconos de icons.tsx en
//   su lugar.
// - Nada de fetch a URLs remotas: toda imagen (foto de portada, foto de
//   agente, QR) ya debe venir resuelta a data URI antes de llegar aqui (ver
//   photos.ts y render.ts).
import type { ReactNode } from 'react';
import type { FichaPalette } from './palettes';
import type { FichaFieldRow } from './fields';
import {
  FICHA_ICONS,
  IconBuilding,
  IconIndependent,
  IconMapPin,
  IconPhone,
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
  price: number;
  currency: string;
  description: string | null;
  photoDataUri: string | null;
  placeholderKind: 'house' | 'land' | 'warehouse' | 'building';
  primaryRows: FichaFieldRow[];
  extraChips: FichaFieldRow[];
};

export type FichaAgentSnapshot = {
  displayName: string;
  photoDataUri: string | null;
  phone: string;
  direccion: string | null;
  licenseNumber: string | null;
  verified: boolean;
  qrDataUri: string | null;
};

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

function BrandMark({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.35) }}>
      <IconSparkleFilled size={size} color={color} />
      <span style={{ fontSize: size, fontWeight: 800, letterSpacing: 1, color }}>REDINMO</span>
    </div>
  );
}

function HeroPhoto({ listing, palette, height }: { listing: FichaListingSnapshot; palette: FichaPalette; height: number }) {
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      {listing.photoDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.photoDataUri} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `linear-gradient(135deg, ${palette.placeholderFrom}, ${palette.placeholderTo})`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: Math.round(height * 0.34),
              height: Math.round(height * 0.34),
              marginBottom: Math.round(height * 0.1),
              borderRadius: 999,
              background: 'rgba(255,255,255,0.05)',
            }}
          >
            {placeholderIcon(listing.placeholderKind, { size: Math.round(height * 0.15), color: palette.text3, strokeWidth: 1.4 })}
          </div>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `linear-gradient(180deg, ${palette.overlayFrom} 46%, ${palette.overlayTo} 100%)`,
        }}
      />
    </div>
  );
}

function StatChip({ row, palette, compact }: { row: FichaFieldRow; palette: FichaPalette; compact?: boolean }) {
  const Icon = FICHA_ICONS[row.icon];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: compact ? 74 : 92, gap: 4 }}>
      <div style={{ display: 'flex' }}>
        <Icon size={compact ? 20 : 24} color={palette.accent} strokeWidth={1.7} />
      </div>
      <span style={{ fontSize: compact ? 18 : 22, fontWeight: 800, color: palette.text }}>{row.value}</span>
      {row.caption ? (
        <span style={{ fontSize: compact ? 9 : 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: palette.text3, textAlign: 'center' }}>
          {row.caption}
        </span>
      ) : null}
    </div>
  );
}

function Pill({ row, palette }: { row: FichaFieldRow; palette: FichaPalette }) {
  const Icon = FICHA_ICONS[row.icon];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        borderRadius: 999,
        border: `1px solid ${palette.lineStrong}`,
        background: palette.surface2,
        padding: '9px 14px',
      }}
    >
      <div style={{ display: 'flex' }}>
        <Icon size={15} color={palette.text2} strokeWidth={1.8} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: palette.text2 }}>{row.value}</span>
    </div>
  );
}

function ZoneCard({ sectorLine, palette, lang }: { sectorLine: string; palette: FichaPalette; lang: 'es' | 'en' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        borderRadius: 22,
        border: `1px dashed ${palette.lineStrong}`,
        background: palette.surface2,
        padding: '28px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 52,
          height: 52,
          borderRadius: 999,
          background: palette.accentDim,
        }}
      >
        <IconMapPin size={26} color={palette.accent} strokeWidth={1.7} />
      </div>
      <span style={{ fontSize: 19, fontWeight: 800, color: palette.text }}>{sectorLine}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: palette.text3, maxWidth: 460 }}>
        {lang === 'es'
          ? 'Zona aproximada · la ubicación exacta se comparte al coordinar la visita.'
          : 'Approximate area · the exact address is shared when the showing is scheduled.'}
      </span>
    </div>
  );
}

function AgentFooter({ agent, palette, lang, size = 'normal' }: { agent: FichaAgentSnapshot; palette: FichaPalette; lang: 'es' | 'en'; size?: 'normal' | 'compact' }) {
  const photoSize = size === 'compact' ? 56 : 76;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'compact' ? 12 : 16, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: photoSize,
          height: photoSize,
          borderRadius: 999,
          border: `2px solid ${palette.accent}`,
          overflow: 'hidden',
          backgroundImage: `linear-gradient(135deg, ${palette.placeholderFrom}, ${palette.placeholderTo})`,
          flexShrink: 0,
        }}
      >
        {agent.photoDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agent.photoDataUri} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: Math.round(photoSize * 0.36), fontWeight: 800, color: palette.text }}>{initials(agent.displayName)}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 3, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: size === 'compact' ? 16 : 19, fontWeight: 800, color: palette.text }}>{agent.displayName}</span>
          {agent.verified ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, borderRadius: 999, background: palette.accentDim, padding: '3px 9px' }}>
              <IconShieldCheck size={12} color={palette.accent} strokeWidth={2.2} />
              <span style={{ fontSize: 10, fontWeight: 800, color: palette.accent }}>
                {lang === 'es' ? 'VERIFICADO' : 'VERIFIED'}
              </span>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconPhone size={13} color={palette.text3} strokeWidth={2} />
          <span style={{ fontSize: size === 'compact' ? 12.5 : 14, fontWeight: 600, color: palette.text2 }}>{agent.phone}</span>
        </div>
        {agent.direccion ? (
          <span style={{ fontSize: 11.5, fontWeight: 500, color: palette.text3 }}>{agent.direccion}</span>
        ) : null}
      </div>
      {agent.qrDataUri ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: photoSize,
            height: photoSize,
            borderRadius: 12,
            background: '#ffffff',
            padding: 6,
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agent.qrDataUri} alt="" style={{ width: '100%', height: '100%' }} />
        </div>
      ) : null}
    </div>
  );
}

// Pagina 1 (seccion 3.1/3.2): portada a sangre completa + franja de datos
// duros superpuesta al borde inferior de la foto.
export function fichaCoverPage({
  listing,
  palette,
  lang,
  width,
  height,
}: {
  listing: FichaListingSnapshot;
  palette: FichaPalette;
  lang: 'es' | 'en';
  width: number;
  height: number;
}) {
  const heroHeight = Math.round(height * 0.62);
  const heroTextColor = '#ffffff';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, background: palette.bg, fontFamily: FONT }}>
      <div style={{ display: 'flex', position: 'relative', width: '100%', height: heroHeight }}>
        <HeroPhoto listing={listing} palette={palette} height={heroHeight} />
        <div style={{ display: 'flex', position: 'absolute', top: 36, left: 44 }}>
          <BrandMark color={heroTextColor} size={19} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: 44, right: 44, bottom: 40, gap: 8 }}>
          <span style={{ fontSize: 58, fontWeight: 800, color: heroTextColor, lineHeight: 1 }}>{fmtPrice(listing.price, listing.currency)}</span>
          <span style={{ fontSize: 27, fontWeight: 700, color: heroTextColor }}>
            {listing.propertyTypeLabel} {lang === 'es' ? 'en' : 'for'} {listing.operationLabel}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconMapPin size={18} color="rgba(255,255,255,0.85)" strokeWidth={2} />
            <span style={{ fontSize: 19, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{listing.sectorLine}</span>
          </div>
        </div>
      </div>

      {listing.primaryRows.length > 0 ? (
        <div
          style={{
            display: 'flex',
            marginLeft: 40,
            marginRight: 40,
            marginTop: -34,
            borderRadius: 24,
            background: palette.surface,
            border: `1px solid ${palette.line}`,
            boxShadow: '0 18px 34px rgba(0,0,0,0.28)',
            padding: '20px 12px',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            rowGap: 16,
          }}
        >
          {listing.primaryRows.map((row, i) => (
            <StatChip key={i} row={row} palette={palette} />
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', flex: 1 }} />
    </div>
  );
}

// Pagina 2 (secciones 3.4 a 3.7): descripcion, detalles adicionales, zona
// aproximada, pie con el agente (si aplica) y marca Redinmo.
export function fichaDetailPage({
  listing,
  agent,
  palette,
  lang,
  width,
  height,
  photoMissingNotice,
}: {
  listing: FichaListingSnapshot;
  agent: FichaAgentSnapshot | null;
  palette: FichaPalette;
  lang: 'es' | 'en';
  width: number;
  height: number;
  photoMissingNotice?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, background: palette.bg, fontFamily: FONT, padding: 44 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: palette.text3 }}>
          {lang === 'es' ? 'Descripción' : 'Description'}
        </span>
        <span style={{ fontSize: 17, fontWeight: 400, lineHeight: 1.6, color: palette.text2, maxHeight: 210, overflow: 'hidden' }}>
          {listing.description?.trim() || (lang === 'es' ? 'Consulta con el agente todos los detalles de este inmueble.' : 'Contact the agent for full details on this listing.')}
        </span>
      </div>

      {listing.extraChips.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26, gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: palette.text3 }}>
            {lang === 'es' ? 'Detalles adicionales' : 'Additional details'}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {listing.extraChips.map((row, i) => (
              <Pill key={i} row={row} palette={palette} />
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', marginTop: 26 }}>
        <ZoneCard sectorLine={listing.sectorLine} palette={palette} lang={lang} />
      </div>

      {photoMissingNotice ? (
        <div
          style={{
            display: 'flex',
            marginTop: 22,
            borderRadius: 14,
            border: `1px dashed ${palette.lineStrong}`,
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: 12.5, color: palette.text3 }}>
            {lang === 'es' ? 'Este inmueble todavía no tiene fotos cargadas.' : 'This listing has no photos yet.'}
          </span>
        </div>
      ) : null}

      <div style={{ display: 'flex', flex: 1 }} />

      {agent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', width: '100%', borderTop: `1px solid ${palette.line}` }} />
          <AgentFooter agent={agent} palette={palette} lang={lang} />
        </div>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: agent ? 20 : 0 }}>
        <BrandMark color={palette.text3} size={13} />
      </div>
    </div>
  );
}

// Version condensada para redes (seccion 2.3): un solo lienzo cuadrado
// (1080x1080) o de historia (1080x1920) con portada + franja + pie de agente
// compactos.
export function fichaSocialImage({
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
  lang: 'es' | 'en';
  width: number;
  height: number;
}) {
  const heroTextColor = '#ffffff';
  const compactRows = listing.primaryRows.slice(0, 4);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', width, height, fontFamily: FONT }}>
      <HeroPhoto listing={listing} palette={palette} height={height} />
      <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: 56, justifyContent: 'space-between' }}>
          <BrandMark color={heroTextColor} size={22} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 68, fontWeight: 800, color: heroTextColor, lineHeight: 1 }}>{fmtPrice(listing.price, listing.currency)}</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: heroTextColor }}>
                {listing.propertyTypeLabel} {lang === 'es' ? 'en' : 'for'} {listing.operationLabel}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconMapPin size={20} color="rgba(255,255,255,0.88)" strokeWidth={2} />
                <span style={{ fontSize: 21, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>{listing.sectorLine}</span>
              </div>
            </div>

            {compactRows.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  borderRadius: 22,
                  background: 'rgba(10,8,18,0.55)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: '18px 10px',
                  justifyContent: 'space-around',
                }}
              >
                {compactRows.map((row, i) => {
                  const Icon = FICHA_ICONS[row.icon];
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <Icon size={22} color={palette.accent} strokeWidth={1.8} />
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{row.value}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                        {row.caption}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {agent ? (
              <div
                style={{
                  display: 'flex',
                  borderRadius: 22,
                  background: 'rgba(10,8,18,0.55)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: 16,
                }}
              >
                <AgentFooter agent={agent} palette={{ ...palette, text: '#fff', text2: 'rgba(255,255,255,0.82)', text3: 'rgba(255,255,255,0.65)' }} lang={lang} size="compact" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

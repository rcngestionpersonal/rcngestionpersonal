'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { progressWithinLevel } from '@/lib/real-estate/points';

// Kit de componentes compartido por los modulos "gemelos" Tus Matches / Tus Pedidos /
// Tus Inmuebles / Mapa de Cierres (mismos tokens visuales). No duplicar estos
// componentes en cada tab.
//
// Nota sobre el bug de "toda la tipografia se hace mas chica en movil": las tarjetas
// viven dentro de un CSS grid (`grid xl:grid-cols-2`). Un grid item sin `min-w-0` usa
// `min-width: auto` por defecto, asi que un texto largo sin espacios (un titulo libre,
// un nombre) puede forzar el ancho del grid (y de toda la pagina) mas alla del
// viewport, lo que hace que el navegador movil reduzca el zoom de toda la pantalla.
// `min-w-0` en cada nivel del arbol (Card, DataBlock, MatchLink) es lo que permite que
// `truncate`/`break-words` realmente corten el texto en vez de desbordar.

export function ModuleHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6 min-w-0">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-dim text-brand">
          {icon}
        </span>
        <h2 className="min-w-0 truncate text-[20px] font-bold tracking-[-0.01em] text-text">{title}</h2>
      </div>
      <p className="mt-1.5 text-[13.5px] text-text-2">{subtitle}</p>
    </div>
  );
}

// Recorte defensivo a nivel de string (ademas del CSS truncate): asi un titulo libre
// larguisimo nunca llega a forzar el layout, sin depender solo de que cada ancestro
// tenga min-w-0 bien puesto.
export function truncateText(text: string, max = 42): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <article className="min-w-0 rounded-2xl border border-[rgba(255,255,255,0.07)] border-t-[rgba(255,255,255,0.13)] bg-bg-alt px-[18px] pb-1.5 pt-[18px]">
      {children}
    </article>
  );
}

// Acento de modulo: Inmuebles = teal, Pedidos = violeta (item 8/9 del pedido) -
// mismo tema oscuro en toda la app, solo cambia el color de identidad.
export type ModuleAccent = 'teal' | 'violet';

function accentColors(accent: ModuleAccent) {
  return accent === 'teal'
    ? { text: 'var(--accent)', border: 'var(--accent-line)', borderStrong: 'var(--accent-line)', bg: 'var(--accent-dim)' }
    : { text: 'var(--brand)', border: 'var(--brand-line)', borderStrong: 'var(--brand-line)', bg: 'var(--brand-dim)' };
}

export function Chip({
  tone = 'neutral',
  uppercase = true,
  children,
}: {
  tone?: 'teal' | 'violet' | 'neutral';
  uppercase?: boolean;
  children: ReactNode;
}) {
  let toneClasses: string;
  if (tone === 'teal') {
    toneClasses = 'bg-[rgba(45,212,191,0.12)] border-[rgba(45,212,191,0.35)] text-[#2dd4bf]';
  } else if (tone === 'violet') {
    toneClasses = 'bg-brand-dim border-brand-line text-brand';
  } else {
    toneClasses = 'bg-transparent border-[rgba(255,255,255,0.07)] text-text-3';
  }
  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${uppercase ? 'uppercase tracking-[0.07em]' : ''} ${toneClasses}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function DataBlock({ rows }: { rows: Array<{ label: string; value: ReactNode } | null> }) {
  const visible = rows.filter((r): r is { label: string; value: ReactNode } => r !== null);
  if (visible.length === 0) return null;
  return (
    <div className="min-w-0 rounded-[11px] border border-[rgba(255,255,255,0.07)] bg-[#1c1930] px-[13px] py-[11px]">
      {visible.map((row, idx) => (
        <div
          key={row.label}
          className={`flex min-w-0 items-start justify-between gap-3 py-1 ${idx > 0 ? 'border-t border-dashed border-[rgba(255,255,255,0.07)]' : ''}`}
        >
          <span className="min-w-[82px] shrink-0 pt-0.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-3">{row.label}</span>
          <span className="min-w-0 flex-1 break-words text-right text-sm font-medium text-text">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MatchLink({
  onClick,
  title,
  detail,
  ariaLabel,
  accent = 'violet',
}: {
  onClick: () => void;
  title: string;
  detail: string;
  ariaLabel: string;
  accent?: ModuleAccent;
}) {
  const c = accentColors(accent);
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ borderColor: c.borderStrong, color: c.text }}
      className="flex w-full min-w-0 items-center gap-2 rounded-[10px] border bg-transparent px-[13px] py-2.5 text-left transition-colors duration-150 hover:bg-surface focus-visible:outline focus-visible:outline-2"
    >
      <span className="shrink-0 text-[15px]" style={{ color: c.text }}>&#10022;</span>
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="font-semibold text-text">{truncateText(title, 30)}</span>{' '}
        <span className="font-normal text-text-2">{truncateText(detail, 34)}</span>
      </span>
      <span className="shrink-0" style={{ color: c.text }}>&rarr;</span>
    </button>
  );
}

export function IconActionButton({
  icon,
  onClick,
  ariaLabel,
  title,
  tone = 'edit',
  disabled,
}: {
  icon: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  tone?: 'edit' | 'delete' | 'download';
  disabled?: boolean;
}) {
  const hoverClass =
    tone === 'delete'
      ? 'hover:border-[#e5484d] hover:text-[#e5484d]'
      : tone === 'download'
        ? 'hover:border-accent hover:text-accent'
        : 'hover:border-brand hover:text-brand';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-[rgba(255,255,255,0.07)] bg-transparent text-text-3 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${hoverClass}`}
    >
      {icon}
    </button>
  );
}

export function CardFooterNote({ children }: { children: ReactNode }) {
  return <p className="min-w-0 text-xs leading-relaxed text-text-3">{children}</p>;
}

// Disparador de acordeon reutilizado por Cierres / Inmuebles / Pedidos para "Registrar
// un X": cuadro "+" que rota a "x", titulo + badge de puntos (siempre leido de la tabla
// de puntos, nunca hardcodeado) + subtitulo, y chevron que rota al abrir.
export function RegisterAccordion({
  title,
  points,
  subtitle,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
}: {
  title: string;
  points: number;
  subtitle: string;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const toggle = () => (onToggle ? onToggle() : setInternalOpen((v) => !v));
  return (
    <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] border-t-[rgba(255,255,255,0.13)] bg-bg-alt p-[18px] fade-up">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-[13px] text-left"
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-brand-line bg-brand-dim text-[18px] font-bold text-brand transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-45' : ''
          }`}
        >
          +
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold text-text">{title}</span>
            <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-dim px-2 py-0.5 text-[10.5px] font-bold tracking-[0.05em] text-brand">
              +{points} PTS
            </span>
          </span>
          <span className="mt-0.5 block text-[12.5px] text-text-3">{subtitle}</span>
        </span>
        <span className={`shrink-0 text-[13px] text-brand transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open ? <div className="fade-up mt-4 min-w-0">{children}</div> : null}
    </section>
  );
}

// Salto con transicion (item 8.4/9.3 del pedido): al hacer click en un match
// en linea desde Inmuebles/Pedidos, se aplica un fundido breve antes de
// cambiar de tab en vez de un salto instantaneo. Respeta prefers-reduced-motion.
export function navigateWithFade(action: () => void): void {
  if (typeof window === 'undefined') {
    action();
    return;
  }
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    action();
    return;
  }
  document.body.classList.add('match-jump-transition');
  window.setTimeout(() => {
    action();
    requestAnimationFrame(() => document.body.classList.remove('match-jump-transition'));
  }, 160);
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function shortDate(iso: string, lang: 'es' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short' });
}

// Devuelve el texto completo segun hoy/ayer/fecha, para frases como
// "Match de hoy" / "Match de ayer" / "Match del 19 jul".
export function relativeLabel(
  iso: string,
  variants: { today: string; yesterday: string; prefix: string },
  lang: 'es' | 'en',
): string {
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000);
  if (diffDays === 0) return variants.today;
  if (diffDays === 1) return variants.yesterday;
  return `${variants.prefix} ${shortDate(iso, lang)}`;
}

export function pedidoOperationNoun(operationType: 'SALE' | 'RENT' | 'BOTH', t: (k: string) => string): string {
  return t(`pedidos.opNoun.${operationType}`);
}

// "Compra de casa" (sin lugar) - titular de tarjeta de Pedido.
export function pedidoTitulo(
  op: { propertyType: string; operationType: 'SALE' | 'RENT' | 'BOTH' },
  tProperty: (v: string) => string,
  t: (k: string) => string,
  lang: 'es' | 'en',
): string {
  const noun = pedidoOperationNoun(op.operationType, t);
  const tipo = tProperty(op.propertyType).toLowerCase();
  return lang === 'es' ? `${noun} de ${tipo}` : `${noun} of ${tipo}`;
}

// "Quito – Cumbayá"
export function zonaLine(place: { city: string; zone?: string }): string {
  return place.zone ? `${place.city} – ${place.zone}` : place.city;
}

// "Oficina Sector Shyris" en vez del titulo libre completo ("Oficina en Centro
// Norte, Shyris, Carolina...") - abrevia a tipo + primera palabra de la zona,
// dejando el texto completo para el subtitulo (zonaLine). Item 8/9 del pedido.
export function abbreviatedTitle(propertyType: string, zoneOrCity: string, tProperty: (v: string) => string, lang: 'es' | 'en'): string {
  const firstWord = zoneOrCity.split(/[,–-]/)[0].trim().split(/\s+/).slice(0, 1).join(' ');
  const connector = lang === 'es' ? 'Sector' : 'Zone';
  return firstWord ? `${tProperty(propertyType)} ${connector} ${firstWord}` : tProperty(propertyType);
}

// "Compra de casa · Quito – Cumbayá" - usado en el DataBlock de Matches y en los
// match-links de Inmuebles.
export function pedidoBrief(
  op: { propertyType: string; operationType: 'SALE' | 'RENT' | 'BOTH'; city: string; zone?: string },
  tProperty: (v: string) => string,
  t: (k: string) => string,
  lang: 'es' | 'en',
): string {
  return `${pedidoTitulo(op, tProperty, t, lang)} · ${zonaLine(op)}`;
}

// "Casa en Venta · Cumbayá" - usado en el DataBlock de Matches y en los match-links de
// Pedidos.
export function listingBrief(
  listing: { propertyType: string; operationType: 'SALE' | 'RENT' | 'BOTH'; city: string; zone?: string },
  tProperty: (v: string) => string,
  tOperation: (v: string) => string,
  lang: 'es' | 'en',
): string {
  const place = listing.zone || listing.city;
  return lang === 'es' ? `${tProperty(listing.propertyType)} en ${tOperation(listing.operationType)} · ${place}` : `${tProperty(listing.propertyType)} for ${tOperation(listing.operationType)} · ${place}`;
}

export function fmtBudget(min: number | undefined, max: number | undefined, noEspecificado: string): string {
  if (!min && !max) return noEspecificado;
  if (min && max && min === max) return `$${min.toLocaleString('en-US')}`;
  if (min && max) return `$${min.toLocaleString('en-US')} - $${max.toLocaleString('en-US')}`;
  const single = min ?? max ?? 0;
  return `$${single.toLocaleString('en-US')}`;
}

export function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Avatar circular: siempre iniciales (todavia no hay foto de perfil de agente), sobre
// el color de su nivel de ranking.
export function AvatarInitials({
  name,
  size,
  colorHex,
  ring,
  photoUrl,
}: {
  name: string;
  size: number;
  colorHex: string;
  ring?: boolean;
  photoUrl?: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`Foto de ${name}`}
        className={`shrink-0 rounded-full object-cover ${ring ? 'outline outline-2 outline-offset-2 outline-brand' : ''}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold text-[#1c1330] ${ring ? 'outline outline-2 outline-offset-2 outline-brand' : ''}`}
      style={{ width: size, height: size, background: colorHex, fontSize: Math.round(size * 0.36) }}
    >
      {initialsOf(name)}
    </div>
  );
}

// Barra lineal de progreso al siguiente nivel (Ranking/BrokerCard). El anillo circular
// de Gestion usa la misma progressWithinLevel() para medir exactamente lo mismo.
export function LevelBar({
  totalPoints,
  level,
  nextLevel,
  lang,
  t,
}: {
  totalPoints: number;
  level: { min: number; labelEs: string; labelEn: string };
  nextLevel: { min: number; labelEs: string; labelEn: string } | null;
  lang: 'es' | 'en';
  t: (k: string) => string;
}) {
  const pct = progressWithinLevel(totalPoints, level, nextLevel);
  const levelLabel = lang === 'es' ? level.labelEs : level.labelEn;
  const nextLabel = nextLevel ? (lang === 'es' ? nextLevel.labelEs : nextLevel.labelEn) : null;
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-text-2">
        {nextLevel ? (
          <>
            {levelLabel} / <span className="font-semibold text-text">{nextLevel.min - totalPoints}</span> {t('ranking.puntos')} {t('common.para')} {nextLabel}
          </>
        ) : (
          t('puntos.nivelMaximo')
        )}
      </p>
    </div>
  );
}

// Anillo circular de progreso (hero de Gestion): el % de llenado es el progreso DENTRO
// del nivel actual (progressWithinLevel), nunca puntos absolutos.
export function ProgressRing({
  pct,
  totalPoints,
  size = 118,
  ariaLabel,
}: {
  pct: number;
  totalPoints: number;
  size?: number;
  ariaLabel: string;
}) {
  const [animatedPct, setAnimatedPct] = useState(0);
  useEffect(() => {
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setAnimatedPct(pct);
      return;
    }
    const raf = requestAnimationFrame(() => setAnimatedPct(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  const radius = 51;
  const stroke = 9;
  const center = 59;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animatedPct / 100);

  return (
    <svg width={size} height={size} viewBox="0 0 118 118" role="img" aria-label={ariaLabel} className="shrink-0">
      <circle cx={center} cy={center} r={radius} strokeWidth={stroke} stroke="rgba(255,255,255,0.07)" fill="none" />
      <circle
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={stroke}
        stroke="var(--brand)"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        className="transition-[stroke-dashoffset] duration-[600ms] ease-out motion-reduce:transition-none"
      />
      <text x={center} y={center - 5} textAnchor="middle" fontSize="29" fontWeight="800" fill="var(--text)">
        {totalPoints}
      </text>
      <text x={center} y={center + 13} textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1" fill="var(--text-3)">
        PUNTOS
      </text>
    </svg>
  );
}

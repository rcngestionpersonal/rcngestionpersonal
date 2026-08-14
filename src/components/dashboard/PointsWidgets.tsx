'use client';

import { useState, type ReactNode } from 'react';
import { POINT_ACTIONS, POINT_ACTIONS_BY_VALUE } from '@/lib/real-estate/points';
import { IconClipboard, IconHouse } from './icons';
import type { PointsHistoryEntryClient, PointsSummaryClient } from './types';

function fmtDate(iso: string, lang: 'es' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short' });
}

export function PointsBanner({ variant, t }: { variant: 'inmuebles' | 'pedidos'; t: (k: string) => string }) {
  const Icon = variant === 'inmuebles' ? IconHouse : IconClipboard;
  const titleKey = variant === 'inmuebles' ? 'puntos.banner.inmuebles.titulo' : 'puntos.banner.pedidos.titulo';
  const detailKey = variant === 'inmuebles' ? 'puntos.banner.inmuebles.detalle' : 'puntos.banner.pedidos.detalle';

  return (
    <section className="fade-up flex items-center gap-3 rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-dim text-brand">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <p className="text-sm leading-snug text-text">
        <span className="font-bold text-violet-300">{t(titleKey)}</span> {t(detailKey)}
      </p>
    </section>
  );
}

export function PointsSummaryCard({ summary, lang, t }: { summary: PointsSummaryClient; lang: 'es' | 'en'; t: (k: string) => string }) {
  const levelLabel = lang === 'es' ? summary.level.labelEs : summary.level.labelEn;
  const nextLabel = summary.nextLevel ? (lang === 'es' ? summary.nextLevel.labelEs : summary.nextLevel.labelEn) : null;
  const span = summary.nextLevel ? summary.nextLevel.min - summary.level.min : 1;
  const progressed = summary.nextLevel ? summary.totalPoints - summary.level.min : 1;
  const pct = summary.nextLevel ? Math.min(100, Math.max(0, Math.round((progressed / span) * 100))) : 100;

  return (
    <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-white/[0.02] to-cyan-500/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        {summary.level.badge ? <span className="text-3xl leading-none">{summary.level.badge}</span> : null}
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-2">{t('puntos.tuNivel')}</p>
          <p className="text-lg font-bold text-text">{levelLabel}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-cyan-300">{summary.totalPoints}</p>
          <p className="text-xs text-text-2">{t('ranking.puntos')}</p>
        </div>
      </div>
      {summary.nextLevel ? (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-text-2">
            {t('puntos.faltanPara')} <span className="font-semibold text-text">{summary.pointsToNext}</span> {t('ranking.puntos')} → {nextLabel}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs font-semibold text-emerald-300">{t('puntos.nivelMaximo')}</p>
      )}
    </div>
  );
}

export function PointsHistoryList({ events, lang, t }: { events: PointsHistoryEntryClient[]; lang: 'es' | 'en'; t: (k: string) => string }) {
  if (events.length === 0) {
    return <p className="text-xs text-text-3">{t('puntos.sinHistorial')}</p>;
  }
  return (
    <div className="space-y-1.5">
      {events.map((ev, idx) => {
        const def = POINT_ACTIONS[ev.eventType];
        return (
          <div
            key={`${ev.eventType}-${ev.createdAt}-${idx}`}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm transition-colors duration-200 hover:border-emerald-400/20"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="truncate text-text">{def ? (lang === 'es' ? def.pastLabelEs : def.pastLabelEn) : ev.eventType}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-[11px] text-text-3">{fmtDate(ev.createdAt, lang)}</span>
              <span className="font-semibold text-emerald-300">+{ev.points}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HowToEarnPoints({ lang, t }: { lang: 'es' | 'en'; t: (k: string) => string }) {
  return (
    <div className="space-y-1.5">
      {POINT_ACTIONS_BY_VALUE.map(({ key, def }) => (
        <div
          key={key}
          className={`rounded-xl px-3 py-2 text-sm transition-colors duration-200 ${
            key === 'CLOSING_REGISTERED'
              ? 'border border-amber-400/40 bg-amber-500/10'
              : 'border border-line bg-surface-2 hover:border-emerald-400/25'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-text">{lang === 'es' ? def.labelEs : def.labelEn}</span>
            <span className="shrink-0 font-semibold text-emerald-300">+{def.points}</span>
          </div>
          {key === 'CLOSING_REGISTERED' ? (
            <span className="mt-1.5 inline-block rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
              {t('puntos.laQueMasSuma')}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function BreakdownCard({
  icon,
  label,
  total,
  rows,
  items,
  dropdown = true,
  t,
}: {
  icon?: ReactNode;
  label: string;
  total: number;
  rows?: Array<{ label: string; count: number }>;
  items?: Array<{ id: string; label: string }>;
  dropdown?: boolean;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const hasContent = Boolean((rows && rows.length > 0) || (items && items.length > 0));
  return (
    <div className="group min-w-0 rounded-2xl border border-line bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-transparent p-4 transition-colors duration-200 hover:border-emerald-400/25">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-[0.12em] text-text-2">{label}</p>
            <p className="mt-1 text-2xl font-bold text-text">{total}</p>
          </div>
        </div>
        {dropdown && hasContent ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            {open ? t('puntos.ocultar') : t('puntos.verDesglose')}
          </button>
        ) : null}
      </div>
      {dropdown && open ? (
        <div className="mt-3 min-w-0 space-y-1">
          {items ? (
            items.length === 0 ? (
              <p className="text-xs text-text-3">{t('ranking.sinDatos')}</p>
            ) : (
              items.map((item) => (
                <p key={item.id} className="min-w-0 truncate rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-text-2">
                  {item.label}
                </p>
              ))
            )
          ) : rows && rows.length > 0 ? (
            rows.map((row) => (
              <div key={row.label} className="flex min-w-0 items-center justify-between gap-2 text-xs text-text-2">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 font-semibold text-emerald-300">{row.count}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-3">{t('ranking.sinDatos')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CollapsibleSection({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="glass-card rounded-[1.8rem] p-4 sm:p-6">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-text">
            {icon}
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-text-2">{subtitle}</p> : null}
        </div>
        <span className={`shrink-0 text-2xl leading-none text-emerald-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open ? <div className="fade-up mt-4">{children}</div> : null}
    </section>
  );
}

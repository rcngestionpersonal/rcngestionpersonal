'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { ChurnMonth } from '../types';

const GOOD = '#34d399';
const WARNING = '#fbbf24';
const CRITICAL = '#fb7185';
const NEUTRAL = 'var(--text-2)';
const ALTAS_COLOR = 'var(--brand)';
const BAJAS_COLOR = '#fb7185';

function churnColor(pct: number | null): string {
  if (pct === null) return NEUTRAL;
  if (pct <= 5) return GOOD;
  if (pct <= 8) return WARNING;
  return CRITICAL;
}

function churnBadgeClasses(pct: number | null): string {
  if (pct === null) return 'border-line-strong bg-surface-2 text-text-3';
  if (pct <= 5) return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300';
  if (pct <= 8) return 'border-amber-400/30 bg-amber-500/10 text-amber-300';
  return 'border-pink-400/30 bg-pink-500/10 text-pink-300';
}

function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${pct}%`;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-3">{label}</p>
      <p className="mt-2 text-2xl font-bold" style={tone ? { color: tone } : { color: 'var(--text)' }}>
        {value}
      </p>
    </div>
  );
}

function ChurnLineChart({ months }: { months: ChurnMonth[] }) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 600;
  const height = 200;
  const padX = 24;
  const padY = 20;

  const values = months.map((m) => m.churnPct).filter((v): v is number => v !== null);
  const maxValue = Math.max(10, ...values, 0) * 1.15;

  const stepX = (width - padX * 2) / (months.length - 1);
  const yFor = (pct: number) => height - padY - (pct / maxValue) * (height - padY * 2);
  const xFor = (i: number) => padX + i * stepX;

  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < months.length - 1; i++) {
    const a = months[i].churnPct;
    const b = months[i + 1].churnPct;
    if (a !== null && b !== null) {
      segments.push({ x1: xFor(i), y1: yFor(a), x2: xFor(i + 1), y2: yFor(b) });
    }
  }

  const refLine = (pct: number) => (
    <line
      x1={padX}
      x2={width - padX}
      y1={yFor(pct)}
      y2={yFor(pct)}
      stroke="rgba(255,255,255,0.08)"
      strokeDasharray="4 4"
      strokeWidth={1}
    />
  );

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">{t('metricas.churnChart.title')}</p>
        <div className="flex items-center gap-3 text-[11px] text-text-2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: GOOD }} /> {t('metricas.leyenda.bueno')}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: WARNING }} /> {t('metricas.leyenda.alerta')}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: CRITICAL }} /> {t('metricas.leyenda.critico')}
          </span>
        </div>
      </div>

      <div className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 'auto' }}>
          {refLine(5)}
          {refLine(8)}
          {segments.map((s, idx) => (
            <line key={idx} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={NEUTRAL} strokeWidth={2} strokeLinecap="round" />
          ))}
          {months.map((m, i) => {
            const cy = m.churnPct !== null ? yFor(m.churnPct) : height - padY;
            return (
              <circle
                key={m.month}
                cx={xFor(i)}
                cy={cy}
                r={hovered === i ? 6 : 4.5}
                fill={m.churnPct !== null ? churnColor(m.churnPct) : 'rgba(255,255,255,0.15)'}
                stroke="#0b0d14"
                strokeWidth={1.5}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${m.label}: ${formatPct(m.churnPct)}`}</title>
              </circle>
            );
          })}
        </svg>
        {hovered !== null ? (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs text-text shadow-lg">
            <span className="font-semibold">{months[hovered].label}</span>: {formatPct(months[hovered].churnPct)}
          </div>
        ) : null}
        <div className="mt-1 flex justify-between text-[10px] text-text-3">
          {months
            .filter((_, i) => i % 2 === 0 || months.length <= 6)
            .map((m) => (
              <span key={m.month}>{m.label}</span>
            ))}
        </div>
      </div>
    </div>
  );
}

function AltasBajasBarChart({ months }: { months: ChurnMonth[] }) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 600;
  const height = 200;
  const padX = 24;
  const padY = 16;
  const maxValue = Math.max(1, ...months.map((m) => Math.max(m.altas, m.bajas)));

  const groupWidth = (width - padX * 2) / months.length;
  const barWidth = Math.min(14, groupWidth / 3);

  const yFor = (v: number) => (v / maxValue) * (height - padY * 2);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">{t('metricas.altasBajasChart.title')}</p>
        <div className="flex items-center gap-3 text-[11px] text-text-2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: ALTAS_COLOR }} /> {t('metricas.leyenda.altas')}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: BAJAS_COLOR }} /> {t('metricas.leyenda.bajas')}
          </span>
        </div>
      </div>

      <div className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 'auto' }}>
          {months.map((m, i) => {
            const groupX = padX + i * groupWidth;
            const centerX = groupX + groupWidth / 2;
            if (!m.hasActivity) {
              return (
                <line
                  key={m.month}
                  x1={centerX - barWidth}
                  x2={centerX + barWidth}
                  y1={height - padY}
                  y2={height - padY}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={2}
                />
              );
            }
            const altasH = yFor(m.altas);
            const bajasH = yFor(m.bajas);
            return (
              <g key={m.month} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered((h) => (h === i ? null : h))} style={{ cursor: 'pointer' }}>
                <rect x={centerX - barWidth - 2} y={height - padY - altasH} width={barWidth} height={altasH} rx={3} fill={ALTAS_COLOR}>
                  <title>{`${m.label} · ${t('metricas.leyenda.altas')}: ${m.altas}`}</title>
                </rect>
                <rect x={centerX + 2} y={height - padY - bajasH} width={barWidth} height={bajasH} rx={3} fill={BAJAS_COLOR}>
                  <title>{`${m.label} · ${t('metricas.leyenda.bajas')}: ${m.bajas}`}</title>
                </rect>
              </g>
            );
          })}
          <line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        </svg>
        {hovered !== null ? (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs text-text shadow-lg">
            <span className="font-semibold">{months[hovered].label}</span>: +{months[hovered].altas} / -{months[hovered].bajas}
          </div>
        ) : null}
        <div className="mt-1 flex justify-between text-[10px] text-text-3">
          {months
            .filter((_, i) => i % 2 === 0 || months.length <= 6)
            .map((m) => (
              <span key={m.month}>{m.label}</span>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function MetricasTab({ months }: { months: ChurnMonth[] | null }) {
  const { t } = useLanguage();

  const current = useMemo(() => (months && months.length > 0 ? months[months.length - 1] : null), [months]);
  const anyActivity = useMemo(() => (months ?? []).some((m) => m.hasActivity), [months]);

  if (!months) {
    return (
      <div className="space-y-10">
        <section className="fade-up text-text">
          <h1 className="text-2xl font-bold text-text sm:text-3xl">{t('metricas.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-2">{t('metricas.subtitle')}</p>
        </section>
        <p className="text-sm text-text-2">{t('metricas.cargando')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="fade-up text-text">
        <h1 className="text-2xl font-bold text-text sm:text-3xl">{t('metricas.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-2">{t('metricas.subtitle')}</p>
      </section>

      {!anyActivity ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-text-2">{t('metricas.notaVacio')}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={t('metricas.churnMes')} value={current ? formatPct(current.churnPct) : '—'} tone={current ? churnColor(current.churnPct) : undefined} />
        <SummaryCard label={t('metricas.activos')} value={current ? String(current.activeAtStart) : '—'} />
        <SummaryCard label={t('metricas.altas')} value={current ? String(current.altas) : '—'} tone={ALTAS_COLOR} />
        <SummaryCard
          label={t('metricas.bajasNetas')}
          value={current ? String(current.netGrowth) : '—'}
          tone={current && current.netGrowth < 0 ? BAJAS_COLOR : undefined}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChurnLineChart months={months} />
        <AltasBajasBarChart months={months} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-text">{t('metricas.tabla.title')}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="text-text-3">
                <th className="border-b border-line py-2 pr-3 font-semibold uppercase tracking-[0.06em]">{t('metricas.tabla.mes')}</th>
                <th className="border-b border-line py-2 pr-3 font-semibold uppercase tracking-[0.06em]">{t('metricas.tabla.activosInicio')}</th>
                <th className="border-b border-line py-2 pr-3 font-semibold uppercase tracking-[0.06em]">{t('metricas.tabla.altas')}</th>
                <th className="border-b border-line py-2 pr-3 font-semibold uppercase tracking-[0.06em]">{t('metricas.tabla.bajasVoluntarias')}</th>
                <th className="border-b border-line py-2 pr-3 font-semibold uppercase tracking-[0.06em]">{t('metricas.tabla.bajasInvoluntarias')}</th>
                <th className="border-b border-line py-2 pr-3 font-semibold uppercase tracking-[0.06em]">{t('metricas.tabla.churn')}</th>
                <th className="border-b border-line py-2 pr-3 font-semibold uppercase tracking-[0.06em]">{t('metricas.tabla.mrr')}</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className="text-text">
                  <td className="border-b border-line py-2 pr-3 font-semibold text-text">{m.label}</td>
                  <td className="border-b border-line py-2 pr-3">{m.activeAtStart}</td>
                  <td className="border-b border-line py-2 pr-3 text-violet-300">{m.hasActivity ? `+${m.altas}` : '—'}</td>
                  <td className="border-b border-line py-2 pr-3">{m.hasActivity ? m.bajasVoluntary : '—'}</td>
                  <td className="border-b border-line py-2 pr-3">{m.hasActivity ? m.bajasInvoluntary : '—'}</td>
                  <td className="border-b border-line py-2 pr-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${churnBadgeClasses(m.churnPct)}`}>
                      {formatPct(m.churnPct)}
                    </span>
                  </td>
                  <td className="border-b border-line py-2 pr-3">{formatUsd(m.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

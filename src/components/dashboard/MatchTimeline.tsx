'use client';

import { useState, type ReactNode } from 'react';
import { Briefcase, Calendar, Eye, Home, Send, Trophy } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { milestonePoints, pointsForMilestoneKey } from '@/lib/real-estate/ranking';
import type { ListingMatchItem, ProgressPatch } from './types';

type StepDef = {
  key: string;
  icon: ReactNode;
  label: string;
  done: boolean;
  detail?: string;
  points: number;
  action?: ReactNode;
};

function ActionButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-violet-400 px-3 py-1.5 text-xs font-semibold text-[#1c1330] transition-transform duration-200 hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
    >
      {children}
    </button>
  );
}

function Step({ step, isLast }: { step: StepDef; isLast: boolean }) {
  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      {!isLast ? (
        <span
          className={`absolute left-[15px] top-8 w-0.5 transition-colors duration-500 ${
            step.done ? 'bg-gradient-to-b from-emerald-400 to-emerald-400/15' : 'bg-white/10'
          }`}
          style={{ height: 'calc(100% - 1.25rem)' }}
        />
      ) : null}
      <span
        className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm transition-all duration-300 ${
          step.done
            ? 'border-emerald-400 bg-emerald-500 text-white shadow-[0_0_14px_rgba(52,211,153,0.55)]'
            : 'border-white/15 bg-white/5 text-white/50'
        }`}
      >
        {step.done ? '✓' : step.icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm ${step.done ? 'font-semibold text-white' : 'text-white/60'}`}>{step.label}</p>
          {step.done ? (
            <span className="fade-up rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              +{step.points} pts
            </span>
          ) : step.points > 0 ? (
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/30">+{step.points} pts</span>
          ) : null}
        </div>
        {step.detail ? <p className="mt-0.5 text-xs text-white/40">{step.detail}</p> : null}
        {step.action ? <div className="mt-2">{step.action}</div> : null}
      </div>
    </div>
  );
}

export default function MatchTimeline({
  match,
  responsibleName,
  canEdit,
  onUpdate,
}: {
  match: ListingMatchItem;
  responsibleName?: string;
  canEdit: boolean;
  onUpdate: (patch: ProgressPatch) => void;
}) {
  const { t } = useLanguage();
  const [visitDateTime, setVisitDateTime] = useState('');

  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }) : undefined);

  const closed = match.closedWon === true;
  const lost = match.closedWon === false;
  const earnedPoints = milestonePoints(match);
  const maxPoints =
    pointsForMilestoneKey('markContacted') +
    pointsForMilestoneKey('infoSent') +
    pointsForMilestoneKey('visitFollowUp') +
    pointsForMilestoneKey('visitScheduledFor') +
    pointsForMilestoneKey('visitCompleted') +
    (match.visitOutcome !== 'DESCARTADA' ? pointsForMilestoneKey('offerInProgress') + pointsForMilestoneKey('closedWon') : 0);
  const progressPct = maxPoints > 0 ? Math.min(100, Math.round((earnedPoints / maxPoints) * 100)) : 0;

  const steps: StepDef[] = [
    {
      key: 'infoSent',
      icon: <Send className="h-4 w-4" strokeWidth={2} />,
      label: t('timeline.envioInfo'),
      done: Boolean(match.infoSentAt),
      detail: fmt(match.infoSentAt),
      points: pointsForMilestoneKey('infoSent'),
      action:
        canEdit && !match.infoSentAt ? <ActionButton onClick={() => onUpdate({ infoSent: true })}>{t('timeline.marcar')}</ActionButton> : undefined,
    },
    {
      key: 'visitFollowUp',
      icon: <Eye className="h-4 w-4" strokeWidth={2} />,
      label: t('timeline.seguimientoVisita'),
      done: Boolean(match.visitFollowUpAt),
      detail: fmt(match.visitFollowUpAt),
      points: pointsForMilestoneKey('visitFollowUp'),
      action:
        canEdit && !match.visitFollowUpAt ? (
          <ActionButton onClick={() => onUpdate({ visitFollowUp: true })}>{t('timeline.marcar')}</ActionButton>
        ) : undefined,
    },
    {
      key: 'visitScheduledFor',
      icon: <Calendar className="h-4 w-4" strokeWidth={2} />,
      label: t('timeline.visitaConfirmada'),
      done: Boolean(match.visitScheduledFor),
      detail: fmt(match.visitScheduledFor),
      points: pointsForMilestoneKey('visitScheduledFor'),
      action:
        canEdit && !match.visitScheduledFor ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="datetime-local"
              value={visitDateTime}
              onChange={(e) => setVisitDateTime(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-violet-400"
            />
            <ActionButton
              onClick={() => visitDateTime && onUpdate({ visitScheduledFor: new Date(visitDateTime).toISOString() })}
              disabled={!visitDateTime}
            >
              {t('timeline.confirmar')}
            </ActionButton>
          </div>
        ) : undefined,
    },
    {
      key: 'visitCompleted',
      icon: <Home className="h-4 w-4" strokeWidth={2} />,
      label: t('timeline.visitaRealizada'),
      done: Boolean(match.visitCompletedAt),
      detail: match.visitCompletedAt
        ? `${fmt(match.visitCompletedAt)} — ${match.visitOutcome === 'SATISFACTORIA' ? t('timeline.satisfactoria') : t('timeline.descartada')}`
        : undefined,
      points: pointsForMilestoneKey('visitCompleted'),
      action:
        canEdit && !match.visitCompletedAt ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/50">{t('timeline.comoSalioVisita')}</span>
            <button
              onClick={() => onUpdate({ visitOutcome: 'SATISFACTORIA' })}
              className="rounded-full bg-violet-400 px-3 py-1.5 text-xs font-semibold text-[#1c1330] transition-transform duration-200 hover:scale-[1.04]"
            >
              {t('timeline.satisfactoria')}
            </button>
            <button
              onClick={() => onUpdate({ visitOutcome: 'DESCARTADA' })}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors duration-200 hover:bg-white/10"
            >
              {t('timeline.descartada')}
            </button>
          </div>
        ) : undefined,
    },
  ];

  if (match.visitOutcome === 'SATISFACTORIA') {
    steps.push({
      key: 'offerInProgress',
      icon: <Briefcase className="h-4 w-4" strokeWidth={2} />,
      label: t('timeline.enOferta'),
      done: Boolean(match.offerInProgressAt),
      detail: fmt(match.offerInProgressAt),
      points: pointsForMilestoneKey('offerInProgress'),
      action:
        canEdit && !match.offerInProgressAt && !closed && !lost ? (
          <ActionButton onClick={() => onUpdate({ offerInProgress: true })}>{t('timeline.marcar')}</ActionButton>
        ) : undefined,
    });
  }

  steps.push({
    key: 'closedWon',
    icon: <Trophy className="h-4 w-4" strokeWidth={2} />,
    label: t('timeline.negociacionConcretada'),
    done: closed,
    detail: fmt(match.closedAt),
    points: pointsForMilestoneKey('closedWon'),
    action:
      canEdit && !closed ? (
        <ActionButton onClick={() => onUpdate({ closedWon: true })}>
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-3 w-3" strokeWidth={2.2} /> {t('timeline.marcar')}
          </span>
        </ActionButton>
      ) : undefined,
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-white/70">{t('timeline.title')}</h3>
        {responsibleName ? (
          <span className="text-[11px] text-white/40">
            {t('timeline.responsable')} <span className="text-white/70">{responsibleName}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet-400 transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-bold text-violet-300">{earnedPoints} pts</span>
      </div>

      {closed ? (
        <div className="fade-up mt-3 flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
          <Trophy className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} /> {t('timeline.negociacionConcretada')} — {earnedPoints} {t('ranking.pts')} {t('timeline.sumadosRanking')}
        </div>
      ) : null}

      <div className="mt-4">
        {steps.map((step, idx) => (
          <Step key={step.key} step={step} isLast={idx === steps.length - 1} />
        ))}
      </div>

      {!canEdit ? <p className="mt-2 text-[11px] text-white/35">{t('timeline.soloResponsable')}</p> : null}

      {canEdit && (closed || lost) ? (
        <button onClick={() => onUpdate({ closedWon: null })} className="mt-2 text-[11px] text-white/40 underline hover:text-white/70">
          {t('timeline.reabrir')}
        </button>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { AvatarInitials, ModuleHeader } from '../CardKit';
import { IconPodium, IconTarget } from '../icons';
import { BrokerCard, DEFAULT_CARNET_MESSAGE_ES, DEFAULT_CARNET_MESSAGE_EN, type BrokerCardData } from '../BrokerCard';
import CarnetShareModal from '../CarnetShareModal';
import { SHARE_CARNET_ENABLED } from '@/lib/real-estate/feature-flags';
import { QUITO_ZONES } from '@/lib/real-estate/quito-zones';
import {
  POINT_ACTIONS,
  RANKING_LEVELS,
  levelColorFor,
  levelForPoints,
} from '@/lib/real-estate/points';
import { isAgentVerified } from '../types';
import type { AgentDashboardBreakdown, AgentItem, PointsRankingEntry, PointsSummaryClient } from '../types';

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[20px] font-bold tracking-[-0.01em] text-text">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-dim text-brand">{icon}</span>
      {title}
    </h2>
  );
}

export default function RankingTab({
  isAdmin,
  isAgent,
  pointsRanking,
  myAgentId,
  myAgent,
  myPoints,
  agentBreakdown,
  carnetSlug,
  pendingCarnetAction,
  onConsumePendingCarnetAction,
  onProfileSaved,
}: {
  isAdmin: boolean;
  isAgent: boolean;
  pointsRanking: PointsRankingEntry[];
  myAgentId?: string;
  myAgent?: AgentItem;
  myPoints: PointsSummaryClient | null;
  agentBreakdown?: AgentDashboardBreakdown;
  carnetSlug?: string | null;
  pendingCarnetAction?: 'scroll' | 'share' | null;
  onConsumePendingCarnetAction?: () => void;
  onProfileSaved?: () => void;
}) {
  const { t, lang } = useLanguage();
  const myRankEntry = pointsRanking.find((r) => r.agentId === myAgentId);

  if (isAdmin || !isAgent) {
    return (
      <div className="space-y-8">
        <section className="glass-card fade-up rounded-[1.8rem] p-4 sm:p-6">
          <SectionHeading icon={<IconPodium className="h-[18px] w-[18px]" />} title={t('gestion.rankingAgentes.title')} />
          <p className="mt-1 text-sm text-text-2">{t('rankingTab.subtitle')}</p>
          <TopAgentesList ranking={pointsRanking} myAgentId={myAgentId} t={t} lang={lang} limit={10} />
        </section>
      </div>
    );
  }

  const totalPoints = myPoints?.totalPoints ?? 0;
  const level = myPoints?.level ?? levelForPoints(0);

  return (
    <div className="space-y-8">
      <ModuleHeader icon={<IconPodium className="h-[18px] w-[18px]" strokeWidth={2} />} title={t('ranking.moduleTitle')} subtitle={t('ranking.moduleSubtitle')} />

      <CarnetSection
        myAgentId={myAgentId}
        myAgent={myAgent}
        myRankEntry={myRankEntry}
        totalPoints={totalPoints}
        level={level}
        agentBreakdown={agentBreakdown}
        carnetSlug={carnetSlug}
        pendingCarnetAction={pendingCarnetAction}
        onConsumePendingCarnetAction={onConsumePendingCarnetAction}
        onProfileSaved={onProfileSaved}
        lang={lang}
        t={t}
      />

      <LevelLadder totalPoints={totalPoints} lang={lang} />

      <section className="fade-up glass-card rounded-[1.8rem] p-4 sm:p-6">
        <SectionHeading icon={<IconPodium className="h-[18px] w-[18px]" />} title={t('ranking.top10.title')} />
        <p className="mt-1.5 text-sm text-text-2">{t('ranking.top10.subtitle')}</p>
        <TopAgentesList ranking={pointsRanking} myAgentId={myAgentId} t={t} lang={lang} limit={10} />
      </section>

      <PointsGrid t={t} lang={lang} />
    </div>
  );
}

function CarnetSection({
  myAgentId,
  myAgent,
  myRankEntry,
  totalPoints,
  level,
  agentBreakdown,
  carnetSlug,
  pendingCarnetAction,
  onConsumePendingCarnetAction,
  onProfileSaved,
  lang,
  t,
}: {
  myAgentId?: string;
  myAgent?: AgentItem;
  myRankEntry?: PointsRankingEntry;
  totalPoints: number;
  level: { key: string; labelEs: string; labelEn: string; min: number };
  agentBreakdown?: AgentDashboardBreakdown;
  carnetSlug?: string | null;
  pendingCarnetAction?: 'scroll' | 'share' | null;
  onConsumePendingCarnetAction?: () => void;
  onProfileSaved?: () => void;
  lang: 'es' | 'en';
  t: (k: string) => string;
}) {
  const [showPhotoNudge, setShowPhotoNudge] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [zonesDraft, setZonesDraft] = useState<string[]>(myAgent?.specializationZones ?? []);
  const [messageDraft, setMessageDraft] = useState(myAgent?.carnetMessage ?? '');
  const [yearsExpDraft, setYearsExpDraft] = useState(myAgent?.yearsExperience != null ? String(myAgent.yearsExperience) : '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Sincroniza el borrador cuando cambia el agente logueado (no en cada
  // refresco de datos no relacionado, para no perder texto a medio escribir).
  useEffect(() => {
    setZonesDraft(myAgent?.specializationZones ?? []);
    setMessageDraft(myAgent?.carnetMessage ?? '');
    setYearsExpDraft(myAgent?.yearsExperience != null ? String(myAgent.yearsExperience) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAgentId]);

  // Nudge de foto: se muestra UNA sola vez por agente (persistido en
  // localStorage), nunca dentro de la imagen exportada ni del carnet publico.
  useEffect(() => {
    if (typeof window === 'undefined' || !myAgentId || myAgent?.photoUrl) return;
    const key = `redinmo_carnet_photo_nudge_${myAgentId}`;
    if (!window.localStorage.getItem(key)) {
      setShowPhotoNudge(true);
      window.localStorage.setItem(key, '1');
    }
  }, [myAgentId, myAgent?.photoUrl]);

  useEffect(() => {
    if (!pendingCarnetAction) return;
    document.getElementById('carnet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (pendingCarnetAction === 'share') setShareOpen(true);
    onConsumePendingCarnetAction?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCarnetAction]);

  const subscriptionActive = myAgent?.subscriptionStatus === 'TRIAL' || myAgent?.subscriptionStatus === 'ACTIVE';
  const joinYear = myAgent?.createdAt ? new Date(myAgent.createdAt).getFullYear() : new Date().getFullYear();

  const cardData: BrokerCardData = {
    displayName: myRankEntry?.displayName ?? myAgent?.fullName ?? '',
    photoUrl: myAgent?.photoUrl,
    verified: isAgentVerified(myAgent),
    level,
    totalPoints,
    rank: myRankEntry?.rank ?? 0,
    cierres: agentBreakdown?.mapaPreciosTotal ?? 0,
    listingsActive: agentBreakdown?.listingsActive ?? 0,
    joinYear,
    specializationZones: myAgent?.specializationZones ?? [],
    phone: myAgent?.phone ?? '',
    email: myAgent?.email,
    direccion: myAgent?.direccion,
    ciudad: myAgent?.ciudad,
    specialty: myAgent?.specialty,
    subscriptionActive,
    carnetMessage: myAgent?.carnetMessage,
    carnetSlug: carnetSlug ?? myAgent?.carnetSlug,
    yearsExperience: myAgent?.yearsExperience,
    licenseNumber: myAgent?.licenseNumber,
    company: myAgent?.company,
  };

  const firstName = (myAgent?.fullName ?? '').trim().split(/\s+/)[0] ?? '';
  const defaultMessagePreview = (lang === 'es' ? DEFAULT_CARNET_MESSAGE_ES : DEFAULT_CARNET_MESSAGE_EN).replace('{nombre}', firstName);

  async function handleSaveProfile() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/real-estate/agents/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specializationZones: zonesDraft,
          carnetMessage: messageDraft,
          yearsExperience: yearsExpDraft.trim() ? Number(yearsExpDraft) : null,
        }),
      });
      if (res.ok) {
        setSaveMsg(t('ranking.carnet.guardado'));
        onProfileSaved?.();
        setTimeout(() => setSaveMsg(''), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="carnet" className="fade-up scroll-mt-20">
      {showPhotoNudge ? (
        <div className="mb-3 rounded-xl border border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.08)] px-3.5 py-2.5 text-[12.5px] text-text-2">
          {t('ranking.carnet.nudgeFoto')}
        </div>
      ) : null}

      <BrokerCard data={cardData} audience="colegas" lang={lang} t={t} />

      {cardData.specializationZones.length === 0 ? (
        <button
          onClick={() => setEditorOpen(true)}
          className="mt-3 block w-full text-center text-xs text-text-2 underline decoration-dotted underline-offset-2 transition-colors hover:text-accent"
        >
          {t('ranking.carnet.nudgeZonas')} — {t('ranking.carnet.completarPerfil')}
        </button>
      ) : null}

      {SHARE_CARNET_ENABLED ? (
        <button
          onClick={() => setShareOpen(true)}
          aria-label={t('ranking.compartirCarnet')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] border border-line px-4 py-2.5 text-sm font-semibold text-text-2 transition-colors duration-150 hover:text-accent"
        >
          ↗ {t('ranking.compartirCarnet')}
        </button>
      ) : null}

      <button
        onClick={() => setEditorOpen((v) => !v)}
        className="mt-2 flex w-full items-center justify-between rounded-[10px] px-2 py-2 text-xs font-semibold text-text-3 transition-colors hover:text-text"
      >
        <span>{t('ranking.carnet.editar')}</span>
        <span>{editorOpen ? '▴' : '▾'}</span>
      </button>

      {editorOpen ? (
        <div className="mt-2 space-y-3 rounded-[14px] border border-line bg-surface p-3.5">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text-3">{t('ranking.carnet.zonasLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              {QUITO_ZONES.map((zone) => {
                const selected = zonesDraft.includes(zone.key);
                const disabled = !selected && zonesDraft.length >= 3;
                return (
                  <button
                    key={zone.key}
                    disabled={disabled}
                    onClick={() => setZonesDraft((prev) => (selected ? prev.filter((z) => z !== zone.key) : [...prev, zone.key]))}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      selected
                        ? 'border-[rgba(45,212,191,0.4)] bg-[rgba(45,212,191,0.14)] text-[#2dd4bf]'
                        : disabled
                          ? 'cursor-not-allowed border-line text-text-3'
                          : 'border-line text-text-2 hover:text-text'
                    }`}
                  >
                    {lang === 'es' ? zone.labelEs : zone.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-text-3">{t('ranking.carnet.experienciaLabel')}</p>
            <input
              type="number"
              min={0}
              max={70}
              value={yearsExpDraft}
              onChange={(e) => setYearsExpDraft(e.target.value)}
              placeholder={t('ranking.carnet.experienciaPlaceholder')}
              className="w-full rounded-[10px] border border-line bg-surface p-2.5 text-[12.5px] text-text placeholder:text-text-3 focus:border-[rgba(45,212,191,0.4)] focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-text-3">{t('ranking.carnet.experienciaAyuda')}</p>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-text-3">{t('ranking.carnet.mensajeLabel')}</p>
            <textarea
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value.slice(0, 220))}
              maxLength={220}
              rows={3}
              placeholder={defaultMessagePreview}
              className="w-full resize-none rounded-[10px] border border-line bg-surface p-2.5 text-[12.5px] text-text placeholder:text-text-3 focus:border-[rgba(45,212,191,0.4)] focus:outline-none"
            />
            <p className="mt-1 flex items-center justify-between text-[10px] text-text-3">
              <span>{t('ranking.carnet.mensajeAyuda')}</span>
              <span>{messageDraft.length}/220</span>
            </p>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full rounded-[10px] bg-[#2dd4bf] py-2.5 text-sm font-bold text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t('ranking.carnet.guardando') : t('ranking.carnet.guardar')}
          </button>
          {saveMsg ? <p className="text-center text-xs text-[#2dd4bf]">{saveMsg}</p> : null}
        </div>
      ) : null}

      {shareOpen ? <CarnetShareModal data={cardData} lang={lang} t={t} onClose={() => setShareOpen(false)} /> : null}
    </section>
  );
}

// Leyenda de niveles (seccion 5.3): un agente nuevo debe entender el sistema
// de niveles con solo mirar esta fila, sin tener que preguntar. En movil se
// apila a una columna para que ningun nombre se trunque (seccion 5.2); desde
// "sm" hay espacio de sobra para las 5 columnas.
function LevelLadder({ totalPoints, lang }: { totalPoints: number; lang: 'es' | 'en' }) {
  return (
    <section className="fade-up">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
        {lang === 'es' ? 'Niveles de la Red · a más puntos, más alto subes' : 'Network levels · more points, higher you climb'}
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-5">
        {RANKING_LEVELS.map((lvl) => {
          const reached = totalPoints >= lvl.min;
          const isCurrent = levelForPoints(totalPoints).key === lvl.key;
          const label = lang === 'es' ? lvl.labelEs : lvl.labelEn;
          return (
            <div
              key={lvl.key}
              className={`flex min-w-0 items-center justify-between gap-1 rounded-xl border px-2.5 py-2 text-center transition-colors duration-150 sm:flex-col sm:justify-center sm:py-2.5 ${
                isCurrent ? 'border-brand-line bg-brand-dim' : reached ? 'border-brand-line text-brand' : 'border-line'
              }`}
            >
              <p className={`text-[11px] font-bold sm:truncate ${isCurrent ? 'text-brand' : reached ? 'text-brand' : 'text-text-3'}`}>{label}</p>
              <p className="shrink-0 text-[9.5px] text-text-3 sm:mt-0.5">
                {lvl.min}
                {lvl.max !== Infinity ? `–${lvl.max}` : '+'} {lang === 'es' ? 'pts' : 'pts'}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function rankBadgeClasses(rank: number): string {
  if (rank === 1) return 'border-amber-400/50 bg-amber-400/15 text-amber-300';
  if (rank === 2) return 'border-slate-300/40 bg-slate-300/10 text-slate-200';
  if (rank === 3) return 'border-orange-400/40 bg-orange-400/10 text-orange-300';
  return 'border-line bg-surface-2 text-text-2';
}

function barColorFor(rank: number): string {
  if (rank === 1) return '#f5c044';
  if (rank === 2) return '#c8cfda';
  if (rank === 3) return '#d9985f';
  return 'rgba(167,139,250,0.75)';
}

function TopAgentesList({
  ranking,
  myAgentId,
  t,
  lang,
  limit,
}: {
  ranking: PointsRankingEntry[];
  myAgentId?: string;
  t: (key: string) => string;
  lang: 'es' | 'en';
  limit: number;
}) {
  const visible = ranking.slice(0, limit);
  const myEntry = ranking.find((r) => r.agentId === myAgentId);
  const myEntryInView = visible.some((r) => r.agentId === myAgentId);
  const leaderPoints = ranking[0]?.totalPoints || 1;

  if (ranking.length === 0) {
    return <p className="mt-3 text-xs text-text-3">{t('ranking.sinDatos')}</p>;
  }

  function Row({ entry }: { entry: PointsRankingEntry }) {
    const isMe = entry.agentId === myAgentId;
    const barPct = Math.max(4, Math.min(100, Math.round((entry.totalPoints / leaderPoints) * 100)));
    const levelColor = levelColorFor(entry.level.key);
    const levelLabel = lang === 'es' ? entry.level.labelEs : entry.level.labelEn;
    return (
      <div
        className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-transform duration-200 hover:-translate-y-0.5 ${
          isMe ? 'border border-brand-line bg-gradient-to-r from-[rgba(167,139,250,0.13)] to-transparent' : 'border border-line bg-surface-2'
        }`}
      >
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${rankBadgeClasses(entry.rank)}`}>{entry.rank}</span>
        <AvatarInitials name={entry.displayName} size={32} colorHex={levelColor} photoUrl={entry.photoUrl} />
        <div className="min-w-0 flex-1">
          {/* Nombre y nivel en lineas separadas a proposito (seccion 5.2/5.4):
              el nivel NUNCA se trunca ni compite por espacio con el nombre. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="min-w-0 truncate font-semibold text-text">{entry.displayName}</span>
            {isMe ? (
              <span className="shrink-0 rounded-full bg-brand-dim px-2 py-0.5 text-[9px] font-bold text-brand">{t('ranking.tu').toUpperCase()}</span>
            ) : null}
          </div>
          <span
            className="mt-0.5 inline-block rounded-full border px-1.5 py-[1px] text-[10px] font-bold leading-tight"
            style={{ color: levelColor, borderColor: `${levelColor}55`, backgroundColor: `${levelColor}1a` }}
          >
            {levelLabel}
          </span>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${barPct}%`, backgroundColor: barColorFor(entry.rank) }} />
          </div>
        </div>
        <span className="shrink-0 text-sm font-bold text-brand">{entry.totalPoints}</span>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {visible.map((entry) => (
        <Row key={entry.agentId} entry={entry} />
      ))}
      {myEntry && !myEntryInView ? (
        <>
          <p className="py-1 text-center text-xs text-text-3">···</p>
          <Row entry={myEntry} />
        </>
      ) : null}
    </div>
  );
}

type PointsGridEntry = { label: string; points: number };

function PointsGrid({ t, lang }: { t: (k: string) => string; lang: 'es' | 'en' }) {
  const label = (key: keyof typeof POINT_ACTIONS) => (lang === 'es' ? POINT_ACTIONS[key].labelEs : POINT_ACTIONS[key].labelEn);

  const featured = POINT_ACTIONS.CLOSING_REGISTERED;
  const diaria: PointsGridEntry[] = [
    { label: label('MATCH_RECEIVED'), points: POINT_ACTIONS.MATCH_RECEIVED.points },
    { label: label('VISIT_SCHEDULED'), points: POINT_ACTIONS.VISIT_SCHEDULED.points },
    { label: label('MATCH_CONTACTED'), points: POINT_ACTIONS.MATCH_CONTACTED.points },
    { label: t('ranking.puntosGrid.cargarInventario'), points: POINT_ACTIONS.LISTING_CREATED.points },
  ];
  const bonos: PointsGridEntry[] = [
    { label: label('STREAK_3_MONTHS_BONUS'), points: POINT_ACTIONS.STREAK_3_MONTHS_BONUS.points },
    { label: label('FIRST_MATCH_OF_MONTH_BONUS'), points: POINT_ACTIONS.FIRST_MATCH_OF_MONTH_BONUS.points },
    { label: label('PROFILE_COMPLETE'), points: POINT_ACTIONS.PROFILE_COMPLETE.points },
    { label: label('LISTING_PHOTO_ADDED'), points: POINT_ACTIONS.LISTING_PHOTO_ADDED.points },
  ];
  const red: PointsGridEntry[] = [
    { label: label('REFERRAL_SIGNUP'), points: POINT_ACTIONS.REFERRAL_SIGNUP.points },
    { label: label('REFERRAL_ACTIVATED_BONUS'), points: POINT_ACTIONS.REFERRAL_ACTIVATED_BONUS.points },
  ];

  function Category({ title, entries }: { title: string; entries: PointsGridEntry[] }) {
    return (
      <div>
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-3">{title}</p>
        <div className="grid grid-cols-2 gap-2">
          {entries.map((entry) => (
            <div key={entry.label} className="min-w-0 rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-base font-extrabold text-brand">+{entry.points}</p>
              <p className="mt-0.5 text-xs leading-snug text-text-2">{entry.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="fade-up glass-card space-y-5 rounded-[1.8rem] p-4 sm:p-6">
      <div>
        <SectionHeading icon={<span className="text-[15px]">&#8853;</span>} title={t('ranking.puntosGrid.title')} />
        <p className="mt-1.5 text-sm text-text-2">{t('ranking.puntosGrid.subtitle')}</p>
      </div>

      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-brand-line bg-brand-dim p-3.5">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-brand-dim text-brand">
          <IconTarget className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{lang === 'es' ? featured.labelEs : featured.labelEn}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.07em] text-brand">{t('ranking.puntosGrid.destacada')}</p>
        </div>
        <span className="shrink-0 text-[19px] font-extrabold text-brand">+{featured.points}</span>
      </div>

      <Category title={t('ranking.puntosGrid.categoria.diaria')} entries={diaria} />
      <Category title={t('ranking.puntosGrid.categoria.bonos')} entries={bonos} />
      <Category title={t('ranking.puntosGrid.categoria.red')} entries={red} />
    </section>
  );
}

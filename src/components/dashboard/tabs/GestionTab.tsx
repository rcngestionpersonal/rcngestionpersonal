'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { ProgressRing } from '../CardKit';
import { IconBell, IconClipboard, IconHouse, IconPhoneCheck, IconStar, IconTarget, IconTrophy } from '../icons';
import { evaluateNextPlay, type NextPlayInput, type NextPlayState } from '@/lib/real-estate/next-play';
import { POINT_ACTIONS, levelColorFor, levelForPoints, nextLevelForPoints, progressWithinLevel, type PointActionKey } from '@/lib/real-estate/points';
import type {
  AgentDashboardBreakdown,
  AgentItem,
  AgentStatEntry,
  DashboardMetrics,
  DashboardTab,
  PlatformStats,
  PointsHistoryEntryClient,
  PointsRankingEntry,
  PointsSummaryClient,
  RecentClosedDeal,
  TopZone,
} from '../types';

type CommonProps = {
  recentClosedDeals: RecentClosedDeal[];
};

export default function GestionTab(
  props: CommonProps & {
    isAdmin: boolean;
    isAgent: boolean;
    myAgentId?: string;
    myAgent?: AgentItem;
    metrics: DashboardMetrics | null;
    topZones: TopZone[];
    mrrEstimate: number;
    bootstrapDemo: () => void;
    bootstrapping: boolean;
    platformStats?: PlatformStats | null;
    myPoints: PointsSummaryClient | null;
    agentBreakdown: AgentDashboardBreakdown;
    pointsRanking: PointsRankingEntry[];
    nextPlayInput: NextPlayInput;
    onNavigateTab: (tab: DashboardTab) => void;
    onGoToCarnet?: () => void;
  },
) {
  if (props.isAgent) {
    return (
      <AgentGestionView
        myAgent={props.myAgent}
        recentClosedDeals={props.recentClosedDeals}
        myPoints={props.myPoints}
        agentBreakdown={props.agentBreakdown}
        pointsRanking={props.pointsRanking}
        myAgentId={props.myAgentId}
        nextPlayInput={props.nextPlayInput}
        onNavigateTab={props.onNavigateTab}
        onGoToCarnet={props.onGoToCarnet}
      />
    );
  }

  return (
    <AdminGestionView
      recentClosedDeals={props.recentClosedDeals}
      metrics={props.metrics}
      topZones={props.topZones}
      mrrEstimate={props.mrrEstimate}
      bootstrapDemo={props.bootstrapDemo}
      bootstrapping={props.bootstrapping}
      platformStats={props.platformStats}
    />
  );
}

function RecentAchievements({ deals, myAgentId, t, lang }: { deals: RecentClosedDeal[]; myAgentId?: string; t: (k: string) => string; lang: 'es' | 'en' }) {
  const visible = myAgentId ? deals.filter((d) => d.agentIds.includes(myAgentId)) : deals;
  if (visible.length === 0) return null;

  return (
    <section className="fade-up glass-card rounded-[1.8rem] p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-white">
        <IconBell className="h-[18px] w-[18px] text-amber-300" strokeWidth={2} />
        {t('gestion.logros.title')}
      </h2>
      <div className="mt-4 space-y-1.5">
        {visible.map((deal) => (
          <div key={deal.id} className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-amber-100">
              <IconTrophy className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
              <span className="truncate">
                {t('matches.negociacionConcretada')} {deal.agentNames.length > 0 ? `— ${deal.agentNames.join(' ↔ ')}` : ''}
              </span>
            </span>
            <span className="shrink-0 text-xs text-amber-200/70">
              {new Date(deal.closedAt).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function firstNameOf(fullName: string | undefined): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function AgentGestionView({
  myAgent,
  myAgentId,
  recentClosedDeals,
  myPoints,
  agentBreakdown,
  pointsRanking,
  nextPlayInput,
  onNavigateTab,
  onGoToCarnet,
}: CommonProps & {
  myAgent?: AgentItem;
  myAgentId?: string;
  myPoints: PointsSummaryClient | null;
  agentBreakdown: AgentDashboardBreakdown;
  pointsRanking: PointsRankingEntry[];
  nextPlayInput: NextPlayInput;
  onNavigateTab: (tab: DashboardTab) => void;
  onGoToCarnet?: () => void;
}) {
  const { t, lang } = useLanguage();
  const locale = lang === 'es' ? 'es-EC' : 'en-US';
  const totalPoints = myPoints?.totalPoints ?? 0;
  const level = myPoints?.level ?? levelForPoints(0);
  const nextLevel = myPoints?.nextLevel ?? nextLevelForPoints(0);
  const pct = progressWithinLevel(totalPoints, level, nextLevel);
  const myRankEntry = pointsRanking.find((r) => r.agentId === myAgentId);
  const levelLabel = lang === 'es' ? level.labelEs : level.labelEn;
  const nextLevelLabel = nextLevel ? (lang === 'es' ? nextLevel.labelEs : nextLevel.labelEn) : null;

  const now = new Date();
  const todayLabel = capitalize(now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }));
  const brokerSinceLabel = myAgent?.createdAt
    ? capitalize(new Date(myAgent.createdAt).toLocaleDateString(locale, { month: 'long', year: 'numeric' }))
    : null;

  return (
    <div className="space-y-8">
      <RecentAchievements deals={recentClosedDeals} myAgentId={myAgentId} t={t} lang={lang} />

      {/* Saludo */}
      <div className="min-w-0">
        <h1 className="truncate text-[20px] font-bold tracking-[-0.01em] text-[#f0f1f7]">
          {t('gestion.saludo.hola')}, {firstNameOf(myAgent?.fullName)}
        </h1>
        <p className="mt-1 text-[13px] text-[#62667f]">
          {todayLabel}
          {brokerSinceLabel ? ` · ${t('gestion.saludo.brokerDesde')} ${brokerSinceLabel}` : null}
        </p>
      </div>

      {/* Hero con anillo de progreso */}
      <section className="fade-up glass-card rounded-[1.8rem] p-4 sm:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <ProgressRing
            pct={pct}
            totalPoints={totalPoints}
            ariaLabel={
              nextLevel
                ? `${totalPoints} ${t('ranking.puntos')}, ${pct}% ${t('common.para')} ${nextLevelLabel}`
                : `${totalPoints} ${t('ranking.puntos')}, ${t('puntos.nivelMaximo')}`
            }
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold" style={{ borderColor: `${levelColorFor(level.key)}55`, background: `${levelColorFor(level.key)}1f`, color: levelColorFor(level.key) }}>
                {levelLabel}
              </span>
              {myRankEntry ? (
                <span className="inline-flex items-center rounded-full border border-[rgba(167,139,250,0.42)] bg-[rgba(167,139,250,0.13)] px-2.5 py-1 text-xs font-bold text-[#b7a5ff]">
                  #{myRankEntry.rank} {t('ranking.de')} {pointsRanking.length}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-[#9296b0]">
              {nextLevel ? (
                <>
                  {t('gestion.hero.faltanPrefix')} <strong className="font-bold text-[#f0f1f7]">{nextLevel.min - totalPoints} pts</strong>{' '}
                  {t('gestion.hero.faltanMiddle')} <strong className="font-bold text-[#f0f1f7]">{nextLevelLabel}</strong> {t('gestion.hero.faltanSuffix')}
                </>
              ) : (
                t('gestion.hero.nivelMaximoRed')
              )}
            </p>
            <div className="mt-3 flex flex-col items-center gap-1.5 sm:flex-row sm:items-center sm:gap-3.5 sm:justify-start">
              <button onClick={() => onNavigateTab('ranking')} className="text-[12.5px] font-bold text-[#b7a5ff] transition-colors hover:text-[#d5c9ff]">
                {t('gestion.hero.verRanking')} →
              </button>
              {onGoToCarnet ? (
                <button onClick={onGoToCarnet} className="text-[12.5px] font-bold text-[#2dd4bf] transition-colors hover:text-[#5eead4]">
                  {t('gestion.hero.verMiCarnet')} →
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <NextPlayCard input={nextPlayInput} t={t} lang={lang} onNavigateTab={onNavigateTab} />

      <TuOperacion agentBreakdown={agentBreakdown} nextPlayInput={nextPlayInput} t={t} onNavigateTab={onNavigateTab} />

      <TuSemana events={myPoints?.recentEvents ?? []} lang={lang} t={t} />
    </div>
  );
}

function NextPlayCard({
  input,
  t,
  lang,
  onNavigateTab,
}: {
  input: NextPlayInput;
  t: (k: string) => string;
  lang: 'es' | 'en';
  onNavigateTab: (tab: DashboardTab) => void;
}) {
  const state: NextPlayState = evaluateNextPlay(input);

  let title = '';
  let subtitle = '';
  let ctaLabel: string | null = null;
  let ctaPoints: number | null = null;
  let perUnit = false;
  let targetTab: DashboardTab | null = null;

  switch (state.kind) {
    case 'UNCONTACTED_MATCHES': {
      title = t('gestion.nextplay.uncontacted.title').replace('{n}', String(state.count));
      const namesText = state.names.length > 0 ? state.names.slice(0, 2).join(lang === 'es' ? ' y ' : ' and ') : lang === 'es' ? 'Tus contactos' : 'Your contacts';
      subtitle = t('gestion.nextplay.uncontacted.sub').replace('{names}', namesText);
      ctaLabel = t('gestion.nextplay.uncontacted.cta');
      ctaPoints = POINT_ACTIONS.MATCH_CONTACTED.points;
      perUnit = true;
      targetTab = 'matches';
      break;
    }
    case 'NO_CLOSINGS':
      title = t('gestion.nextplay.noClosings.title');
      subtitle = t('gestion.nextplay.noClosings.sub');
      ctaLabel = t('gestion.nextplay.noClosings.cta');
      ctaPoints = POINT_ACTIONS.CLOSING_REGISTERED.points;
      targetTab = 'cierres';
      break;
    case 'NO_INVENTORY':
      title = t('gestion.nextplay.noInventory.title');
      subtitle = t('gestion.nextplay.noInventory.sub');
      ctaLabel = t('gestion.nextplay.noInventory.cta');
      ctaPoints = POINT_ACTIONS.LISTING_CREATED.points;
      targetTab = 'inmuebles';
      break;
    case 'STALLED_FOLLOWUPS':
      title = t('gestion.nextplay.stalled.title');
      subtitle = t('gestion.nextplay.stalled.sub');
      ctaLabel = t('gestion.nextplay.stalled.cta');
      targetTab = 'matches';
      break;
    case 'NO_REFERRALS':
      title = t('gestion.nextplay.noReferrals.title');
      subtitle = t('gestion.nextplay.noReferrals.sub');
      ctaLabel = t('gestion.nextplay.noReferrals.cta');
      ctaPoints = POINT_ACTIONS.REFERRAL_SIGNUP.points;
      targetTab = 'invitar';
      break;
    case 'ALL_CAUGHT_UP':
      title = t('gestion.nextplay.allCaughtUp.title');
      subtitle = t('gestion.nextplay.allCaughtUp.sub');
      break;
  }

  return (
    <section
      className="fade-up rounded-[18px] border p-4 sm:p-5"
      style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(109,40,217,0.06))', borderColor: 'rgba(167,139,250,0.42)' }}
    >
      <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#b7a5ff]">
        <span>&#10022;</span> {t('gestion.nextplay.label')}
      </p>
      <h3 className="mt-1.5 min-w-0 text-[17.5px] font-extrabold text-[#f0f1f7]">{title}</h3>
      <p className="mt-1 min-w-0 text-[13px] text-[#9296b0]">{subtitle}</p>
      {ctaLabel && targetTab ? (
        <button
          onClick={() => onNavigateTab(targetTab as DashboardTab)}
          className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] px-4 py-2.5 text-sm font-bold text-white transition-[filter] duration-150 hover:brightness-[1.08]"
        >
          {ctaLabel}
          {ctaPoints ? (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
              +{ctaPoints}
              {perUnit ? ` ${t('gestion.nextplay.perUnit')}` : ''}
            </span>
          ) : null}
        </button>
      ) : null}
    </section>
  );
}

const OPERACION_ITEM_LIMIT = 6;

function TuOperacion({
  agentBreakdown,
  nextPlayInput,
  t,
  onNavigateTab,
}: {
  agentBreakdown: AgentDashboardBreakdown;
  nextPlayInput: NextPlayInput;
  t: (k: string) => string;
  onNavigateTab: (tab: DashboardTab) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Seguimientos "al dia" vs "por gestionar" (item 7.4): reutiliza los mismos
  // conteos de Tu Proxima Jugada en vez de recalcular una nueva nocion de
  // "pendiente" - un match sin contactar o estancado cuenta como "por gestionar".
  const porGestionar = nextPlayInput.uncontactedMatchesCount + nextPlayInput.stalledFollowUpsCount;
  const alDia = Math.max(0, agentBreakdown.matches.total - porGestionar);

  const rows: Array<{
    key: string;
    icon: ReactNode;
    label: string;
    value: number;
    tab: DashboardTab;
    pointsIfZero?: number;
    expandable: boolean;
  }> = [
    { key: 'inmuebles', icon: <IconHouse className="h-4 w-4" />, label: t('gestion.operacion.inmuebles'), value: agentBreakdown.inmuebles.total, tab: 'inmuebles', pointsIfZero: POINT_ACTIONS.LISTING_CREATED.points, expandable: true },
    { key: 'pedidos', icon: <IconClipboard className="h-4 w-4" />, label: t('gestion.operacion.pedidos'), value: agentBreakdown.pedidos.total, tab: 'pedidos', pointsIfZero: POINT_ACTIONS.PEDIDO_CREATED.points, expandable: true },
    { key: 'matches', icon: <IconStar className="h-4 w-4" />, label: t('gestion.operacion.matches'), value: agentBreakdown.matches.total, tab: 'matches', expandable: true },
    { key: 'seguimientos', icon: <IconPhoneCheck className="h-4 w-4" />, label: t('gestion.operacion.seguimientos'), value: agentBreakdown.seguimientos.total, tab: 'matches', expandable: true },
    { key: 'cierres', icon: <IconTarget className="h-4 w-4" />, label: t('gestion.operacion.cierres'), value: agentBreakdown.mapaPreciosTotal, tab: 'cierres', pointsIfZero: POINT_ACTIONS.CLOSING_REGISTERED.points, expandable: false },
  ];

  function itemsFor(key: string): Array<{ id: string; label: string }> {
    if (key === 'inmuebles') return agentBreakdown.inmuebles.items;
    if (key === 'pedidos') return agentBreakdown.pedidos.items;
    if (key === 'matches') return agentBreakdown.matches.items;
    return [];
  }

  return (
    <section className="fade-up">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#62667f]">{t('gestion.operacion.title')}</p>
      <div className="min-w-0 divide-y divide-[rgba(255,255,255,0.07)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#171429]">
        {rows.map((row) => {
          const isOpen = expanded === row.key;
          const items = itemsFor(row.key);
          return (
            <div key={row.key}>
              <button
                onClick={() => (row.expandable ? setExpanded(isOpen ? null : row.key) : onNavigateTab(row.tab))}
                aria-expanded={row.expandable ? isOpen : undefined}
                className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-white/[0.03]"
              >
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(167,139,250,0.13)] text-[#b7a5ff]">{row.icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#f0f1f7]">{row.label}</span>
                {row.value === 0 && row.pointsIfZero ? (
                  <span className="shrink-0 rounded-full bg-[rgba(167,139,250,0.13)] px-2 py-0.5 text-[10px] font-bold text-[#b7a5ff]">+{row.pointsIfZero} pts</span>
                ) : null}
                <span className={`shrink-0 text-[17px] font-extrabold ${row.value === 0 ? 'text-[#62667f]' : 'text-[#f0f1f7]'}`}>{row.value}</span>
                <span
                  className={`shrink-0 text-[#62667f] ${row.expandable ? 'text-xs transition-transform duration-200 motion-reduce:transition-none' : ''} ${isOpen ? 'rotate-180' : ''}`}
                >
                  {row.expandable ? '▼' : '→'}
                </span>
              </button>

              {isOpen && row.key === 'seguimientos' ? (
                <div className="fade-up space-y-1.5 px-4 pb-3.5 pl-[46px]">
                  <p className="text-[13px] text-[#9296b0]">
                    <span className="font-bold text-[#2dd4bf]">{alDia}</span> {t('gestion.operacion.seguimientosAlDia')}
                  </p>
                  <p className="text-[13px] text-[#9296b0]">
                    <span className="font-bold text-[#b7a5ff]">{porGestionar}</span> {t('gestion.operacion.seguimientosPorGestionar')}
                  </p>
                </div>
              ) : isOpen ? (
                <div className="fade-up space-y-1 px-4 pb-3.5 pl-[46px]">
                  {items.length === 0 ? (
                    <p className="text-[13px] text-[#62667f]">{t('gestion.operacion.sinItems')}</p>
                  ) : (
                    <>
                      {items.slice(0, OPERACION_ITEM_LIMIT).map((item) => (
                        <p key={item.id} className="truncate text-[13px] text-[#9296b0]">
                          {item.label}
                        </p>
                      ))}
                      {items.length > OPERACION_ITEM_LIMIT ? (
                        <button onClick={() => onNavigateTab(row.tab)} className="text-[12.5px] font-semibold text-[#b7a5ff] hover:text-[#d5c9ff]">
                          +{items.length - OPERACION_ITEM_LIMIT} {t('gestion.operacion.masVerTodo')}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function TuSemana({ events, lang, t }: { events: PointsHistoryEntryClient[]; lang: 'es' | 'en'; t: (k: string) => string }) {
  const locale = lang === 'es' ? 'es-EC' : 'en-US';

  const { days, weekTotal, hasMore } = useMemo(() => {
    const cutoff = Date.now() - WEEK_MS;
    const withinWeek = events.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
    const weekTotal = withinWeek.reduce((sum, e) => sum + e.points, 0);

    const byDay = new Map<string, PointsHistoryEntryClient[]>();
    for (const e of withinWeek) {
      const dayKey = new Date(e.createdAt).toISOString().slice(0, 10);
      if (!byDay.has(dayKey)) byDay.set(dayKey, []);
      byDay.get(dayKey)!.push(e);
    }

    const days = [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dayKey, dayEvents]) => {
        // Agrupa acciones repetidas del mismo tipo el mismo dia (ej. "Recibiste un
        // match x3 - +75") en vez de listar cada evento individual.
        const grouped = new Map<PointActionKey, { count: number; points: number }>();
        for (const e of dayEvents) {
          const prev = grouped.get(e.eventType) ?? { count: 0, points: 0 };
          grouped.set(e.eventType, { count: prev.count + 1, points: prev.points + e.points });
        }
        return { dayKey, date: new Date(`${dayKey}T12:00:00Z`), actions: [...grouped.entries()] };
      });

    return { days, weekTotal, hasMore: events.length > withinWeek.length };
  }, [events]);

  return (
    <section className="fade-up">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[19px] font-extrabold text-[#f0f1f7]">{t('gestion.semana.title')}</h2>
        <span className="shrink-0 text-sm font-bold text-[#b7a5ff]">+{weekTotal} pts</span>
      </div>
      <p className="mt-0.5 text-[13px] text-[#9296b0]">{t('gestion.semana.subtitle')}</p>

      {days.length === 0 ? (
        <p className="mt-4 text-sm text-[#62667f]">{t('gestion.semana.sinActividad')}</p>
      ) : (
        <div className="relative mt-5 space-y-5 pl-5">
          <div className="absolute bottom-0 left-[3.5px] top-1 w-[2px] bg-gradient-to-b from-[#b7a5ff] to-transparent" />
          {days.map(({ dayKey, date, actions }) => (
            <div key={dayKey} className="relative">
              <span className="absolute -left-5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#b7a5ff] bg-[#0d0b18]" />
              <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#9296b0]">
                {capitalize(date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }))}
              </p>
              <div className="mt-1.5 space-y-1">
                {actions.map(([eventType, { count, points }]) => {
                  const def = POINT_ACTIONS[eventType];
                  const featured = eventType === 'CLOSING_REGISTERED' || Boolean(def?.bonus);
                  const label = def ? (lang === 'es' ? def.pastLabelEs : def.pastLabelEn) : eventType;
                  return (
                    <div key={eventType} className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full ${featured ? 'h-1.5 w-1.5 bg-[#b7a5ff]' : 'h-1 w-1 bg-[#62667f]'}`} />
                      <span className={`min-w-0 flex-1 truncate font-semibold ${featured ? 'text-[15px] text-[#f0f1f7]' : 'text-[13.5px] text-[#9296b0]'}`}>
                        {label}
                        {count > 1 ? ` ×${count}` : ''}
                      </span>
                      <span className="shrink-0 text-sm font-bold text-[#b7a5ff]">+{points}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore ? (
        <button className="mt-4 text-sm font-bold text-[#b7a5ff] transition-colors hover:text-[#d5c9ff]">{t('gestion.semana.verTodo')} →</button>
      ) : null}
    </section>
  );
}

function AdminGestionView({
  recentClosedDeals,
  metrics,
  topZones,
  mrrEstimate,
  bootstrapDemo,
  bootstrapping,
  platformStats,
}: CommonProps & {
  metrics: DashboardMetrics | null;
  topZones: TopZone[];
  mrrEstimate: number;
  bootstrapDemo: () => void;
  bootstrapping: boolean;
  platformStats?: PlatformStats | null;
}) {
  const { t, lang } = useLanguage();

  return (
    <div className="space-y-10">
      <section className="fade-up text-white">
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[1.25fr,1fr] lg:items-end">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">{t('brand.name')}</p>
            <h1 className="text-2xl font-bold leading-tight text-white sm:text-4xl">{t('resumen.hero.title.admin')}</h1>
            <p className="max-w-2xl text-xs text-[#9296b0] sm:text-base">{t('resumen.hero.subtitle.admin')}</p>
          </div>
          <div className="grid gap-3 rounded-3xl p-4 sm:p-5">
            <MetricLite label={t('metric.agentesActivos')} value={metrics?.activeAgents ?? 0} />
            <MetricLite label={t('metric.mrr')} value={`$${mrrEstimate.toFixed(2)}`} />
          </div>
        </div>
      </section>

      <section className="fade-up -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4" style={{ animationDelay: '80ms' }}>
        <KpiCard label={t('kpi.tasaRespuesta.title')} value={`${metrics?.responseRate ?? 0}%`} detail={t('kpi.tasaRespuesta.detail')} tone="emerald" />
        <KpiCard label={t('kpi.coincidenciasActivas.title')} value={String(metrics?.activeMatches ?? 0)} detail={t('kpi.coincidenciasActivas.detail')} tone="violet" />
        <KpiCard label={t('kpi.trials.title')} value={String(metrics?.trialAgents ?? 0)} detail={t('kpi.trials.detail')} tone="cyan" />
        <KpiCard label={t('kpi.suscriptores.title')} value={String(metrics?.paidAgents ?? 0)} detail={t('kpi.suscriptores.detail')} tone="pink" />
      </section>

      <RecentAchievements deals={recentClosedDeals} t={t} lang={lang} />

      <section className="grid gap-6 lg:grid-cols-2 fade-up" style={{ animationDelay: '120ms' }}>
        <div className="glass-card rounded-[1.8rem] p-4 sm:p-6">
          <h2 className="text-xl font-bold text-white">{t('resumen.topZonas.title')}</h2>
          <div className="mt-4 space-y-2">
            {topZones.length === 0 && <p className="text-sm text-white/50">{t('resumen.topZonas.empty')}</p>}
            {topZones.map((zone) => (
              <div key={zone.city} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-white/80">
                <span>{zone.city}</span>
                <span className="font-semibold text-cyan-300">{zone._count.city}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-[1.8rem] p-4 sm:p-6">
          <h2 className="text-xl font-bold text-white">{t('resumen.onboarding.title')}</h2>
          <p className="mt-2 text-sm text-white/60">{t('resumen.onboarding.detail')}</p>
          <button
            onClick={bootstrapDemo}
            disabled={bootstrapping}
            className="gradient-btn mt-4 w-full rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bootstrapping ? t('resumen.onboarding.buttonLoading') : t('resumen.onboarding.button')}
          </button>
        </div>
      </section>

      {platformStats ? (
        <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6" style={{ animationDelay: '200ms' }}>
          <h2 className="text-xl font-bold text-white">{t('stats.title')}</h2>
          <p className="mt-1 text-sm text-white/60">{t('stats.subtitle')}</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatLeaderboard title={t('stats.masInmuebles')} entries={platformStats.masInmuebles} suffix="" />
            <StatLeaderboard title={t('stats.masPedidos')} entries={platformStats.masPedidos} suffix="" />
            <StatLeaderboard title={t('stats.masVisitas')} entries={platformStats.masVisitas} suffix="" />
            <StatLeaderboard title={t('stats.masCierres')} entries={platformStats.masCierres} suffix="" />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">{t('stats.masRapidoInfo')}</p>
              <div className="mt-2 space-y-1.5">
                {platformStats.masRapidoInfo.length === 0 ? (
                  <p className="text-xs text-white/40">{t('stats.sinDatos')}</p>
                ) : (
                  platformStats.masRapidoInfo.map((entry, idx) => (
                    <div key={entry.agentId} className="flex items-center justify-between text-sm text-white/80">
                      <span>{idx + 1}. {entry.agentName}</span>
                      <span className="font-semibold text-cyan-300">{entry.avgHours.toFixed(1)}h</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">{t('stats.masMapaPrecios')}</p>
              <p className="mt-2 text-2xl font-bold text-white">{platformStats.totalClosedDeals}</p>
              <p className="mt-1 text-xs text-white/40">{t('stats.mapaPreciosNota')}</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatLeaderboard({ title, entries, suffix }: { title: string; entries: AgentStatEntry[]; suffix: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">{title}</p>
      <div className="mt-2 space-y-1.5">
        {entries.length === 0 ? (
          <p className="text-xs text-white/40">Sin datos suficientes.</p>
        ) : (
          entries.map((entry, idx) => (
            <div key={entry.agentId} className="flex items-center justify-between text-sm text-white/80">
              <span>{idx + 1}. {entry.agentName}</span>
              <span className="font-semibold text-cyan-300">{entry.value}{suffix}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MetricLite({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold text-cyan-300">{value}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'emerald' | 'violet' | 'cyan' | 'pink';
}) {
  const toneMap: Record<typeof tone, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300',
    violet: 'bg-violet-500/10 border-violet-400/30 text-violet-300',
    cyan: 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300',
    pink: 'bg-pink-500/10 border-pink-400/30 text-pink-300',
  };

  return (
    <article className={`min-w-[220px] snap-start rounded-[1.5rem] border p-4 backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 sm:min-w-0 ${toneMap[tone]}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-white/50">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/50">{detail}</p>
    </article>
  );
}

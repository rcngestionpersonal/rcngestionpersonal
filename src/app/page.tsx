'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import GestionTab from '@/components/dashboard/tabs/GestionTab';
import RankingTab from '@/components/dashboard/tabs/RankingTab';
import SuscripcionTab from '@/components/dashboard/tabs/SuscripcionTab';
import InmueblesTab, { type NewListingInput } from '@/components/dashboard/tabs/InmueblesTab';
import PedidosTab, { type NewOpportunityInput } from '@/components/dashboard/tabs/PedidosTab';
import MatchesTab from '@/components/dashboard/tabs/MatchesTab';
import CierresTab from '@/components/dashboard/tabs/CierresTab';
import type { NewClosedDealInput } from '@/components/dashboard/tabs/CierreFormPanel';
import InvitarTab from '@/components/dashboard/tabs/InvitarTab';
import MetricasTab from '@/components/dashboard/tabs/MetricasTab';
import LevelUpCelebrationModal from '@/components/dashboard/LevelUpCelebrationModal';
import NoEmailBanner from '@/components/dashboard/NoEmailBanner';
import NoAddressBanner from '@/components/dashboard/NoAddressBanner';
import PriceChangeNoticeBanner from '@/components/dashboard/PriceChangeNoticeBanner';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageProvider';
import type { NextPlayInput } from '@/lib/real-estate/next-play';
import { daysRemaining, resolveEffectiveSubscriptionStatus } from '@/lib/real-estate/subscription-status';
import {
  isAgentVerified,
  type AgentDashboardBreakdown,
  type AgentItem,
  type AuthUser,
  type ChurnMonth,
  type ClosedDealItem,
  type DashboardMetrics,
  type DashboardTab,
  type ListingItem,
  type ListingMatchItem,
  type OpportunityItem,
  type PlatformStats,
  type PointsRankingEntry,
  type PointsSummaryClient,
  type ProgressPatch,
  type RankingLevelClient,
  type RecentClosedDeal,
  type TopZone,
} from '@/components/dashboard/types';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['TRIAL', 'ACTIVE']);

export default function Home() {
  return (
    <LanguageProvider>
      <DashboardPage />
    </LanguageProvider>
  );
}

function DashboardPage() {
  const router = useRouter();
  const { t, tProperty, tOperation, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<DashboardTab>('resumen');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [topZones, setTopZones] = useState<TopZone[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [closedDeals, setClosedDeals] = useState<ClosedDealItem[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [churnMonths, setChurnMonths] = useState<ChurnMonth[] | null>(null);
  const [pointsRanking, setPointsRanking] = useState<PointsRankingEntry[]>([]);
  const [myPoints, setMyPoints] = useState<PointsSummaryClient | null>(null);
  const [carnetSlug, setCarnetSlug] = useState<string | null>(null);
  const [levelUpToCelebrate, setLevelUpToCelebrate] = useState<RankingLevelClient | null>(null);
  const [pendingCarnetAction, setPendingCarnetAction] = useState<'scroll' | 'share' | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [creatingListing, setCreatingListing] = useState(false);
  const [creatingOpportunity, setCreatingOpportunity] = useState(false);
  const [creatingClosedDeal, setCreatingClosedDeal] = useState(false);

  const mrrEstimate = useMemo(() => {
    const paid = metrics?.paidAgents ?? 0;
    return paid * 8.99;
  }, [metrics]);

  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'agent';
  const myAgent = useMemo(() => agents.find((a) => a.id === user?.agentId), [agents, user]);
  const displayName = isAdmin ? t('shell.role.admin') : myAgent?.fullName ?? t('shell.role.agent');
  const myEffectiveStatus = myAgent ? resolveEffectiveSubscriptionStatus(myAgent) : undefined;
  const myAgentActive = Boolean(myEffectiveStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(myEffectiveStatus));
  const myAgentVerified = isAgentVerified(myAgent);
  const canManageInventory = isAdmin || (myAgentActive && myAgentVerified);
  // Indicador persistente de dias de prueba restantes (item 10 del pedido de
  // Payphone/trial) - solo aplica a agentes, nunca al admin.
  const trialInfo = useMemo(() => {
    if (isAdmin || !myAgent) return null;
    if (myEffectiveStatus === 'ACTIVE') return null;
    if (myEffectiveStatus === 'INACTIVE' && myAgent.subscriptionStatus === 'TRIAL') {
      return { daysRemaining: 0, expired: true };
    }
    if (myEffectiveStatus !== 'TRIAL') return null;
    return { daysRemaining: daysRemaining(myAgent.trialEndsAt), expired: false };
  }, [isAdmin, myAgent, myEffectiveStatus]);
  // Oportunidades relevantes para el agente en un sentido amplio (incluye matches de
  // inventario, es decir, pedidos que coincidieron con un inmueble que gestiona). Se usa
  // para Resumen y Matches, donde SI corresponde ver ese cruce.
  const agentOpportunities = useMemo(() => {
    if (user?.role !== 'agent' || !user.agentId) return opportunities;
    return opportunities.filter(
      (op) =>
        op.matches.some((match) => match.agent.id === user.agentId) ||
        op.createdByAgentId === user.agentId ||
        (op.listingMatches ?? []).some(
          (lm) =>
            lm.managingAgentId === user.agentId ||
            lm.referredByAgentId === user.agentId ||
            lm.createdByAgentId === user.agentId,
        ),
    );
  }, [opportunities, user]);
  // Pedidos que son estrictamente del agente: los cargo el, los reclamo, o -si nadie los
  // cargo todavia (lead organico del chat web, sin agente dueno)- coincidieron con su
  // perfil y estan disponibles para reclamar. Un pedido cargado manualmente por OTRO
  // agente nunca debe aparecer aqui, aunque el perfil coincida: ese cruce se ve en
  // Matches (inventario <-> pedido), no en "Tus pedidos".
  const myPedidos = useMemo(() => {
    if (user?.role !== 'agent' || !user.agentId) return opportunities;
    return opportunities.filter(
      (op) =>
        op.createdByAgentId === user.agentId ||
        op.claimedByAgentId === user.agentId ||
        (!op.createdByAgentId && op.matches.some((match) => match.agent.id === user.agentId)),
    );
  }, [opportunities, user]);
  // Desgloses de Resumen (item 5): inmuebles/pedidos/matches por tipo de inmueble y
  // seguimientos por tipo de hito, siempre acotados a la gestion propia del agente.
  const agentBreakdown: AgentDashboardBreakdown = useMemo(() => {
    const empty: AgentDashboardBreakdown = {
      inmuebles: { total: 0, items: [] },
      pedidos: { total: 0, items: [] },
      matches: { total: 0, items: [] },
      seguimientos: { total: 0, byType: [] },
      mapaPreciosTotal: 0,
      listingsActive: 0,
    };
    if (user?.role !== 'agent' || !user.agentId) return empty;
    const myId = user.agentId;

    // Resumen corto por item (tipo, operacion, sector (<=2 palabras), "de [nombre]") en
    // vez de la descripcion completa, para que el desglose de Gestion se lea de un
    // vistazo y no rompa el layout del dashboard (items 7.1-7.3 del pedido).
    const describe = (propertyType: string, operationType: 'SALE' | 'RENT' | 'BOTH') =>
      lang === 'es' ? `${tProperty(propertyType)} en ${tOperation(operationType)}` : `${tProperty(propertyType)} for ${tOperation(operationType)}`;
    const shortSector = (sector?: string) => (sector ? sector.split(/[,–-]/)[0].trim().split(/\s+/).slice(0, 2).join(' ') : undefined);
    const deWord = lang === 'es' ? 'de' : 'from';
    const matchConWord = lang === 'es' ? 'match con agente' : 'match with agent';

    const myListings = listings.filter((l) => l.managingAgentId === myId);
    const inmuebleItems = myListings
      .map((l) => {
        const parts = [describe(l.propertyType, l.operationType), shortSector(l.zone || l.city)].filter(Boolean);
        const label = l.ownerName ? `${parts.join(' · ')} · ${deWord} ${l.ownerName}` : parts.join(' · ');
        return { id: l.id, label };
      })
      .reverse();

    const myOwnPedidos = myPedidos.filter((op) => op.createdByAgentId === myId);
    const pedidoItems = myOwnPedidos
      .map((op) => {
        const parts = [describe(op.propertyType, op.operationType), shortSector(op.zone || op.city)].filter(Boolean);
        const label = op.contactName ? `${parts.join(' · ')} · ${deWord} ${op.contactName}` : parts.join(' · ');
        return { id: op.id, label };
      })
      .reverse();

    // Un detalle mas + nombre del agente por match (tipo, operacion, sector, contraparte),
    // en vez de solo el conteo agregado por tipo de inmueble.
    const matchInfo = new Map<string, { propertyType: string; operationType: 'SALE' | 'RENT' | 'BOTH'; sector?: string; counterpartAgentId?: string }>();
    const accountedForSeguimientos = new Set<string>();
    const seguimientoCounts = new Map<string, number>();
    let seguimientosTotal = 0;

    function noteMatch(
      matchId: string,
      propertyType: string,
      operationType: 'SALE' | 'RENT' | 'BOTH',
      sector: string | undefined,
      counterpartAgentId: string | undefined,
      m: ListingMatchItem,
    ) {
      if (!matchInfo.has(matchId)) matchInfo.set(matchId, { propertyType, operationType, sector, counterpartAgentId });
      if (accountedForSeguimientos.has(matchId)) return;
      accountedForSeguimientos.add(matchId);
      const milestones: Array<[boolean, string]> = [
        [Boolean(m.contactedAt), 'contactado'],
        [Boolean(m.infoSentAt), 'infoEnviada'],
        [Boolean(m.visitFollowUpAt), 'visitaSeguimiento'],
        [Boolean(m.visitScheduledFor), 'visitaAgendada'],
        [Boolean(m.visitCompletedAt), 'visitaCompletada'],
        [Boolean(m.offerInProgressAt), 'enOferta'],
        [m.closedWon != null, 'cerrado'],
      ];
      for (const [hit, key] of milestones) {
        if (!hit) continue;
        seguimientoCounts.set(key, (seguimientoCounts.get(key) ?? 0) + 1);
        seguimientosTotal += 1;
      }
    }

    for (const l of listings) {
      if (l.managingAgentId !== myId) continue;
      for (const m of l.matches ?? []) noteMatch(m.id, l.propertyType, l.operationType, l.zone || l.city, m.createdByAgentId, m);
    }
    for (const op of opportunities) {
      if (op.createdByAgentId !== myId) continue;
      for (const lm of op.listingMatches ?? []) {
        const existing = matchInfo.get(lm.id);
        noteMatch(
          lm.id,
          existing?.propertyType ?? op.propertyType,
          existing?.operationType ?? op.operationType,
          existing?.sector ?? (op.zone || op.city),
          lm.managingAgentId,
          lm,
        );
      }
    }

    const matchItems = [...matchInfo.entries()]
      .map(([id, info]) => {
        const counterpartName = info.counterpartAgentId ? agents.find((a) => a.id === info.counterpartAgentId)?.fullName : undefined;
        const parts = [describe(info.propertyType, info.operationType), shortSector(info.sector)].filter(Boolean);
        const label = counterpartName ? `${parts.join(' · ')} · ${matchConWord} ${counterpartName}` : parts.join(' · ');
        return { id, label };
      })
      .reverse();

    const mapaPreciosTotal = closedDeals.filter((d) => d.canEdit).length;

    const toSegRows = (m: Map<string, number>) =>
      [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

    return {
      inmuebles: { total: myListings.length, items: inmuebleItems },
      pedidos: { total: myOwnPedidos.length, items: pedidoItems },
      matches: { total: matchInfo.size, items: matchItems },
      seguimientos: { total: seguimientosTotal, byType: toSegRows(seguimientoCounts) },
      mapaPreciosTotal,
      listingsActive: myListings.filter((l) => l.status === 'ACTIVE').length,
    };
  }, [user, listings, myPedidos, opportunities, closedDeals, agents, lang, tProperty, tOperation]);

  // Datos para "Tu Proxima Jugada" (evaluador puro en next-play.ts): matches sin
  // contactar, seguimientos estancados (contactado hace +3 dias sin visita/oferta/
  // cierre) y conteo de referidos, ademas de los totales ya calculados arriba.
  const nextPlayInput: NextPlayInput = useMemo(() => {
    const empty: NextPlayInput = {
      uncontactedMatchesCount: 0,
      uncontactedMatchNames: [],
      closingsCount: 0,
      listingsCount: 0,
      pedidosCount: 0,
      stalledFollowUpsCount: 0,
      referralsCount: 0,
    };
    if (user?.role !== 'agent' || !user.agentId) return empty;
    const myId = user.agentId;

    const myMatches: Array<{ match: ListingMatchItem; counterpartAgentId?: string }> = [];
    const seen = new Set<string>();
    for (const l of listings) {
      if (l.managingAgentId !== myId) continue;
      for (const m of l.matches ?? []) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        myMatches.push({ match: m, counterpartAgentId: m.createdByAgentId });
      }
    }
    for (const op of opportunities) {
      if (op.createdByAgentId !== myId) continue;
      for (const lm of op.listingMatches ?? []) {
        if (seen.has(lm.id)) continue;
        seen.add(lm.id);
        myMatches.push({ match: lm, counterpartAgentId: lm.managingAgentId });
      }
    }

    const uncontacted = myMatches.filter(({ match }) => !match.contactedAt);
    const uncontactedMatchNames = [
      ...new Set(
        uncontacted
          .map(({ counterpartAgentId }) => (counterpartAgentId ? agents.find((a) => a.id === counterpartAgentId)?.fullName : undefined))
          .filter((n): n is string => Boolean(n)),
      ),
    ];

    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const stalled = myMatches.filter(({ match }) => {
      if (!match.contactedAt) return false;
      if (match.visitScheduledFor || match.visitCompletedAt || match.offerInProgressAt || match.closedWon != null) return false;
      return Date.now() - new Date(match.contactedAt).getTime() > THREE_DAYS_MS;
    });

    return {
      uncontactedMatchesCount: uncontacted.length,
      uncontactedMatchNames,
      closingsCount: agentBreakdown.mapaPreciosTotal,
      listingsCount: agentBreakdown.inmuebles.total,
      pedidosCount: agentBreakdown.pedidos.total,
      stalledFollowUpsCount: stalled.length,
      referralsCount: agents.filter((a) => a.referredByAgentId === myId).length,
    };
  }, [user, listings, opportunities, agents, agentBreakdown]);

  // Logros recientes ("Negociacion Concretada") para el feed de Gestion y Ranking:
  // se calculan de los mismos datos ya cargados, sin pedir nada nuevo al backend.
  const recentClosedDeals: RecentClosedDeal[] = useMemo(() => {
    const deals: RecentClosedDeal[] = [];
    for (const op of opportunities) {
      for (const lm of op.listingMatches ?? []) {
        if (!lm.closedWon || !lm.closedAt) continue;
        const agentIds = [lm.managingAgentId, lm.createdByAgentId].filter((id): id is string => Boolean(id));
        const agentNames = agentIds
          .map((id) => agents.find((a) => a.id === id)?.fullName)
          .filter((name): name is string => Boolean(name));
        deals.push({
          id: lm.id,
          description: lm.listingTitle ?? lm.listing?.title ?? '',
          agentIds,
          agentNames,
          closedAt: lm.closedAt,
        });
      }
    }
    return deals.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()).slice(0, 8);
  }, [opportunities, agents]);

  useEffect(() => {
    void loadUserAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get('subscription_id');
    if (params.get('billing') === 'success' && subscriptionId) {
      void (async () => {
        try {
          await fetch('/api/real-estate/paypal/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId }),
          });
          await loadData(false);
        } finally {
          window.history.replaceState({}, '', window.location.pathname);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserAndData() {
    setLoading(true);
    setError('');
    try {
      const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
      const meData = await meRes.json();

      if (!meRes.ok) {
        if (meRes.status === 401) {
          router.replace('/login?next=%2F');
          return;
        }
        throw new Error(meData.error ?? 'No se pudo verificar la sesion.');
      }

      setUser(meData.user as AuthUser);
      await loadData(false, (meData.user as AuthUser).role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error no controlado');
    } finally {
      setLoading(false);
    }
  }

  async function loadData(showLoading = true, roleHint?: 'admin' | 'agent') {
    if (showLoading) {
      setLoading(true);
      setError('');
    }
    try {
      // El admin necesita poder resolver el nombre de CUALQUIER agente (por ejemplo
      // en Matches, donde uno de los dos agentes podria no estar activo), asi que
      // solo se filtra a "onlyActive" para el rol agente.
      const agentsQuery = (roleHint ?? user?.role) === 'admin' ? '/api/real-estate/agents' : '/api/real-estate/agents?onlyActive=true';
      const [dashRes, oppRes, agentRes, listingRes, closedDealsRes, pointsRankingRes] = await Promise.all([
        fetch('/api/real-estate/dashboard', { cache: 'no-store' }),
        fetch('/api/real-estate/opportunities?limit=100', { cache: 'no-store' }),
        fetch(agentsQuery, { cache: 'no-store' }),
        fetch('/api/real-estate/listings', { cache: 'no-store' }),
        fetch('/api/real-estate/closed-deals', { cache: 'no-store' }),
        fetch('/api/real-estate/points/ranking', { cache: 'no-store' }),
      ]);

      const dashData = await dashRes.json();
      const oppData = await oppRes.json();
      const agentData = await agentRes.json();
      const listingData = await listingRes.json();

      if (!dashRes.ok || !oppRes.ok || !agentRes.ok || !listingRes.ok) {
        if ([dashRes.status, oppRes.status, agentRes.status, listingRes.status].includes(401)) {
          router.replace('/login?next=%2F');
          return;
        }
        throw new Error(dashData.error ?? oppData.error ?? agentData.error ?? listingData.error ?? 'No se pudo cargar el dashboard.');
      }

      setMetrics(dashData.metrics as DashboardMetrics);
      setTopZones((dashData.topZones ?? []) as TopZone[]);
      setOpportunities((oppData.opportunities ?? []) as OpportunityItem[]);
      setAgents((agentData.agents ?? []) as AgentItem[]);
      setListings((listingData.listings ?? []) as ListingItem[]);

      if (closedDealsRes.ok) {
        const closedDealsData = await closedDealsRes.json();
        setClosedDeals((closedDealsData.deals ?? []) as ClosedDealItem[]);
      } else {
        setClosedDeals([]);
      }

      if (pointsRankingRes.ok) {
        const pointsRankingData = await pointsRankingRes.json();
        setPointsRanking((pointsRankingData.ranking ?? []) as PointsRankingEntry[]);
      } else {
        setPointsRanking([]);
      }

      if ((roleHint ?? user?.role) === 'agent') {
        const pointsRes = await fetch('/api/real-estate/points/me', { cache: 'no-store' });
        if (pointsRes.ok) {
          const pointsData = await pointsRes.json();
          setMyPoints(pointsData.summary as PointsSummaryClient);
          setCarnetSlug((pointsData.carnetSlug as string | null) ?? null);
        }

        const levelUpRes = await fetch('/api/real-estate/points/level-up', { cache: 'no-store' });
        if (levelUpRes.ok) {
          const levelUpData = await levelUpRes.json();
          setLevelUpToCelebrate(levelUpData.levelUp ?? null);
        }
      }

      if ((roleHint ?? user?.role) === 'admin') {
        const statsRes = await fetch('/api/real-estate/stats', { cache: 'no-store' });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setPlatformStats(statsData.stats as PlatformStats);
        }

        const churnRes = await fetch('/api/real-estate/churn', { cache: 'no-store' });
        if (churnRes.ok) {
          const churnData = await churnRes.json();
          setChurnMonths(churnData.months as ChurnMonth[]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error no controlado');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function bootstrapDemo() {
    if (!isAdmin) {
      setError('Solo administradores pueden crear datos demo.');
      return;
    }
    setBootstrapping(true);
    try {
      await fetch('/api/real-estate/bootstrap', { method: 'POST' });
      await loadData();
    } finally {
      setBootstrapping(false);
    }
  }

  async function activateSubscription(agentId: string) {
    setActivating(agentId);
    try {
      const response = await fetch('/api/real-estate/paypal/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo activar la suscripción.');
      }

      if (data.url) {
        window.location.href = data.url as string;
        return;
      }

      await loadData();
      if (data.mode === 'mock') {
        setError('Suscripción activada manualmente (modo demo, sin cobro real).');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error iniciando suscripción');
    } finally {
      setActivating(null);
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  async function createListing(input: NewListingInput): Promise<string | undefined> {
    setCreatingListing(true);
    try {
      const response = await fetch('/api/real-estate/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo cargar el inmueble.');
      }
      await loadData(false);
      return data.listing?.id as string | undefined;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando inmueble');
      return undefined;
    } finally {
      setCreatingListing(false);
    }
  }

  async function updateListing(id: string, input: NewListingInput) {
    try {
      const response = await fetch(`/api/real-estate/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo actualizar el inmueble.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando inmueble');
    }
  }

  async function uploadListingPhoto(listingId: string, photo: Blob): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('photo', photo, 'cover.jpg');
      const response = await fetch(`/api/real-estate/listings/${listingId}/photo`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo subir la foto.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error subiendo la foto');
      throw err;
    }
  }

  async function deleteListing(id: string) {
    try {
      const response = await fetch(`/api/real-estate/listings/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo eliminar el inmueble.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando inmueble');
    }
  }

  async function createOpportunity(input: NewOpportunityInput) {
    setCreatingOpportunity(true);
    try {
      const response = await fetch('/api/real-estate/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo cargar el pedido.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando pedido');
    } finally {
      setCreatingOpportunity(false);
    }
  }

  async function updateOpportunity(id: string, input: NewOpportunityInput) {
    try {
      const response = await fetch(`/api/real-estate/opportunities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo actualizar el pedido.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando pedido');
    }
  }

  async function deleteOpportunity(id: string) {
    try {
      const response = await fetch(`/api/real-estate/opportunities/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo eliminar el pedido.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando pedido');
    }
  }

  async function createClosedDeal(input: NewClosedDealInput) {
    setCreatingClosedDeal(true);
    try {
      const response = await fetch('/api/real-estate/closed-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo registrar el cierre.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error registrando cierre');
    } finally {
      setCreatingClosedDeal(false);
    }
  }

  async function updateClosedDeal(dealId: string, input: NewClosedDealInput) {
    setCreatingClosedDeal(true);
    try {
      const response = await fetch(`/api/real-estate/closed-deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo actualizar el cierre.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando cierre');
    } finally {
      setCreatingClosedDeal(false);
    }
  }

  async function deleteClosedDeal(dealId: string) {
    try {
      const response = await fetch(`/api/real-estate/closed-deals/${dealId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo eliminar el cierre.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando cierre');
    }
  }

  async function updateMatchProgress(matchId: string, patch: ProgressPatch) {
    try {
      const response = await fetch(`/api/real-estate/listing-matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo actualizar el seguimiento.');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando seguimiento');
    }
  }

  function contactMatch(matchId: string) {
    void updateMatchProgress(matchId, { markContacted: true });
  }

  // "Ver mi carnet" (Gestion) y la celebracion de subida de nivel navegan a
  // Ranking y le piden que se desplace (o ademas abra el modal de compartir)
  // apenas monte - RankingTab consume esta senal una sola vez via un efecto.
  function goToCarnet(action: 'scroll' | 'share') {
    setActiveTab('ranking');
    setPendingCarnetAction(action);
  }

  async function dismissLevelUp() {
    const levelKey = levelUpToCelebrate?.key;
    setLevelUpToCelebrate(null);
    if (!levelKey) return;
    try {
      await fetch('/api/real-estate/points/level-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelKey }),
      });
    } catch {
      // no critico: si falla, la celebracion podria repetirse una vez mas
    }
  }

  return (
    <>
      {levelUpToCelebrate && isAgent ? (
        <LevelUpCelebrationModal
          level={levelUpToCelebrate}
          lang={lang}
          t={t}
          subscriptionActive={myAgentActive}
          onShare={() => {
            void dismissLevelUp();
            goToCarnet('share');
          }}
          onViewCarnet={() => {
            void dismissLevelUp();
            goToCarnet('scroll');
          }}
          onDismiss={() => void dismissLevelUp()}
        />
      ) : null}
      <DashboardShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isAdmin={isAdmin}
      displayName={displayName}
      isVerified={myAgentVerified}
      photoUrl={myAgent?.photoUrl}
      onLogout={logout}
      trialInfo={trialInfo}
    >
      {isAgent && myAgent && !myAgent.email && user?.agentId ? (
        <NoEmailBanner agentId={user.agentId} onSaved={() => loadData(false)} />
      ) : null}
      {isAgent && myAgent && !myAgent.direccion && user?.agentId ? <NoAddressBanner agentId={user.agentId} /> : null}
      {isAgent && myAgent && user?.agentId ? <PriceChangeNoticeBanner agentId={user.agentId} /> : null}
      {activeTab === 'resumen' && (
        <GestionTab
          isAdmin={isAdmin}
          isAgent={isAgent}
          metrics={metrics}
          topZones={topZones}
          mrrEstimate={mrrEstimate}
          bootstrapDemo={bootstrapDemo}
          bootstrapping={bootstrapping}
          platformStats={platformStats}
          myPoints={myPoints}
          agentBreakdown={agentBreakdown}
          myAgent={myAgent}
          myAgentId={user?.agentId}
          recentClosedDeals={recentClosedDeals}
          pointsRanking={pointsRanking}
          nextPlayInput={nextPlayInput}
          onNavigateTab={setActiveTab}
          onGoToCarnet={() => goToCarnet('scroll')}
        />
      )}
      {activeTab === 'ranking' && (
        <RankingTab
          isAdmin={isAdmin}
          isAgent={isAgent}
          pointsRanking={pointsRanking}
          myAgentId={user?.agentId}
          myAgent={myAgent}
          myPoints={myPoints}
          agentBreakdown={agentBreakdown}
          carnetSlug={carnetSlug}
          pendingCarnetAction={pendingCarnetAction}
          onConsumePendingCarnetAction={() => setPendingCarnetAction(null)}
          onProfileSaved={() => loadData(false)}
        />
      )}
      {activeTab === 'suscripcion' && (
        <SuscripcionTab
          isAdmin={isAdmin}
          agents={agents}
          myAgentId={user?.agentId}
          activateSubscription={activateSubscription}
          activating={activating}
          onReload={() => loadData(false)}
        />
      )}
      {activeTab === 'inmuebles' && (
        <InmueblesTab
          isAdmin={isAdmin}
          canCreate={canManageInventory}
          listings={listings}
          agents={agents}
          myAgentId={user?.agentId}
          onCreateListing={createListing}
          creating={creatingListing}
          onUpdateListing={updateListing}
          onDeleteListing={deleteListing}
          onUploadPhoto={uploadListingPhoto}
          onGoToMatches={() => setActiveTab('matches')}
        />
      )}
      {activeTab === 'pedidos' && (
        <PedidosTab
          isAdmin={isAdmin}
          canCreate={canManageInventory}
          agentOpportunities={myPedidos}
          agents={agents}
          user={user}
          onCreateOpportunity={createOpportunity}
          creatingOpportunity={creatingOpportunity}
          onUpdateOpportunity={updateOpportunity}
          onDeleteOpportunity={deleteOpportunity}
          onGoToMatches={() => setActiveTab('matches')}
        />
      )}
      {activeTab === 'matches' && (
        <MatchesTab
          isAdmin={isAdmin}
          canAccess={canManageInventory}
          opportunities={agentOpportunities}
          agents={agents}
          myAgentId={user?.agentId}
          onContact={contactMatch}
          onUpdateProgress={updateMatchProgress}
        />
      )}
      {activeTab === 'cierres' && (
        <CierresTab
          canAccess={canManageInventory}
          canCreate={canManageInventory}
          deals={closedDeals}
          myZones={myAgent?.specializationZones}
          onCreateDeal={createClosedDeal}
          onUpdateDeal={updateClosedDeal}
          onDeleteDeal={deleteClosedDeal}
          creating={creatingClosedDeal}
        />
      )}
      {activeTab === 'invitar' && isAgent && <InvitarTab myAgentId={user?.agentId} agents={agents} />}
      {activeTab === 'metricas' && isAdmin && <MetricasTab months={churnMonths} />}

      {loading && (
        <div className="glass-card mt-6 rounded-2xl p-4 text-sm text-text-2">
          {t('common.cargando')}
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-2xl border border-pink-400/30 bg-pink-500/10 p-4 text-sm text-pink-200">
          {error}
        </div>
      )}
      </DashboardShell>
    </>
  );
}

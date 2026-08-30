'use client';

import { useState } from 'react';
import { Download, Trophy } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import MatchTimeline from '../MatchTimeline';
import { Card, ModuleHeader, firstName, pedidoBrief, relativeLabel } from '../CardKit';
import { IconStar, IconWhatsapp } from '../icons';
import FichaDownloadModal from '../FichaDownloadModal';
import type { AccesoInput } from '@/lib/real-estate/access';
import { pointsForMilestoneKey } from '@/lib/real-estate/ranking';
import { isAgentVerified, type AgentItem, type ListingMatchItem, type OpportunityItem, type ProgressPatch } from '../types';

function onlyDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function buildWhatsappLink(phone: string, message: string): string {
  return `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}`;
}

function fmtShortDate(iso: string, lang: 'es' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short' });
}

// Explicacion breve del porcentaje (Fase 8, Bloque B, Parte 3) - las
// "reasons" ya vienen pre-armadas por matching.ts como clausulas listas para
// unir con " · " (lead-in + hasta 2 diferencias + "y N mas" si sobran, o la
// unica clausula "Coincide en todo lo que pediste." cuando es 100%, seccion 3.3).
function matchExplanationLine(reasons?: string[]): string | null {
  if (!reasons || reasons.length === 0) return null;
  return reasons.join(' · ');
}

// Ultima accion de gestion registrada en el match (la mas avanzada de las ya
// marcadas), con su fecha y los puntos que gano especificamente esa accion -
// reemplaza el boton de Contactar una vez que el match ya fue contactado
// (item 10.2 del pedido).
function lastMilestone(
  match: ListingMatchItem,
  t: (k: string) => string,
): { label: string; dateIso: string; points: number } | null {
  if (match.closedWon === true && match.closedAt) {
    return { label: t('timeline.negociacionConcretada'), dateIso: match.closedAt, points: pointsForMilestoneKey('closedWon') };
  }
  if (match.offerInProgressAt) {
    return { label: t('timeline.enOferta'), dateIso: match.offerInProgressAt, points: pointsForMilestoneKey('offerInProgress') };
  }
  if (match.visitCompletedAt) {
    return { label: t('timeline.visitaRealizada'), dateIso: match.visitCompletedAt, points: pointsForMilestoneKey('visitCompleted') };
  }
  if (match.visitScheduledFor) {
    return { label: t('timeline.visitaConfirmada'), dateIso: match.visitScheduledFor, points: pointsForMilestoneKey('visitScheduledFor') };
  }
  if (match.visitFollowUpAt) {
    return { label: t('timeline.seguimientoVisita'), dateIso: match.visitFollowUpAt, points: pointsForMilestoneKey('visitFollowUp') };
  }
  if (match.infoSentAt) {
    return { label: t('timeline.envioInfo'), dateIso: match.infoSentAt, points: pointsForMilestoneKey('infoSent') };
  }
  if (match.contactedAt) {
    return { label: t('matches.contactado'), dateIso: match.contactedAt, points: pointsForMilestoneKey('markContacted') };
  }
  return null;
}

// Badge "✦ MATCH": mismo pill degradado violeta->teal que la vitrina de
// muestra en la landing (login .mbadge) - un solo elemento visual, sin texto
// en gradiente por separado ni anillo extra alrededor.
function MatchBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-grad px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-grad-contrast">
      &#10022; {label}
    </span>
  );
}

// Mitad de la tarjeta de match: mismo concepto que la vitrina de la landing
// (dos "medias tarjetas" + el badge flotando entre ambas) - una por cada lado
// del match, en vez de una lista de datos plana.
function MatchHalf({
  sideLabel,
  title,
  detail,
  name,
  verified,
}: {
  sideLabel: string;
  title: string;
  detail?: string;
  name?: string;
  verified?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">{sideLabel}</span>
        {name ? (
          <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-text-2">
            <span className="truncate">{name}</span>
            {verified ? <span className="shrink-0 text-brand">✓</span> : null}
          </span>
        ) : null}
      </div>
      <p className="mt-1 truncate text-[13.5px] font-semibold text-text">{title}</p>
      {detail ? <p className="mt-0.5 truncate text-[11.5px] text-text-3">{detail}</p> : null}
    </div>
  );
}

export default function MatchesTab({
  isAdmin,
  canAccess,
  opportunities,
  agents,
  myAgentId,
  myAgent,
  onContact,
  onUpdateProgress,
}: {
  isAdmin: boolean;
  canAccess: boolean;
  opportunities: OpportunityItem[];
  agents: AgentItem[];
  myAgentId?: string;
  myAgent?: AgentItem;
  onContact: (matchId: string) => void;
  onUpdateProgress: (matchId: string, patch: ProgressPatch) => void;
}) {
  const { lang, t, tProperty } = useLanguage();
  const [fichaListingId, setFichaListingId] = useState<string | null>(null);
  const accesoInput: AccesoInput | null = myAgent
    ? {
        subscriptionStatus: myAgent.subscriptionStatus,
        trialEndsAt: myAgent.trialEndsAt,
        subscriptionPaidUntil: myAgent.subscriptionPaidUntil,
        plan: myAgent.plan ?? 'BASICO',
      }
    : null;

  if (!isAdmin && !canAccess) {
    return (
      <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
        <h2 className="text-xl font-bold text-text">{t('matches.locked.title')}</h2>
        <p className="mt-2 text-sm text-text-2">{t('matches.locked.detail')}</p>
      </section>
    );
  }

  const listingRows = opportunities
    .flatMap((op) =>
      (op.listingMatches ?? [])
        .filter(
          (lm) =>
            isAdmin ||
            lm.managingAgentId === myAgentId ||
            lm.referredByAgentId === myAgentId ||
            lm.createdByAgentId === myAgentId,
        )
        .map((lm) => ({ opportunity: op, listingMatch: lm })),
    )
    // Orden por compatibilidad descendente (Fase 8, seccion 2.8) - fecha de
    // creacion como desempate entre matches con el mismo porcentaje.
    .sort((a, b) => b.listingMatch.score - a.listingMatch.score || new Date(b.listingMatch.createdAt).getTime() - new Date(a.listingMatch.createdAt).getTime());

  function agentPhone(agentId?: string): string | undefined {
    if (!agentId) return undefined;
    return agents.find((a) => a.id === agentId)?.phone;
  }

  function agentFullName(agentId?: string): string | undefined {
    if (!agentId) return undefined;
    return agents.find((a) => a.id === agentId)?.fullName;
  }

  function agentVerified(agentId?: string): boolean {
    if (!agentId) return false;
    return isAgentVerified(agents.find((a) => a.id === agentId));
  }

  const myName = agentFullName(myAgentId) ?? '';

  return (
    <div className="space-y-10">
      <section>
        <ModuleHeader
          icon={<IconStar className="h-[19px] w-[19px]" strokeWidth={2} />}
          title={isAdmin ? t('admin.matches.title') : t('matches.title')}
          subtitle={t('matches.subtitle')}
        />

        <div className="grid gap-[18px] xl:grid-cols-2">
          {listingRows.length === 0 && <p className="text-sm text-text-2">{t('matches.empty')}</p>}
          {listingRows.map(({ opportunity, listingMatch }) => {
            const amListingSide = !isAdmin && (listingMatch.managingAgentId === myAgentId || listingMatch.referredByAgentId === myAgentId);
            const amRequestSide = !isAdmin && listingMatch.createdByAgentId === myAgentId;

            let counterpartName: string | undefined = agentFullName(listingMatch.createdByAgentId);
            let counterpartPhone: string | undefined = agentPhone(listingMatch.createdByAgentId) ?? opportunity.contactPhone;
            let counterpartVerified = agentVerified(listingMatch.createdByAgentId);
            let myDescription = listingMatch.listingTitle ?? listingMatch.listing?.title ?? '';
            let whatsappMessage =
              lang === 'es'
                ? `👋 Hola ${counterpartName ?? ''}, te saluda ${myName}. Tu pedido hizo match con mi inmueble de "${myDescription}", por favor envíame información. ¡Gracias! 🙌`
                : `👋 Hi ${counterpartName ?? ''}, this is ${myName}. Your request matched my listing "${myDescription}", please send me more information. Thanks! 🙌`;

            if (amRequestSide && !amListingSide) {
              counterpartName = agentFullName(listingMatch.managingAgentId);
              counterpartPhone = agentPhone(listingMatch.managingAgentId);
              counterpartVerified = agentVerified(listingMatch.managingAgentId);
              myDescription = opportunity.summary;
              whatsappMessage =
                lang === 'es'
                  ? `👋 Hola ${counterpartName ?? ''}, te saluda ${myName}. Tu inmueble hizo match con mi pedido de "${myDescription}", por favor envíame información. ¡Gracias! 🙌`
                  : `👋 Hi ${counterpartName ?? ''}, this is ${myName}. Your listing matched my request "${myDescription}", please send me more information. Thanks! 🙌`;
            } else if (isAdmin) {
              counterpartName = agentFullName(listingMatch.createdByAgentId) ?? agentFullName(listingMatch.managingAgentId);
            }

            const responsibleName = agentFullName(listingMatch.createdByAgentId);
            const canEditTimeline = !isAdmin && Boolean(myAgentId) && myAgentId === listingMatch.createdByAgentId;

            // El match solo trae el titulo libre del inmueble (no tipo/operacion
            // estructurados de la contraparte), asi que se muestra tal cual.
            const listingValue = listingMatch.listingTitle ?? listingMatch.listing?.title ?? '—';
            const pedidoValue = pedidoBrief(opportunity, tProperty, t, lang);

            const matchDateLabel = relativeLabel(
              listingMatch.createdAt,
              { today: t('matches.matchHoy'), yesterday: t('matches.matchAyer'), prefix: t('matches.matchDel') },
              lang,
            );
            const lastAction = lastMilestone(listingMatch, t);
            const explanationLine = matchExplanationLine(listingMatch.reasons);

            if (isAdmin) {
              return (
                <Card key={listingMatch.id}>
                  <div className="flex items-center justify-between gap-2">
                    <MatchBadge label={t('matches.badgeMatch')} />
                    <span className="text-right text-[13px] font-semibold text-brand">{listingMatch.score.toFixed(0)}%</span>
                  </div>
                  <p className="mt-3 text-[13.5px] font-semibold text-text">
                    {agentFullName(listingMatch.managingAgentId) ?? '—'}
                    {' ('}{listingMatch.listingTitle ?? listingMatch.listing?.title}{')'}
                    {' ↔ '}
                    {agentFullName(listingMatch.createdByAgentId) ?? 'chat web'}
                    {' ('}{listingMatch.opportunitySummary ?? listingMatch.opportunity?.summary}{')'}
                  </p>
                  {explanationLine ? (
                    <p className="line-clamp-2 pb-3 pt-1 text-[12px] text-text-3">{explanationLine}</p>
                  ) : (
                    <div className="pb-3" />
                  )}
                </Card>
              );
            }

            // Igual que la vitrina de la landing: "mi lado" arriba, el lado de la
            // contraparte abajo (con su nombre + verificado), y el badge de match
            // flotando entre ambas mitades - una sola idea visual, no una lista de datos.
            const topHalf = amListingSide
              ? { sideLabel: t('matches.dataBlock.tuInmueble'), title: listingValue }
              : { sideLabel: t('matches.dataBlock.suInmueble'), title: listingValue, name: counterpartName, verified: counterpartVerified };
            const bottomHalf = amListingSide
              ? { sideLabel: t('matches.dataBlock.suPedido'), title: pedidoValue, name: counterpartName, verified: counterpartVerified }
              : { sideLabel: t('matches.dataBlock.tuPedido'), title: pedidoValue };

            return (
              <Card key={listingMatch.id}>
                {/* Fila 1 */}
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[11px] font-medium text-text-3">{matchDateLabel}</span>
                </div>

                {/* Fila 2: las dos mitades + el badge de match flotando entre ambas */}
                <div className="relative mt-1">
                  <MatchHalf sideLabel={topHalf.sideLabel} title={topHalf.title} name={topHalf.name} verified={topHalf.verified} />
                  <div className="relative z-10 -my-3 flex justify-center">
                    <MatchBadge label={`${t('matches.badgeMatch')} · ${listingMatch.score.toFixed(0)}%`} />
                  </div>
                  <MatchHalf sideLabel={bottomHalf.sideLabel} title={bottomHalf.title} name={bottomHalf.name} verified={bottomHalf.verified} />
                </div>

                {/* Explicacion del porcentaje (Fase 8, Bloque B, Parte 3) - maximo 2
                    lineas en movil via line-clamp, centrada bajo el badge flotante. */}
                {explanationLine ? (
                  <p className="line-clamp-2 mt-2.5 text-center text-[12px] text-text-3">{explanationLine}</p>
                ) : null}

                {/* Descargar ficha (Fase 2, seccion 1.1): la ficha SIEMPRE lleva los
                    datos del agente que la descarga, nunca los del dueno original del
                    inmueble - por eso alcanza con el listingId, el servidor resuelve al
                    agente desde la sesion (regla 0, innegociable). */}
                {accesoInput && listingMatch.listing?.id ? (
                  <button
                    type="button"
                    onClick={() => setFichaListingId(listingMatch.listing!.id)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-line-strong px-3 py-2 text-xs font-semibold text-text-2 transition-colors duration-150 hover:border-accent hover:text-accent"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={2} /> {t('ficha.descargar')}
                  </button>
                ) : null}

                {/* Fila 5: antes de contactar, boton de WhatsApp; una vez contactado, el
                    boton desaparece y se reemplaza por la ultima accion + fecha + puntos
                    (item 10.2 del pedido) - el historial completo sigue disponible abajo. */}
                {listingMatch.contactedAt ? (
                  lastAction ? (
                    <div className="mt-3.5 flex items-center justify-between gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2.5">
                      <span className="min-w-0 truncate text-[13px] font-semibold text-text">
                        {lastAction.label} <span className="font-normal text-text-3">· {fmtShortDate(lastAction.dateIso, lang)}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-accent-dim px-2 py-0.5 text-[10.5px] font-bold text-accent">+{lastAction.points} pts</span>
                    </div>
                  ) : null
                ) : (
                  <div className="mt-3.5">
                    {counterpartPhone ? (
                      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-2.5">
                        <span className="min-w-0 truncate text-[13px] font-semibold text-text">
                          {t('matches.contactaA')} {firstName(counterpartName ?? '')}
                        </span>
                        <a
                          href={buildWhatsappLink(counterpartPhone, whatsappMessage)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => onContact(listingMatch.id)}
                          aria-label={`${t('matches.contactaA')} ${counterpartName ?? ''} ${t('matches.porWhatsapp')}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition-transform duration-150 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
                        >
                          <IconWhatsapp className="h-[22px] w-[22px]" />
                        </a>
                      </div>
                    ) : (
                      <p className="text-center text-xs text-text-3">{t('matches.sinTelefono')}</p>
                    )}
                  </div>
                )}

                {listingMatch.closedWon ? (
                  <div className="fade-up mt-3 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">
                    <Trophy className="h-4 w-4 shrink-0" strokeWidth={2} /> {t('matches.negociacionConcretada')}
                    {listingMatch.closedAt ? <span className="font-normal text-amber-200/70">· {fmtShortDate(listingMatch.closedAt, lang)}</span> : null}
                  </div>
                ) : null}

                {/* Fila 7 */}
                {listingMatch.contactedAt || isAdmin ? (
                  <TimelineDisclosure t={t}>
                    <MatchTimeline
                      match={listingMatch}
                      responsibleName={responsibleName}
                      canEdit={canEditTimeline}
                      onUpdate={(patch) => onUpdateProgress(listingMatch.id, patch)}
                    />
                  </TimelineDisclosure>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      {fichaListingId && accesoInput ? (
        <FichaDownloadModal
          listingId={fichaListingId}
          listingHasPhoto
          suscripcion={accesoInput}
          lang={lang}
          t={t}
          onClose={() => setFichaListingId(null)}
        />
      ) : null}
    </div>
  );
}

function TimelineDisclosure({ t, children }: { t: (k: string) => string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1 border-t border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-[13px] text-left text-[14.5px] font-semibold text-text"
      >
        {open ? t('matches.ocultarSeguimiento') : t('matches.verSeguimiento')}
        <span className={`text-xs text-brand transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open ? <div className="fade-up pb-3">{children}</div> : null}
    </div>
  );
}

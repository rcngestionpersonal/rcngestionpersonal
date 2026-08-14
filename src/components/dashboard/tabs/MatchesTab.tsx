'use client';

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import MatchTimeline from '../MatchTimeline';
import { Card, DataBlock, ModuleHeader, firstName, pedidoBrief, relativeLabel } from '../CardKit';
import { IconStar, IconWhatsapp } from '../icons';
import { pointsForMilestoneKey } from '@/lib/real-estate/ranking';
import { isAgentVerified, type AgentItem, type ListingMatchItem, type OpportunityItem, type ProgressPatch } from '../types';

// El gradiente violeta->teal que marca "el momento match" (fusion inmueble +
// pedido) en toda la app - inspirado en el acento de Linear/Stripe/Raycast.
const MATCH_GRADIENT = 'linear-gradient(90deg, #b7a5ff, #3ee8d2)';

function onlyDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function buildWhatsappLink(phone: string, message: string): string {
  return `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}`;
}

function fmtShortDate(iso: string, lang: 'es' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short' });
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

// Badge "✦ MATCH": anillo + texto en el gradiente violeta->teal de la marca
// (el "momento match"), en vez del pill solido teal que se usaba antes.
function MatchBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full p-px" style={{ background: MATCH_GRADIENT }}>
      <span className="flex items-center gap-1 rounded-full bg-bg-alt px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]">
        <span style={{ backgroundImage: MATCH_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          &#10022; {label}
        </span>
      </span>
    </span>
  );
}

export default function MatchesTab({
  isAdmin,
  canAccess,
  opportunities,
  agents,
  myAgentId,
  onContact,
  onUpdateProgress,
}: {
  isAdmin: boolean;
  canAccess: boolean;
  opportunities: OpportunityItem[];
  agents: AgentItem[];
  myAgentId?: string;
  onContact: (matchId: string) => void;
  onUpdateProgress: (matchId: string, patch: ProgressPatch) => void;
}) {
  const { lang, t, tProperty } = useLanguage();

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
    .sort((a, b) => new Date(b.listingMatch.createdAt).getTime() - new Date(a.listingMatch.createdAt).getTime());

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

            let mineLabelMin = t('matches.tuInmuebleMin');
            let counterpartName: string | undefined = agentFullName(listingMatch.createdByAgentId);
            let counterpartPhone: string | undefined = agentPhone(listingMatch.createdByAgentId) ?? opportunity.contactPhone;
            let counterpartVerified = agentVerified(listingMatch.createdByAgentId);
            let myDescription = listingMatch.listingTitle ?? listingMatch.listing?.title ?? '';
            let whatsappMessage =
              lang === 'es'
                ? `👋 Hola ${counterpartName ?? ''}, te saluda ${myName}. Tu pedido hizo match con mi inmueble de "${myDescription}", por favor envíame información. ¡Gracias! 🙌`
                : `👋 Hi ${counterpartName ?? ''}, this is ${myName}. Your request matched my listing "${myDescription}", please send me more information. Thanks! 🙌`;

            if (amRequestSide && !amListingSide) {
              mineLabelMin = t('matches.tuPedidoMin');
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

            if (isAdmin) {
              return (
                <Card key={listingMatch.id}>
                  <div className="flex items-center justify-between gap-2">
                    <MatchBadge label={t('matches.badgeMatch')} />
                    <span className="text-right text-[13px] font-semibold text-violet-300">{listingMatch.score.toFixed(0)}%</span>
                  </div>
                  <p className="mt-3 pb-3 text-[13.5px] font-semibold text-text">
                    {agentFullName(listingMatch.managingAgentId) ?? '—'}
                    {' ('}{listingMatch.listingTitle ?? listingMatch.listing?.title}{')'}
                    {' ↔ '}
                    {agentFullName(listingMatch.createdByAgentId) ?? 'chat web'}
                    {' ('}{listingMatch.opportunitySummary ?? listingMatch.opportunity?.summary}{')'}
                  </p>
                </Card>
              );
            }

            return (
              <Card key={listingMatch.id}>
                {/* Fila 1 */}
                <div className="flex items-center justify-between gap-2">
                  <MatchBadge label={t('matches.badgeMatch')} />
                  <span className="text-[12px] font-medium text-text-3">{matchDateLabel}</span>
                </div>

                {/* Fila 2 */}
                <div className="mt-3 flex items-center gap-1.5">
                  <h3 className="text-[16.5px] font-bold leading-tight tracking-[-0.01em] text-text">{counterpartName ?? '—'}</h3>
                  {counterpartName && counterpartVerified ? (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-brand-line bg-brand-dim text-[10px] font-bold text-brand">
                      ✓
                    </span>
                  ) : null}
                </div>

                {/* Fila 3 */}
                <p
                  className="mb-3.5 mt-1 text-[12px] font-semibold"
                  style={{ backgroundImage: MATCH_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
                >
                  {listingMatch.score.toFixed(0)}% {t('matches.compatibleCon')} {mineLabelMin}
                </p>

                {/* Fila 4 */}
                <DataBlock
                  rows={[
                    { label: amListingSide ? t('matches.dataBlock.tuInmueble') : t('matches.dataBlock.suInmueble'), value: listingValue },
                    { label: amListingSide ? t('matches.dataBlock.suPedido') : t('matches.dataBlock.tuPedido'), value: pedidoValue },
                  ]}
                />

                {/* Fila 5: antes de contactar, boton de WhatsApp; una vez contactado, el
                    boton desaparece y se reemplaza por la ultima accion + fecha + puntos
                    (item 10.2 del pedido) - el historial completo sigue disponible abajo. */}
                {listingMatch.contactedAt ? (
                  lastAction ? (
                    <div className="mt-3.5 flex items-center justify-between gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2.5">
                      <span className="min-w-0 truncate text-[13px] font-semibold text-text">
                        {lastAction.label} <span className="font-normal text-text-3">· {fmtShortDate(lastAction.dateIso, lang)}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-[rgba(45,212,191,0.12)] px-2 py-0.5 text-[10.5px] font-bold text-[#2dd4bf]">+{lastAction.points} pts</span>
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
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-text shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition-transform duration-150 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
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
    </div>
  );
}

function TimelineDisclosure({ t, children }: { t: (k: string) => string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1 border-t border-[rgba(255,255,255,0.07)]">
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

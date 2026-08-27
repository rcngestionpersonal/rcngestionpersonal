'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { isAgentVerified, type AgentItem } from '../types';
import { daysRemaining, resolveEffectiveSubscriptionStatus } from '@/lib/real-estate/subscription-status';
import { PLANES, formatUsd } from '@/config/planes';

function fmtFecha(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SuscripcionTab({
  isAdmin,
  agents,
  myAgentId,
  activateSubscription,
  activating,
  onReload,
}: {
  isAdmin: boolean;
  agents: AgentItem[];
  myAgentId?: string;
  activateSubscription: (agentId: string) => void;
  activating: string | null;
  onReload?: () => void;
}) {
  const { t, tSubscriptionStatus } = useLanguage();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [canceled, setCanceled] = useState(false);

  if (!isAdmin) {
    const myAgent = agents.find((a) => a.id === myAgentId);
    const verified = isAgentVerified(myAgent);
    const effectiveStatus = myAgent ? resolveEffectiveSubscriptionStatus(myAgent) : undefined;
    const needsPayment = effectiveStatus === 'TRIAL' || effectiveStatus === 'INACTIVE' || effectiveStatus === 'PAST_DUE';
    const isActive = effectiveStatus === 'ACTIVE';
    const isDbCanceled = myAgent?.subscriptionStatus === 'CANCELED';

    async function cancelar() {
      setCanceling(true);
      setCancelError('');
      try {
        const res = await fetch('/api/real-estate/billing/cancel', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCancelError(data.error ?? t('suscripcion.errorCancelacion'));
          return;
        }
        setCanceled(true);
        setConfirmCancel(false);
        onReload?.();
      } catch {
        setCancelError(t('suscripcion.errorCancelacion'));
      } finally {
        setCanceling(false);
      }
    }

    return (
      <div className="space-y-10">
        <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
          <h2 className="text-xl font-bold text-text">{t('suscripcion.title.agent')}</h2>
          <p className="mt-1 text-sm text-text-2">{t('suscripcion.plan')}</p>

          {myAgent ? (
            <article className="mt-4 rounded-2xl border border-line bg-surface-2 p-4">
              <p className="text-sm font-semibold text-text">{myAgent.fullName}</p>
              <p className="text-xs text-text-2">
                {myAgent.company ?? t('suscripcion.sinEmpresa')} | {myAgent.phone}
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-1 text-xs font-semibold text-text">
                    {/* CANCELED sigue dando acceso mientras dure el periodo pagado (ver
                    resolveEffectiveSubscriptionStatus), pero mostrar "Activo" aqui leeria
                    contradictorio junto al aviso de "Cancelada" de abajo - para el chip
                    se prioriza el status crudo en ese caso puntual. */}
                    {tSubscriptionStatus(isDbCanceled ? 'CANCELED' : (effectiveStatus ?? myAgent.subscriptionStatus))}
                  </span>
                  {effectiveStatus === 'TRIAL' ? (
                    <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-1 text-xs font-semibold text-text-2">
                      {t('suscripcion.pruebaProCompleto')}
                    </span>
                  ) : myAgent.plan === 'PRO' ? (
                    <span className="gradient-btn rounded-full px-2 py-1 text-xs font-semibold text-grad-contrast">{t('plan.pro.nombre')}</span>
                  ) : myAgent.plan ? (
                    <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-1 text-xs font-semibold text-text-2">
                      {t('plan.basico.nombre')}
                    </span>
                  ) : null}
                </div>
                {needsPayment ? (
                  <Link
                    href="/agentes/suscripcion/planes"
                    className="gradient-btn w-full rounded-full px-3 py-2 text-center text-xs font-semibold transition-transform duration-200 hover:scale-[1.02] sm:w-auto sm:py-1.5"
                  >
                    {t('suscripcion.elegirPlan')}
                  </Link>
                ) : null}
              </div>

              {effectiveStatus === 'TRIAL' ? (
                <p className="mt-2 text-xs text-text-2">
                  {t('suscripcion.diasRestantes')} <span className="font-semibold text-text">{daysRemaining(myAgent.trialEndsAt)}</span>
                </p>
              ) : null}

              {isActive && isDbCanceled ? (
                <p className="mt-2 text-xs text-text-2">{t('suscripcion.canceladaHastaFecha').replace('{fecha}', fmtFecha(myAgent.subscriptionPaidUntil))}</p>
              ) : null}

              {isActive && !isDbCanceled ? (
                <p className="mt-2 text-xs text-text-2">
                  {t('suscripcion.proximaRenovacion')} <span className="font-semibold text-text">{fmtFecha(myAgent.subscriptionPaidUntil)}</span>
                </p>
              ) : null}

              {isActive && myAgent.planSiguiente ? (
                <p className="mt-1 text-xs text-text-2">
                  {t('suscripcion.cambiaraA')
                    .replace('{plan}', myAgent.planSiguiente === 'PRO' ? t('plan.pro.nombre') : t('plan.basico.nombre'))
                    .replace('{fecha}', fmtFecha(myAgent.subscriptionPaidUntil))}
                </p>
              ) : null}

              {isActive && !isDbCanceled ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href="/agentes/suscripcion/planes"
                    className="rounded-full border border-line-strong bg-surface-2 px-3 py-2 text-center text-xs font-semibold text-text-2 transition hover:bg-surface sm:w-auto"
                  >
                    {t('suscripcion.cambiarPlan')}
                  </Link>
                  {!confirmCancel && !canceled ? (
                    <button
                      onClick={() => setConfirmCancel(true)}
                      className="rounded-full border border-line px-3 py-2 text-center text-xs font-semibold text-text-2 transition hover:text-danger sm:w-auto"
                    >
                      {t('suscripcion.cancelarSuscripcion')}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {confirmCancel ? (
                <div className="mt-3 rounded-xl border border-danger bg-danger-dim p-3">
                  <p className="text-xs text-danger">{t('suscripcion.confirmarCancelacion').replace('{fecha}', fmtFecha(myAgent.subscriptionPaidUntil))}</p>
                  {cancelError ? <p className="mt-1 text-xs text-danger">{cancelError}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => void cancelar()}
                      disabled={canceling}
                      className="rounded-full border border-danger px-3 py-1.5 text-xs font-semibold text-danger transition hover:brightness-110 disabled:opacity-60"
                    >
                      {t('suscripcion.siCancelar')}
                    </button>
                    <button
                      onClick={() => setConfirmCancel(false)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-text-2 transition hover:bg-surface-2"
                    >
                      {t('suscripcion.noMantener')}
                    </button>
                  </div>
                </div>
              ) : null}

              {canceled ? (
                <p className="mt-2 text-xs font-semibold text-accent">
                  {t('suscripcion.cancelacionConfirmada').replace('{fecha}', fmtFecha(myAgent.subscriptionPaidUntil))}
                </p>
              ) : null}

              {!verified ? (
                <a href="/agentes/verificar-telefono" className="mt-2 inline-block text-xs font-semibold text-violet-300 hover:underline">
                  {t('suscripcion.verificarPendiente')} →
                </a>
              ) : null}
            </article>
          ) : (
            <p className="mt-4 text-sm text-text-2">{t('suscripcion.sinRegistro')}</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">{t('suscripcion.title.admin')}</h2>
        <p className="text-sm text-text-2">{t('suscripcion.planShort')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <article
            key={agent.id}
            className="rounded-2xl border border-line bg-surface-2 p-4 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <p className="text-sm font-semibold text-text">
              {agent.fullName}
              {isAgentVerified(agent) ? (
                <span className="ml-1.5 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-emerald-300">
                  ✓
                </span>
              ) : null}
            </p>
            <p className="text-xs text-text-2">
              {agent.company ?? t('suscripcion.sinEmpresa')} | {agent.phone}
            </p>
            <p className="mt-2 text-xs text-text-2">
              {t('suscripcion.zonas')} {agent.zones.join(', ') || t('suscripcion.noDefinidas')}
            </p>
            {agent.plan && (agent.subscriptionStatus === 'ACTIVE' || agent.subscriptionStatus === 'PAST_DUE' || agent.subscriptionStatus === 'CANCELED') ? (
              // Precio fundador (Fase 7, seccion 9.6): el admin necesita ver que
              // precio paga cada agente y si tiene un precio fundador activo,
              // para auditar cobros y saber cuantos fundadores hay antes de
              // decidir subir el precio vigente. Solo se muestra si el agente
              // ya pago alguna vez (nunca para TRIAL/INACTIVE, que no pagan
              // nada todavia - mostrarles un precio seria enganoso).
              <p className="mt-1 text-xs text-text-2">
                {t('suscripcion.admin.pagaLabel')}:{' '}
                <span className="font-semibold text-text">
                  ${formatUsd(agent.plan === 'PRO' ? PLANES.PRO.total : (agent.precioFundadorBasico ?? PLANES.BASICO.total))}
                </span>{' '}
                <span className="text-text-3">
                  ·{' '}
                  {agent.plan === 'PRO'
                    ? t('suscripcion.admin.proTarifaVigente')
                    : agent.precioFundadorBasico
                      ? t('suscripcion.admin.precioFundadorActivo')
                      : t('suscripcion.admin.precioVigente')}
                </span>
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-1 text-xs font-semibold text-text">
                {tSubscriptionStatus(agent.subscriptionStatus)}
              </span>
              {agent.subscriptionStatus !== 'ACTIVE' ? (
                <button
                  onClick={() => activateSubscription(agent.id)}
                  disabled={activating === agent.id}
                  className="gradient-btn w-full rounded-full px-3 py-2 text-xs font-semibold transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-1.5"
                >
                  {activating === agent.id ? (
                    t('suscripcion.activando')
                  ) : (
                    <span className="flex flex-col items-center leading-tight">
                      <span>{t('suscripcion.activar')}</span>
                      <span className="text-[10px] font-normal opacity-80">{t('suscripcion.masIva')}</span>
                    </span>
                  )}
                </button>
              ) : (
                <span className="text-xs font-semibold text-emerald-400">{t('suscripcion.pagoActivo')}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

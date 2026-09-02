// Logica compartida de estado de suscripcion/trial - un solo lugar para
// "cuantos dias quedan" y "la cuenta ya vencio", en vez de reimplementarlo en
// cada pantalla que lo necesita.

export function daysRemaining(untilIso?: string | Date | null): number {
  if (!untilIso) return 0;
  const ms = new Date(untilIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export type SubscriptionStatusValue = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE';

export type SubscriptionLike = {
  subscriptionStatus: SubscriptionStatusValue;
  trialEndsAt?: string | Date | null;
  subscriptionPaidUntil?: string | Date | null;
};

// El trial y el pago via Payphone (un cobro puntual, no una suscripcion
// recurrente real) tienen fecha de vencimiento pero nada los "apaga"
// automaticamente salvo que se revise en el momento de leer el agente - esta
// funcion es ese chequeo, para no depender de un cron que cambie el status en
// la base. Devuelve el status "real" a mostrar/usar, sin mutar nada.
//
// Una suscripcion CANCELADA (boton "Cancelar suscripcion" del panel) sigue
// dando acceso mientras el periodo ya pagado no haya vencido - cancelar solo
// significa "no renovar", nunca corta el acceso de inmediato. Por eso se
// evalua igual que ACTIVE contra subscriptionPaidUntil.
export function resolveEffectiveSubscriptionStatus(agent: SubscriptionLike): SubscriptionStatusValue {
  const now = Date.now();
  if (agent.subscriptionStatus === 'TRIAL' && agent.trialEndsAt && new Date(agent.trialEndsAt).getTime() <= now) {
    return 'INACTIVE';
  }
  if (agent.subscriptionStatus === 'ACTIVE' || agent.subscriptionStatus === 'CANCELED') {
    const stillPaid = agent.subscriptionPaidUntil && new Date(agent.subscriptionPaidUntil).getTime() > now;
    if (stillPaid) return 'ACTIVE';
    if (agent.subscriptionStatus === 'ACTIVE') return 'INACTIVE';
  }
  return agent.subscriptionStatus;
}

// PAST_DUE cuenta como usable (pedido de recurrencias, seccion 5: "durante
// PAST_DUE el agente conserva el servicio completo" mientras el motor de
// cobro reintenta - cortar el acceso antes de agotar los reintentos solo
// logra que el agente no tenga motivo para pagar). Solo se pierde el acceso
// al llegar a EXPIRED (INACTIVE), tras el tercer intento fallido.
export function isSubscriptionUsable(agent: SubscriptionLike): boolean {
  const status = resolveEffectiveSubscriptionStatus(agent);
  return status === 'TRIAL' || status === 'ACTIVE' || status === 'PAST_DUE';
}

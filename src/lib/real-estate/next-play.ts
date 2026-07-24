// Evaluador puro de "Tu Proxima Jugada": decide, en orden de prioridad, cual es la
// unica recomendacion que se le muestra al agente en el hero de Gestion. Sin React,
// sin fetch - solo datos de entrada y una decision - para que sea facil de probar.

export type NextPlayInput = {
  uncontactedMatchesCount: number;
  uncontactedMatchNames: string[];
  closingsCount: number;
  listingsCount: number;
  pedidosCount: number;
  stalledFollowUpsCount: number;
  referralsCount: number;
};

export type NextPlayState =
  | { kind: 'UNCONTACTED_MATCHES'; count: number; names: string[] }
  | { kind: 'NO_CLOSINGS' }
  | { kind: 'NO_INVENTORY' }
  | { kind: 'STALLED_FOLLOWUPS'; count: number }
  | { kind: 'NO_REFERRALS' }
  | { kind: 'ALL_CAUGHT_UP' };

export function evaluateNextPlay(input: NextPlayInput): NextPlayState {
  if (input.uncontactedMatchesCount > 0) {
    return { kind: 'UNCONTACTED_MATCHES', count: input.uncontactedMatchesCount, names: input.uncontactedMatchNames };
  }
  if (input.closingsCount === 0) {
    return { kind: 'NO_CLOSINGS' };
  }
  if (input.listingsCount === 0 && input.pedidosCount === 0) {
    return { kind: 'NO_INVENTORY' };
  }
  if (input.stalledFollowUpsCount > 0) {
    return { kind: 'STALLED_FOLLOWUPS', count: input.stalledFollowUpsCount };
  }
  if (input.referralsCount === 0) {
    return { kind: 'NO_REFERRALS' };
  }
  return { kind: 'ALL_CAUGHT_UP' };
}

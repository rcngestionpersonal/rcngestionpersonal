// Control de acceso a features por plan - punto unico y centralizado que
// consumen todos los modulos Pro (esta fase y las siguientes). Nunca decidir
// "puede ver esto?" reimplementando esta logica en un componente o ruta: se
// importa tieneAcceso() desde aqui (o tieneAccesoPorAgenteId() de
// access-server.ts del lado servidor, cuando solo se tiene el agentId).
//
// Sin imports de Prisma/mock-store a proposito: este archivo debe poder
// importarse tanto desde componentes de cliente (el candado de
// RequiereFeature) como desde rutas de servidor.
import { resolveEffectiveSubscriptionStatus, type SubscriptionLike } from '@/lib/real-estate/subscription-status';
import { planIncluyeFeature, type Feature, type PlanTipo } from '@/config/planes';

export type { Feature } from '@/config/planes';

export type AccesoInput = SubscriptionLike & { plan: PlanTipo };

// Reglas (seccion 4.1 del pedido de arquitectura de planes):
// - TRIAL -> acceso a TODAS las features, incluidas las Pro (reverse trial).
// - ACTIVE -> acceso segun el plan contratado. Una suscripcion CANCELADA pero
//   todavia dentro del periodo pagado cuenta como ACTIVE aqui (ver
//   resolveEffectiveSubscriptionStatus) - recien pierde acceso cuando ese
//   periodo vence.
// - Cualquier otro estado (vencida/INACTIVE, PAST_DUE, o CANCELADA ya fuera de
//   periodo) -> sin acceso a ninguna feature de pago.
export function tieneAcceso(suscripcion: AccesoInput, feature: Feature): boolean {
  const status = resolveEffectiveSubscriptionStatus(suscripcion);
  if (status === 'TRIAL') return true;
  if (status !== 'ACTIVE') return false;
  return planIncluyeFeature(suscripcion.plan, feature);
}

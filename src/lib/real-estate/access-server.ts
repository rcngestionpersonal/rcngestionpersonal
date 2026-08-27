// Variante server-only de tieneAcceso(): para rutas de API/server actions que
// solo tienen el agentId a mano (no el registro completo ya cargado). Resuelve
// el agente (real o mock, segun el modo activo) y delega en tieneAcceso().
//
// CRITICO (seccion 4.4 del pedido): toda validacion de acceso a una feature de
// pago en el servidor debe pasar por aqui - nunca confiar solo en que el
// frontend oculto el boton/seccion.
import { prisma } from '@/lib/prisma';
import { findAgentById, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { tieneAcceso, type Feature } from '@/lib/real-estate/access';

export async function tieneAccesoPorAgenteId(agentId: string, feature: Feature): Promise<boolean> {
  if (shouldUseMockStore()) {
    const agent = findAgentById(agentId);
    if (!agent) return false;
    return tieneAcceso(agent, feature);
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { subscriptionStatus: true, trialEndsAt: true, subscriptionPaidUntil: true, plan: true },
  });
  if (!agent) return false;
  return tieneAcceso(agent, feature);
}

// Los datos de contacto de clientes (propietario/arrendador de un inmueble, o
// comprador/arrendatario de un pedido) son delicados y de uso exclusivo del agente
// que los registro. Ni el admin ni otros agentes deben poder verlos - se redactan
// aqui, en la capa de API, para que ningun endpoint los filtre por accidente.

type ListingWithOwnerInfo = {
  managingAgentId: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
};

export function redactListingOwnerInfo<T extends ListingWithOwnerInfo>(listing: T, viewerAgentId?: string): T {
  if (viewerAgentId && viewerAgentId === listing.managingAgentId) return listing;
  const rest: Record<string, unknown> = { ...listing };
  delete rest.ownerName;
  delete rest.ownerPhone;
  return rest as T;
}

type OpportunityWithBuyerInfo = {
  createdByAgentId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
};

// Los pedidos organicos (chat web, sin agente creador) mantienen su comportamiento
// previo: el contacto es visible para quien pueda tomarlo, ya que nadie es "dueno"
// todavia. Solo se redacta cuando un agente cargo el pedido para un cliente propio.
export function redactOpportunityBuyerInfo<T extends OpportunityWithBuyerInfo>(opportunity: T, viewerAgentId?: string): T {
  if (!opportunity.createdByAgentId) return opportunity;
  if (viewerAgentId && viewerAgentId === opportunity.createdByAgentId) return opportunity;
  const rest: Record<string, unknown> = { ...opportunity };
  delete rest.contactName;
  delete rest.contactPhone;
  return rest as T;
}

// Convierte los registros crudos (Prisma o mock-store) de inmueble/agente en
// los snapshots planos que consumen los templates (Fase 2). Es el unico
// lugar donde se decide que campos de Listing/Agent llegan a la ficha - a
// proposito nunca recibe ownerName/ownerPhone/address (ver fields.ts,
// FichaListingFields) ni el agente dueno del inmueble (siempre se construye
// a partir del agente que hace la descarga, seccion 0 del pedido).
import { PROPERTY_TYPE_LABELS, OPERATION_TYPE_LABELS, type Language } from '@/lib/i18n/dictionary';
import { fichaExtraChips, fichaPrimaryRows, type FichaListingFields } from './fields';
import type { FichaAgentSnapshot, FichaListingSnapshot } from './templates';

function placeholderKindFor(propertyType: string): FichaListingSnapshot['placeholderKind'] {
  if (propertyType === 'LAND') return 'land';
  if (propertyType === 'COMMERCIAL' || propertyType === 'WAREHOUSE') return 'warehouse';
  if (propertyType === 'HOUSE' || propertyType === 'FARM') return 'house';
  return 'building';
}

// "Cumbaya, Quito" (zona + ciudad) o solo la ciudad si no hay zona - NUNCA la
// direccion exacta (seccion 3.5/4 del pedido: la ficha solo declara la zona
// aproximada).
export function sectorLineFor(input: { city: string; zone?: string | null }): string {
  return input.zone ? `${input.zone}, ${input.city}` : input.city;
}

export function buildFichaListingSnapshot(
  listing: FichaListingFields & { title: string; city: string; zone?: string | null; price: number; currency: string; description?: string | null },
  lang: Language,
  photoDataUri: string | null,
  galleryPhotoDataUris: string[] = [],
): FichaListingSnapshot {
  return {
    propertyTypeLabel: PROPERTY_TYPE_LABELS[lang][listing.propertyType] ?? listing.propertyType,
    operationLabel: OPERATION_TYPE_LABELS[lang][listing.operationType] ?? listing.operationType,
    sectorLine: sectorLineFor(listing),
    price: listing.price,
    currency: listing.currency,
    description: listing.description ?? null,
    photoDataUri,
    galleryPhotoDataUris,
    placeholderKind: placeholderKindFor(listing.propertyType),
    primaryRows: fichaPrimaryRows(listing, lang),
    extraChips: fichaExtraChips(listing, lang),
  };
}

export function buildFichaAgentSnapshot(
  agent: { fullName: string; phone: string; direccion?: string | null; ciudad?: string | null; licenseNumber?: string | null; idNumber?: string | null; phoneVerifiedAt?: string | Date | null },
  photoDataUri: string | null,
  qrDataUri: string | null,
): FichaAgentSnapshot {
  return {
    displayName: agent.fullName,
    photoDataUri,
    phone: agent.phone,
    direccion: agent.direccion ? `${agent.direccion}${agent.ciudad ? `, ${agent.ciudad}` : ''}` : null,
    licenseNumber: agent.licenseNumber ?? null,
    verified: Boolean(agent.idNumber) && Boolean(agent.phoneVerifiedAt),
    qrDataUri,
  };
}

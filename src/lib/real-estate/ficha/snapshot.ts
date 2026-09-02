// Convierte los registros crudos (Prisma o mock-store) de inmueble/agente en
// los snapshots planos que consumen los templates. Es el unico lugar donde se
// decide que campos de Listing/Agent llegan a la ficha - a proposito nunca
// recibe ownerName/ownerPhone/address (ver fields.ts, FichaListingFields) ni
// el agente dueno del inmueble (siempre se construye a partir del agente que
// hace la descarga, seccion 0 del pedido) - EXCEPTO en la version "colega"
// (ver buildFichaAgentSnapshot desde route.ts), la unica excepcion admitida.
import { PROPERTY_TYPE_LABELS, OPERATION_TYPE_LABELS, type Language } from '@/lib/i18n/dictionary';
import { fichaExtraChips, fichaMapDataRows, fichaPrimaryRows, type FichaListingFields } from './fields';
import type { FichaAgentSnapshot, FichaColegasSnapshot, FichaListingSnapshot } from './templates';

const MESES: Record<Language, string[]> = {
  es: ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'],
  en: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'],
};

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

// "RDN-4F21": referencia corta y estable derivada del id de Prisma (cuid) -
// no es un correlativo real (no hay columna para eso) pero es unica,
// determinista y nunca cambia entre descargas de la misma ficha.
export function referenceCodeFor(listingId: string): string {
  return `RDN-${listingId.slice(-4).toUpperCase()}`;
}

export function dateLabelFor(date: Date, lang: Language): string {
  return `${MESES[lang][date.getMonth()]} ${date.getFullYear()}`;
}

// "2 meses" / "3 semanas" (seccion 4.1, "tiempo publicado") - redondeado a la
// unidad mas legible, nunca a dias exactos.
export function timePublishedLabel(createdAt: Date, now: Date, lang: Language): string {
  const days = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
  const plural = (n: number, singularEs: string, pluralEs: string, singularEn: string, pluralEn: string) =>
    lang === 'es' ? `${n} ${n === 1 ? singularEs : pluralEs}` : `${n} ${n === 1 ? singularEn : pluralEn}`;

  if (days < 7) return lang === 'es' ? (days <= 1 ? 'Hoy' : `${days} días`) : days <= 1 ? 'Today' : `${days} days`;
  if (days < 30) return plural(Math.round(days / 7), 'semana', 'semanas', 'week', 'weeks');
  if (days < 365) return plural(Math.round(days / 30), 'mes', 'meses', 'month', 'months');
  return plural(Math.round(days / 365), 'año', 'años', 'year', 'years');
}

export function buildFichaListingSnapshot(
  listing: FichaListingFields & {
    id: string;
    title: string;
    city: string;
    zone?: string | null;
    price: number;
    currency: string;
    description?: string | null;
    createdAt: Date;
  },
  lang: Language,
  photoDataUri: string | null,
  galleryPhotoDataUris: string[] = [],
  hasMorePhotos = false,
): FichaListingSnapshot {
  const pricePerM2 = listing.areaM2 && listing.areaM2 > 0 ? Math.round(listing.price / listing.areaM2) : null;

  return {
    propertyTypeLabel: PROPERTY_TYPE_LABELS[lang][listing.propertyType] ?? listing.propertyType,
    operationLabel: OPERATION_TYPE_LABELS[lang][listing.operationType] ?? listing.operationType,
    sectorLine: sectorLineFor(listing),
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    pricePerM2: pricePerM2 ? `$${pricePerM2.toLocaleString('en-US')} / m²` : null,
    description: listing.description ?? null,
    photoDataUri,
    galleryPhotoDataUris,
    hasMorePhotos,
    placeholderKind: placeholderKindFor(listing.propertyType),
    primaryRows: fichaPrimaryRows(listing, lang),
    extraChips: fichaExtraChips(listing, lang),
    mapDataRows: fichaMapDataRows(listing, lang),
    referencia: referenceCodeFor(listing.id),
    fechaLabel: dateLabelFor(new Date(), lang),
  };
}

export function buildFichaAgentSnapshot(
  agent: {
    fullName: string;
    phone: string;
    email?: string | null;
    company?: string | null;
    licenseNumber?: string | null;
    idNumber?: string | null;
    phoneVerifiedAt?: string | Date | null;
  },
  photoDataUri: string | null,
  qrDataUri: string | null,
): FichaAgentSnapshot {
  return {
    displayName: agent.fullName,
    photoDataUri,
    phone: agent.phone,
    email: agent.email ?? null,
    agencyName: agent.company ?? null,
    licenseNumber: agent.licenseNumber ?? null,
    verified: Boolean(agent.idNumber) && Boolean(agent.phoneVerifiedAt),
    qrDataUri,
  };
}

// Bloque de condiciones para colegas (seccion 4.1) - "comision compartida" es
// el unico dato con columna propia hoy (Listing.commissionSharePercent,
// decidido por el agente dueno al publicar); "exclusividad" y "coordinacion
// de visitas" todavia no tienen campo en el modelo, asi que se muestra un
// texto neutro que invita a preguntar en vez de inventar un valor - evita
// mostrar datos falsos mientras no exista una forma de que el agente los
// cargue. "tiempo publicado" siempre sale de createdAt, nunca se pide.
export function buildFichaColegasSnapshot(
  listing: { commissionSharePercent: number; createdAt: Date },
  lang: Language,
): FichaColegasSnapshot {
  return {
    comisionCompartida: listing.commissionSharePercent > 0 ? `${listing.commissionSharePercent}%` : lang === 'es' ? 'Consultar' : 'Ask agent',
    exclusividad: lang === 'es' ? 'Consultar con el agente' : 'Ask the agent',
    coordinacionVisitas: lang === 'es' ? 'Coordinar con el agente' : 'Coordinate with agent',
    tiempoPublicado: timePublishedLabel(listing.createdAt, new Date(), lang),
  };
}

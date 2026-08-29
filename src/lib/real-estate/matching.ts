import { OperationType, PropertyType } from '@prisma/client';

type ScoreResult = {
  score: number;
  reasons: string[];
};

export type AgentScoringInput = {
  zones: string[];
  propertyTypesInterest: PropertyType[];
  specialty: OperationType;
  minBudget?: number | null;
  maxBudget?: number | null;
};

// OJO: este tipo lo usan TANTO scoreAgentForOpportunity (matching agente<->pedido,
// Fase 1, sin tocar) COMO scoreListingForOpportunity (matching inmueble<->pedido,
// Fase 8 Bloque B). Los campos de mas abajo (bedrooms, prefX, etc.) solo los lee
// la segunda funcion - scoreAgentForOpportunity los ignora, no se rompe nada.
export type OpportunityScoringInput = {
  city: string;
  zone?: string | null;
  propertyType: PropertyType;
  operationType: OperationType;
  budgetMin?: number | null;
  budgetMax?: number | null;
  // Ponderantes del pedido (Fase 8, Bloque B) - "al menos" (minimo deseado).
  // Regla de oro (seccion 2.6): un criterio que el pedido NO especifica
  // (undefined/null) simplemente no participa en el calculo, ni suma ni resta.
  areaM2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  // Antiguedad preferida - hoy ningun formulario de Pedidos la recolecta (no
  // se pidio en este bloque), asi que este campo siempre llega undefined en
  // la practica. Se deja implementado para que, el dia que exista el campo
  // en el formulario, el motor ya lo sepa ponderar sin tocar matching.ts otra vez.
  antiguedadPreferida?: string | null;
  // Interruptores de preferencia (Fase 7/8) - 'SI' | 'NO' | null/undefined
  // (indiferente = no pondera).
  prefAreaVerdeAmplia?: string | null;
  prefAreasComunales?: string | null;
  prefAscensor?: string | null;
  prefAmoblado?: string | null;
  prefTodosLosServicios?: string | null;
  // Regla de espacios adicionales (seccion 2.5) - null/true = acepta (checkbox
  // marcado por defecto), false = solo cuentan los dormitorios reales.
  aceptaEspaciosAdicionales?: boolean | null;
};

function overlapsBudget(
  opportunityMin?: number | null,
  opportunityMax?: number | null,
  agentMin?: number | null,
  agentMax?: number | null,
): boolean {
  if (!opportunityMin && !opportunityMax) return true;
  if (!agentMin && !agentMax) return true;

  const oppMin = opportunityMin ?? opportunityMax ?? 0;
  const oppMax = opportunityMax ?? opportunityMin ?? Number.MAX_SAFE_INTEGER;
  const agMin = agentMin ?? agentMax ?? 0;
  const agMax = agentMax ?? agentMin ?? Number.MAX_SAFE_INTEGER;

  return oppMin <= agMax && agMin <= oppMax;
}

export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function zoneMatches(agentZones: string[], city: string, zone?: string | null): boolean {
  if (agentZones.length === 0) return true;
  const haystack = [city, zone ?? ''].filter(Boolean).map(normalize);
  return agentZones.some((z) => {
    const needle = normalize(z);
    return haystack.some((h) => h.includes(needle));
  });
}

function specialtyMatches(agentSpecialty: OperationType, operationType: OperationType): boolean {
  if (agentSpecialty === OperationType.BOTH) return true;
  if (operationType === OperationType.BOTH) return true;
  return agentSpecialty === operationType;
}

function propertyMatches(agentInterest: PropertyType[], propertyType: PropertyType): boolean {
  if (agentInterest.length === 0) return true;
  return agentInterest.includes(propertyType) || agentInterest.includes(PropertyType.OTHER);
}

// scoreAgentForOpportunity/shouldNotify (matching agente<->pedido, para decidir
// a que agentes notificar un pedido nuevo): SIN CAMBIOS respecto a Fase 1. El
// Bloque B de Fase 8 solo reescribe scoreListingForOpportunity (mas abajo).
export function scoreAgentForOpportunity(agent: AgentScoringInput, opportunity: OpportunityScoringInput): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (zoneMatches(agent.zones, opportunity.city, opportunity.zone)) {
    score += 35;
    reasons.push('Zona compatible');
  }

  if (propertyMatches(agent.propertyTypesInterest, opportunity.propertyType)) {
    score += 30;
    reasons.push('Tipo de inmueble compatible');
  }

  if (specialtyMatches(agent.specialty, opportunity.operationType)) {
    score += 20;
    reasons.push('Especialidad operativa alineada');
  }

  if (overlapsBudget(opportunity.budgetMin, opportunity.budgetMax, agent.minBudget, agent.maxBudget)) {
    score += 15;
    reasons.push('Rango de presupuesto compatible');
  }

  return { score, reasons };
}

export function shouldNotify(score: number): boolean {
  return score >= 45;
}

// Umbral de compatibilidad inmueble<->pedido (Fase 8, seccion 2.8) - distinto
// del umbral de notificacion a agentes de arriba (45), que no se toca. Solo
// aplica a matches NUEVOS (ver Parte 4: los ya existentes no se recalculan
// por debajo de este umbral para ocultarlos).
export const LISTING_MATCH_THRESHOLD = 60;

export function meetsListingMatchThreshold(score: number): boolean {
  return score >= LISTING_MATCH_THRESHOLD;
}

export function isAgentEligible(agent: {
  isActive: boolean;
  subscriptionStatus: string;
  phoneVerifiedAt?: Date | string | null;
}): boolean {
  return (
    agent.isActive &&
    (agent.subscriptionStatus === 'TRIAL' || agent.subscriptionStatus === 'ACTIVE') &&
    Boolean(agent.phoneVerifiedAt)
  );
}

// Campos ponderantes/informativos del inmueble (Fase 8, Bloque B). Todo
// opcional - un inmueble incompleto (Bloque A) sigue generando matches, solo
// que esos criterios no ponderan (regla de oro, seccion 2.6, aplicada de
// igual forma a ambos lados: si el INMUEBLE no declaro un dato, tampoco hay
// nada que comparar contra ese ponderante).
export type ListingScoringInput = {
  operationType: OperationType;
  propertyType: PropertyType;
  city: string;
  zone?: string | null;
  price: number;
  areaM2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  antiguedad?: string | null;
  espaciosAdicionales?: number | null;
  mediosBanos?: number | null;
  tieneAscensor?: boolean | null;
  areasComunales?: boolean | null;
  amoblado?: string | null;
  serviciosBasicos?: string | null;
  // Para derivar "area verde amplia" del lado del inmueble (Casa) - mismo
  // criterio que listing-fields.ts (hasAreaVerdeAmplia), reimplementado aqui
  // sin import cruzado para no acoplar matching.ts a la UI de Inmuebles.
  terrenoTotalM2?: number | null;
  areaLibrePropiaM2?: number | null;
  terrenoLibreExclusivoM2?: number | null;
};

function locationMatches(
  aCity: string,
  aZone: string | null | undefined,
  bCity: string,
  bZone: string | null | undefined,
): boolean {
  if (normalize(aCity) !== normalize(bCity)) return false;
  if (!aZone || !bZone) return true;

  const na = normalize(aZone);
  const nb = normalize(bZone);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function operationCompatible(a: OperationType, b: OperationType): boolean {
  if (a === OperationType.BOTH || b === OperationType.BOTH) return true;
  return a === b;
}

function propertyTypeCompatible(a: PropertyType, b: PropertyType): boolean {
  return a === b || a === PropertyType.OTHER || b === PropertyType.OTHER;
}

function priceWithinBudget(price: number, budgetMin?: number | null, budgetMax?: number | null): boolean {
  if (!budgetMin && !budgetMax) return true;
  const tolerance = 0.1;
  const min = budgetMin ?? 0;
  const max = budgetMax ?? Number.MAX_SAFE_INTEGER;
  return price >= min * (1 - tolerance) && price <= max * (1 + tolerance);
}

function listingHasAreaVerdeAmplia(listing: ListingScoringInput): boolean {
  const values = [listing.terrenoTotalM2, listing.areaLibrePropiaM2, listing.terrenoLibreExclusivoM2];
  return values.some((v) => typeof v === 'number' && v > 250);
}

// ---------------------------------------------------------------------------
// ESQUEMA DE PESOS (Fase 8, seccion 2.7c) - documentado aqui porque es la
// fuente unica de verdad de "cuanto pesa cada criterio". El calculo parte de
// 100 (base alta, seccion 2.7b) y RESTA hasta el MAX_DEDUCTION de cada
// ponderante que el pedido si especifico (regla de oro, 2.6). Nunca se
// excluye por un ponderante - solo por los EXCLUYENTES (zona/tipo/operacion/
// precio), que se verifican antes y aparte.
//
// Peso alto (20-24 pts):    metraje, dormitorios
// Peso medio-alto (12-15):  banos completos, cada interruptor de preferencia
//                           activado (si/no, nunca indiferente)
// Peso medio (10):          "especificos de cada tipo" - hoy esto ES la lista
//                           de interruptores de arriba, ya que el Pedido
//                           (Bloque A) no declara mas detalle categorico por
//                           tipo que esos 5 interruptores.
// Peso bajo (6-8):          parqueos, antiguedad
//
// Todas las deducciones por campos NUMERICOS (dormitorios/metraje/banos/
// parqueos) son PROPORCIONALES a la distancia, no binarias (seccion 2.7d):
// deduccion = min(MAX, PER_UNIT * deficit), asi que un deficit chico pesa
// poco y uno grande se acerca al MAX sin pasarlo. "Superar lo pedido" siempre
// resulta en deficit<=0 -> deduccion 0 (seccion 2.7e, nunca se premia de mas).
// ---------------------------------------------------------------------------
const WEIGHTS = {
  bedroomsMax: 24,
  bedroomsPerUnit: 44, // deficit>=~0.55 dormitorio ya satura el max
  areaMax: 24,
  areaPerPct: 0.62, // % de metraje faltante * este factor (40% faltante ~ satura)
  bathroomsMax: 14,
  bathroomsPerUnit: 26,
  parkingMax: 8,
  parkingPerUnit: 16,
  antiguedadMax: 8,
  // Interruptores de preferencia (seccion 2.7f)
  prefStrongMiss: 15, // pedido pidio "Si" y el inmueble no lo tiene
  prefWeakMiss: 6, // pedido pidio "No" y el inmueble si lo tiene
  // Espacios adicionales (seccion 2.5): cada uno cuenta como esta fraccion de
  // un dormitorio real al calcular el deficit.
  espacioAdicionalPeso: 0.7,
  // Medios banos (seccion 1.3b/2.3): SIEMPRE suman un poco si existen, sin
  // importar si el pedido pidio banos - nunca restan.
  mediosBanosBonus: 3,
};

type Difference = { text: string; weight: number };

function pluralEs(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

// Deduccion lineal-con-tope: 0 si no hay deficit (incluye "supera lo pedido",
// seccion 2.7e), creciendo proporcional al deficit hasta el tope MAX.
function gradedDeduction(deficit: number, perUnit: number, max: number): number {
  if (deficit <= 0) return 0;
  return Math.min(max, perUnit * deficit);
}

export function scoreListingForOpportunity(listing: ListingScoringInput, opportunity: OpportunityScoringInput): ScoreResult {
  // 1) EXCLUYENTES (seccion 2.2) - si alguno falla, no hay match en absoluto.
  if (!locationMatches(listing.city, listing.zone, opportunity.city, opportunity.zone)) return { score: 0, reasons: [] };
  if (!propertyTypeCompatible(listing.propertyType, opportunity.propertyType)) return { score: 0, reasons: [] };
  if (!operationCompatible(listing.operationType, opportunity.operationType)) return { score: 0, reasons: [] };
  if (!priceWithinBudget(listing.price, opportunity.budgetMin, opportunity.budgetMax)) return { score: 0, reasons: [] };

  // 2) PONDERANTES (seccion 2.3/2.6/2.7) - parte de 100, resta solo lo que el
  // pedido si especifico, nunca excluye.
  let total = 100;
  const diffs: Difference[] = [];

  // Dormitorios (con la regla de espacios adicionales, seccion 2.5)
  if (opportunity.bedrooms != null && listing.bedrooms != null) {
    const accepts = opportunity.aceptaEspaciosAdicionales !== false;
    const adicionales = accepts ? (listing.espaciosAdicionales ?? 0) : 0;
    const effectiveBedrooms = listing.bedrooms + adicionales * WEIGHTS.espacioAdicionalPeso;
    const deficit = opportunity.bedrooms - effectiveBedrooms;
    const deduction = gradedDeduction(deficit, WEIGHTS.bedroomsPerUnit, WEIGHTS.bedroomsMax);
    total -= deduction;
    if (deduction > 0) {
      const extra = adicionales > 0
        ? ` + ${adicionales} ${pluralEs(adicionales, 'espacio adicional', 'espacios adicionales')}`
        : '';
      diffs.push({
        text: `tiene ${listing.bedrooms} dormitorios${extra} y buscabas ${opportunity.bedrooms}`,
        weight: deduction,
      });
    }
  }

  // Metraje
  if (opportunity.areaM2 != null && listing.areaM2 != null) {
    const pctBelow = ((opportunity.areaM2 - listing.areaM2) / opportunity.areaM2) * 100;
    const deduction = gradedDeduction(pctBelow, WEIGHTS.areaPerPct, WEIGHTS.areaMax);
    total -= deduction;
    if (deduction > 0) {
      diffs.push({ text: `${Math.round(pctBelow)}% menos metraje del que buscabas`, weight: deduction });
    }
  }

  // Banos completos
  if (opportunity.bathrooms != null && listing.bathrooms != null) {
    const deficit = opportunity.bathrooms - listing.bathrooms;
    const deduction = gradedDeduction(deficit, WEIGHTS.bathroomsPerUnit, WEIGHTS.bathroomsMax);
    total -= deduction;
    if (deduction > 0) {
      diffs.push({ text: `tiene ${listing.bathrooms} baños completos y buscabas ${opportunity.bathrooms}`, weight: deduction });
    }
  }

  // Parqueos
  if (opportunity.parkingSpaces != null && listing.parkingSpaces != null) {
    const deficit = opportunity.parkingSpaces - listing.parkingSpaces;
    const deduction = gradedDeduction(deficit, WEIGHTS.parkingPerUnit, WEIGHTS.parkingMax);
    total -= deduction;
    if (deduction > 0) {
      diffs.push({ text: `tiene ${listing.parkingSpaces} parqueos y buscabas ${opportunity.parkingSpaces}`, weight: deduction });
    }
  }

  // Antiguedad - hoy nunca llega poblado desde Pedidos (ver comentario en el
  // tipo), se deja implementado para cuando exista el campo.
  if (opportunity.antiguedadPreferida != null && listing.antiguedad != null) {
    const matches = opportunity.antiguedadPreferida === listing.antiguedad;
    if (!matches) {
      total -= WEIGHTS.antiguedadMax;
      diffs.push({ text: 'antigüedad distinta a la que buscabas', weight: WEIGHTS.antiguedadMax });
    }
  }

  // Interruptores de preferencia (seccion 2.7f) - indiferente (null/undefined) no pondera.
  const prefChecks: Array<{ pref?: string | null; hasIt: boolean; label: string }> = [
    { pref: opportunity.prefAreaVerdeAmplia, hasIt: listingHasAreaVerdeAmplia(listing), label: 'área verde amplia' },
    { pref: opportunity.prefAreasComunales, hasIt: listing.areasComunales === true, label: 'áreas comunales' },
    { pref: opportunity.prefAscensor, hasIt: listing.tieneAscensor === true, label: 'ascensor' },
    {
      pref: opportunity.prefAmoblado,
      hasIt: listing.amoblado === 'SI' || listing.amoblado === 'SEMI',
      label: 'amoblado',
    },
    { pref: opportunity.prefTodosLosServicios, hasIt: listing.serviciosBasicos === 'TODOS', label: 'todos los servicios' },
  ];
  for (const check of prefChecks) {
    if (check.pref !== 'SI' && check.pref !== 'NO') continue; // indiferente/no especificado
    if (check.pref === 'SI' && !check.hasIt) {
      total -= WEIGHTS.prefStrongMiss;
      diffs.push({ text: `sin ${check.label}`, weight: WEIGHTS.prefStrongMiss });
    } else if (check.pref === 'NO' && check.hasIt) {
      total -= WEIGHTS.prefWeakMiss;
      diffs.push({ text: `tiene ${check.label} y preferías que no`, weight: WEIGHTS.prefWeakMiss });
    }
  }

  // Medios banos (seccion 1.3b/2.3): bonus fijo si el inmueble los tiene,
  // siempre, sin que el pedido tenga que haberlo pedido - nunca resta.
  if (listing.mediosBanos && listing.mediosBanos > 0) {
    total += WEIGHTS.mediosBanosBonus;
  }

  const score = Math.max(0, Math.min(100, Math.round(total)));

  // 3) Explicacion (Parte 3): "Coincide en todo lo que pediste." si 100%, o
  // un lead-in fijo (los excluyentes ya coincidieron) + hasta 2 diferencias
  // de mayor peso + "y N diferencias mas" si sobran.
  let reasons: string[];
  if (score >= 100 || diffs.length === 0) {
    reasons = ['Coincide en todo lo que pediste.'];
  } else {
    const sorted = [...diffs].sort((a, b) => b.weight - a.weight);
    const shown = sorted.slice(0, 2).map((d) => d.text);
    reasons = ['Coincide en zona y precio', ...shown];
    if (sorted.length > 2) {
      const remaining = sorted.length - 2;
      reasons.push(`y ${remaining} ${pluralEs(remaining, 'diferencia más', 'diferencias más')}`);
    }
  }

  return { score, reasons };
}

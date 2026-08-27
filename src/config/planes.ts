// Fuente unica de verdad para precios, impuestos y features de cada plan
// (Basico/Pro). Prohibido hardcodear precios o listas de features fuera de
// este archivo - todo componente/ruta que necesite un precio, una etiqueta o
// la lista de features de un plan importa de aqui.

export type PlanTipo = 'BASICO' | 'PRO';

// IVA vigente en Ecuador. Todo impuesto de plan se calcula desde este numero,
// nunca se escribe un monto de impuesto a mano.
export const IVA_PORCENTAJE = 15;

// Features controladas por plan. mini_sitio, fichas_pdf, carta_presentacion y
// reporte_tasacion todavia no estan construidas (llegan en fases
// posteriores) - se declaran ya para que tieneAcceso() las contemple desde
// ahora y ningun modulo futuro tenga que tocar esta lista otra vez.
export type Feature =
  | 'matches_ilimitados'
  | 'gestion_inventario'
  | 'mapa_cierres_consulta'
  | 'carnet_estandar'
  | 'ranking'
  | 'seguimientos'
  | 'mini_sitio'
  | 'fichas_pdf'
  | 'carta_presentacion'
  | 'reporte_tasacion'
  | 'carnet_pro'
  | 'prioridad_matches';

export type PlanDefinicion = {
  tipo: PlanTipo;
  nombre: string;
  precioBase: number; // centavos
  impuesto: number; // centavos
  total: number; // centavos
  etiqueta: string;
  bajada: string;
  features: Feature[];
};

const FEATURES_BASICO: Feature[] = [
  'matches_ilimitados',
  'gestion_inventario',
  'mapa_cierres_consulta',
  'carnet_estandar',
  'ranking',
  'seguimientos',
];

const FEATURES_PRO: Feature[] = [
  ...FEATURES_BASICO,
  'mini_sitio',
  'fichas_pdf',
  'carta_presentacion',
  'reporte_tasacion',
  'carnet_pro',
  'prioridad_matches',
];

function calcularImpuesto(precioBaseCentavos: number): number {
  return Math.round((precioBaseCentavos * IVA_PORCENTAJE) / 100);
}

function construirPlan(input: {
  tipo: PlanTipo;
  nombre: string;
  precioBase: number;
  etiqueta: string;
  bajada: string;
  features: Feature[];
}): PlanDefinicion {
  const impuesto = calcularImpuesto(input.precioBase);
  return { ...input, impuesto, total: input.precioBase + impuesto };
}

export const PLANES: Record<PlanTipo, PlanDefinicion> = {
  BASICO: construirPlan({
    tipo: 'BASICO',
    nombre: 'Básico',
    precioBase: 899,
    etiqueta: '$8,99 + IVA',
    bajada: 'Lo esencial para hacer matches',
    features: FEATURES_BASICO,
  }),
  PRO: construirPlan({
    tipo: 'PRO',
    nombre: 'Pro',
    precioBase: 2499,
    etiqueta: '$24,99 + IVA',
    bajada: 'Tu vitrina profesional completa',
    features: FEATURES_PRO,
  }),
};

export function getPlan(tipo: PlanTipo): PlanDefinicion {
  return PLANES[tipo];
}

export function isPlanTipo(value: unknown): value is PlanTipo {
  return value === 'BASICO' || value === 'PRO';
}

// El checkout (?plan=basico|pro) y la pantalla de seleccion usan el nombre en
// minusculas en la URL - estos dos conversores son el unico lugar que conoce
// ese mapeo.
export function planTipoToParam(tipo: PlanTipo): 'basico' | 'pro' {
  return tipo === 'PRO' ? 'pro' : 'basico';
}

export function planParamToTipo(param: string | null | undefined): PlanTipo | null {
  if (param === 'pro') return 'PRO';
  if (param === 'basico') return 'BASICO';
  return null;
}

export function formatUsd(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export function planIncluyeFeature(tipo: PlanTipo, feature: Feature): boolean {
  return PLANES[tipo].features.includes(feature);
}

// Montos en centavos en el formato que exige la Cajita de Payphone, segun el
// plan elegido en el checkout (ver seccion 6 - checkout dual).
//
// `founderTotalCents` (Fase 7, seccion 9.4): precio fundador congelado del
// agente (Agent.precioFundadorBasico), SOLO aplicable al plan Basico. Cuando
// se pasa, reemplaza el total vigente y la base/impuesto se recalculan
// proporcionalmente (misma tasa de IVA) para que la Transaccion quede con un
// desglose consistente. Nunca se aplica al plan Pro - el llamador debe pasar
// `undefined`/`null` para Pro.
export function getCheckoutAmountsInCents(
  tipo: PlanTipo,
  founderTotalCents?: number | null,
): {
  amount: number;
  amountWithoutTax: number;
  amountWithTax: number;
  tax: number;
  service: number;
  tip: number;
} {
  const plan = PLANES[tipo];
  const usaFundador = tipo === 'BASICO' && Boolean(founderTotalCents);
  const total = usaFundador ? (founderTotalCents as number) : plan.total;
  const precioBase = usaFundador ? Math.round(total / (1 + IVA_PORCENTAJE / 100)) : plan.precioBase;
  const impuesto = usaFundador ? total - precioBase : plan.impuesto;
  return {
    amount: total,
    amountWithoutTax: 0,
    amountWithTax: precioBase,
    tax: impuesto,
    service: 0,
    tip: 0,
  };
}

export function getCheckoutReference(tipo: PlanTipo, lang: 'es' | 'en' = 'es'): string {
  if (lang === 'en') return tipo === 'PRO' ? 'Redinmo Pro subscription' : 'Redinmo Basic subscription';
  return tipo === 'PRO' ? 'Suscripcion Pro Redinmo' : 'Suscripcion Basico Redinmo';
}

// Features que se pierden al bajar de Pro a Basico - usado en el aviso de
// downgrade (seccion 7.2) para mostrar exactamente que se pierde.
export function featuresPerdidasEnDowngrade(): Feature[] {
  return FEATURES_PRO.filter((f) => !FEATURES_BASICO.includes(f));
}

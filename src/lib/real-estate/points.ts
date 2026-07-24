// Tabla de puntos configurable: fuente unica de verdad para toda la app (backend y
// frontend). No hardcodear estos valores en ningun otro archivo - siempre importar
// de aqui.
export type PointActionKey =
  | 'PROFILE_COMPLETE'
  | 'LISTING_CREATED'
  | 'PEDIDO_CREATED'
  | 'MATCH_RECEIVED'
  | 'MATCH_CONTACTED'
  | 'VISIT_SCHEDULED'
  | 'CLOSING_REGISTERED'
  | 'FIRST_MATCH_OF_MONTH_BONUS'
  | 'STREAK_3_MONTHS_BONUS'
  | 'REFERRAL_SIGNUP'
  | 'REFERRAL_ACTIVATED_BONUS'
  | 'LISTING_PHOTO_ADDED';

export type PointActionDef = {
  points: number;
  labelEs: string;
  labelEn: string;
  // Redaccion en primera persona/pasado para el feed de "Tu actividad reciente"
  // (ej. "Registraste un Precio de cierre"), distinta de labelEs/labelEn que se
  // usan en el listado "Como ganar puntos" (infinitivo).
  pastLabelEs: string;
  pastLabelEn: string;
  icon: string;
  oncePerAgent?: boolean;
  bonus?: boolean;
};

export const POINT_ACTIONS: Record<PointActionKey, PointActionDef> = {
  CLOSING_REGISTERED: {
    points: 75,
    labelEs: 'Registrar un precio de cierre',
    labelEn: 'Register a closing price',
    pastLabelEs: 'Registraste un Precio de cierre',
    pastLabelEn: 'You registered a Closing Price',
    icon: '🏆',
  },
  REFERRAL_SIGNUP: {
    points: 40,
    labelEs: 'Un colega se registra con tu invitación',
    labelEn: 'A colleague signs up with your invitation',
    pastLabelEs: 'Invitaste a un colega a Redinmo',
    pastLabelEn: 'You invited a colleague to Redinmo',
    icon: '🎁',
  },
  STREAK_3_MONTHS_BONUS: {
    points: 50,
    labelEs: 'Racha de 3 meses consecutivos activo',
    labelEn: '3-month consecutive activity streak',
    pastLabelEs: 'Bono: racha de 3 meses activo',
    pastLabelEn: 'Bonus: 3-month streak active',
    icon: '🔥',
    bonus: true,
  },
  REFERRAL_ACTIVATED_BONUS: {
    points: 30,
    labelEs: 'Tu colega referido carga su primer inmueble o pedido',
    labelEn: 'Your referred colleague adds their first listing or request',
    pastLabelEs: 'Tu invitado activó su cuenta y cargó su primer inmueble',
    pastLabelEn: 'Your invitee activated their account and added their first listing',
    icon: '🚀',
    bonus: true,
  },
  MATCH_RECEIVED: {
    points: 25,
    labelEs: 'Recibir un match',
    labelEn: 'Receive a match',
    pastLabelEs: 'Recibiste un match',
    pastLabelEn: 'You received a match',
    icon: '🤝',
  },
  VISIT_SCHEDULED: {
    points: 25,
    labelEs: 'Agendar una visita',
    labelEn: 'Schedule a visit',
    pastLabelEs: 'Agendaste una visita',
    pastLabelEn: 'You scheduled a visit',
    icon: '📅',
  },
  MATCH_CONTACTED: {
    points: 20,
    labelEs: 'Contactar un match / dar seguimiento',
    labelEn: 'Contact a match / follow up',
    pastLabelEs: 'Contactaste un match',
    pastLabelEn: 'You contacted a match',
    icon: '📞',
  },
  LISTING_CREATED: {
    points: 15,
    labelEs: 'Cargar un inmueble',
    labelEn: 'Add a listing',
    pastLabelEs: 'Cargaste un Inmueble',
    pastLabelEn: 'You added a Listing',
    icon: '🏠',
  },
  PEDIDO_CREATED: {
    points: 15,
    labelEs: 'Cargar un pedido',
    labelEn: 'Add a request',
    pastLabelEs: 'Cargaste un Pedido',
    pastLabelEn: 'You added a Request',
    icon: '📋',
  },
  FIRST_MATCH_OF_MONTH_BONUS: {
    points: 15,
    labelEs: 'Bono: primer match del mes',
    labelEn: 'Bonus: first match of the month',
    pastLabelEs: 'Bono: tu primer match del mes',
    pastLabelEn: 'Bonus: your first match of the month',
    icon: '✨',
    bonus: true,
  },
  PROFILE_COMPLETE: {
    points: 10,
    labelEs: 'Completar tu perfil',
    labelEn: 'Complete your profile',
    pastLabelEs: 'Completaste tu perfil',
    pastLabelEn: 'You completed your profile',
    icon: '🧾',
    oncePerAgent: true,
  },
  LISTING_PHOTO_ADDED: {
    points: 10,
    labelEs: 'Foto de portada en un inmueble',
    labelEn: 'Cover photo on a listing',
    pastLabelEs: 'Agregaste una foto a un inmueble',
    pastLabelEn: 'You added a photo to a listing',
    icon: '📸',
  },
};

// Orden de mayor a menor puntaje, para el desglose "como ganar mas puntos".
export const POINT_ACTIONS_BY_VALUE: Array<{ key: PointActionKey; def: PointActionDef }> = (
  Object.entries(POINT_ACTIONS) as Array<[PointActionKey, PointActionDef]>
)
  .map(([key, def]) => ({ key, def }))
  .sort((a, b) => b.def.points - a.def.points);

export type RankingLevelKey = 'BROKER_INICIAL' | 'BROKER_ACTIVO' | 'BROKER_CONFIABLE' | 'BROKER_ELITE' | 'TOP_BROKER';

export type RankingLevelDef = {
  key: RankingLevelKey;
  labelEs: string;
  labelEn: string;
  min: number;
  max: number;
  badge: string | null;
  featured?: boolean;
};

// Nombres de nivel unificados en toda la app (dashboard, login, carnet compartido):
// "Agente X", nunca "Broker X". Los umbrales y colores de nivel (bronce/plata/oro/
// teal) se leen siempre de aqui - nunca hardcodeados en un componente. El campo
// `key` interno se conserva como BROKER_* por compatibilidad con datos/logica
// existente; solo cambian las etiquetas visibles labelEs/labelEn.
export const RANKING_LEVELS: RankingLevelDef[] = [
  { key: 'BROKER_INICIAL', labelEs: 'Agente Inicial', labelEn: 'Starter Agent', min: 0, max: 149, badge: null },
  { key: 'BROKER_ACTIVO', labelEs: 'Agente Activo', labelEn: 'Active Agent', min: 150, max: 499, badge: '🥉' },
  { key: 'BROKER_CONFIABLE', labelEs: 'Agente Confiable', labelEn: 'Trusted Agent', min: 500, max: 1199, badge: '🥈', featured: true },
  { key: 'BROKER_ELITE', labelEs: 'Agente Elite', labelEn: 'Elite Agent', min: 1200, max: 2999, badge: '🥇' },
  { key: 'TOP_BROKER', labelEs: 'Top Agente', labelEn: 'Top Agent', min: 3000, max: Infinity, badge: '👑' },
];

export const LEVEL_COLORS: Record<RankingLevelKey, string> = {
  BROKER_INICIAL: '#62667f',
  BROKER_ACTIVO: '#d9985f',
  BROKER_CONFIABLE: '#c8cfda',
  BROKER_ELITE: '#f5c044',
  TOP_BROKER: '#b7a5ff',
};

// Lookup seguro para componentes que reciben el nivel ya serializado del cliente
// (key: string, no el union literal) - ej. el carnet de Ranking o el avatar del Top 10.
export function levelColorFor(levelKey: string): string {
  return LEVEL_COLORS[levelKey as RankingLevelKey] ?? LEVEL_COLORS.BROKER_INICIAL;
}

export function levelForPoints(points: number): RankingLevelDef {
  return RANKING_LEVELS.find((l) => points >= l.min && points <= l.max) ?? RANKING_LEVELS[0];
}

export function nextLevelForPoints(points: number): RankingLevelDef | null {
  const idx = RANKING_LEVELS.findIndex((l) => points >= l.min && points <= l.max);
  if (idx < 0 || idx === RANKING_LEVELS.length - 1) return null;
  return RANKING_LEVELS[idx + 1];
}

// % de llenado dentro del nivel actual (0-100): usado tanto por el anillo de Gestion
// como por la barra de Ranking, para que ambos midan exactamente lo mismo. Solo usa
// `.min` de cada nivel, asi que acepta tanto RankingLevelDef (backend) como su
// version serializada para el cliente (key: string en vez del union literal).
export function progressWithinLevel(totalPoints: number, level: { min: number }, nextLevel: { min: number } | null): number {
  if (!nextLevel) return 100;
  const span = nextLevel.min - level.min;
  const progressed = totalPoints - level.min;
  return Math.min(100, Math.max(0, Math.round((progressed / span) * 100)));
}

export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Reportes a clientes (Fase 9). Tipos, constantes y reglas puras compartidas
// entre la pantalla y el servidor: sin Prisma ni Node, para que el formulario
// del celular pueda importar esto sin arrastrar el backend.

// ---- Reporte de visita ----------------------------------------------------

export const REACCIONES_VISITA = ['MUY_INTERESADO', 'INTERESADO_CON_REPAROS', 'NO_INTERESADO'] as const;
export type ReaccionVisita = (typeof REACCIONES_VISITA)[number];

// Texto que va impreso en el documento. El propietario lee español; la
// pantalla usa las claves del diccionario.
export const REACCION_IMPRESA: Record<ReaccionVisita, string> = {
  MUY_INTERESADO: 'Muy interesado',
  INTERESADO_CON_REPAROS: 'Interesado, con reparos',
  NO_INTERESADO: 'No interesado',
};

// Duraciones que se eligen con un toque. De pie en el inmueble nadie teclea
// "35 minutos".
export const DURACIONES_VISITA = [15, 30, 45, 60, 90] as const;

// Topes de largo. El reporte es UNA hoja A4: sin tope, una observacion larga
// empuja la firma y la foto fuera de la pagina.
export const VISITA_LIMITES = {
  nombre: 120,
  cedula: 13,
  acompanantes: 160,
  observaciones: 500,
  objeciones: 400,
  proximoPaso: 200,
} as const;

export type ConsentimientoFoto = { respaldo: boolean; redes: boolean };

export type ResultadoConsentimiento =
  | { ok: true; guardarFoto: boolean; redes: boolean }
  | { ok: false; error: string };

// Regla legal de la foto del visitante (punto 3.3), en un solo lugar para que
// la pantalla y el servidor no puedan discrepar:
//   - Sin el primer consentimiento, la foto NO se guarda. Si llega una foto sin
//     el, se rechaza el envio en vez de descartarla en silencio: el agente
//     tiene que saber que la foto no quedo.
//   - El segundo es independiente y opcional, pero no existe sin el primero:
//     no se puede autorizar publicar una foto que no se autorizo guardar.
export function validarConsentimientoFoto(tieneFoto: boolean, c: ConsentimientoFoto): ResultadoConsentimiento {
  if (!tieneFoto) return { ok: true, guardarFoto: false, redes: false };
  if (!c.respaldo) {
    return {
      ok: false,
      error: 'Sin la autorización del visitante para usar la foto como respaldo, la foto no se puede guardar.',
    };
  }
  return { ok: true, guardarFoto: true, redes: c.redes };
}

// En el documento que recibe el propietario la cedula sale enmascarada, con
// los ultimos 4 digitos: alcanza para identificar al visitante si hace falta
// demostrar la visita, sin entregar el numero completo de un tercero. Es el
// mismo criterio que usan los contratos (cedulaUlt4).
export function cedulaEnmascarada(ult4: string | null | undefined): string | null {
  if (!ult4) return null;
  return `•••••• ${ult4}`;
}

export function ultimos4(cedula: string): string {
  const digitos = cedula.replace(/\D/g, '');
  return digitos.slice(-4);
}

// ---- Reporte de gestion ---------------------------------------------------

export const PERIODICIDADES = ['SEMANAL', 'MENSUAL'] as const;
export type Periodicidad = (typeof PERIODICIDADES)[number];

export const DIAS_POR_PERIODO: Record<Periodicidad, number> = { SEMANAL: 7, MENSUAL: 30 };

export const CANALES_DIFUSION = ['REDINMO', 'PORTAL', 'REDES', 'GRUPOS', 'OTRO'] as const;
export type CanalDifusion = (typeof CANALES_DIFUSION)[number];

export const CANAL_IMPRESO: Record<CanalDifusion, string> = {
  REDINMO: 'Redinmo',
  PORTAL: 'Portal inmobiliario',
  REDES: 'Redes sociales',
  GRUPOS: 'Grupos de agentes',
  OTRO: 'Otro',
};

export type EntradaDifusion = { canal: CanalDifusion; nombre: string; enlace: string | null };

export const GESTION_LIMITES = {
  difusionMaxima: 8,
  nombreCanal: 60,
  enlace: 300,
  observaciones: 900,
} as const;

// Muestra minima para comparar contra el sector. Con menos, un promedio no
// dice nada y el reporte no lo muestra.
export const GESTION_MINIMO_SIMILARES = 5;

// La actividad se considera baja si queda por debajo de esta fraccion del
// promedio del sector. Solo se le avisa al agente, nunca al propietario.
export const GESTION_UMBRAL_ACTIVIDAD_BAJA = 0.5;

export type DatosGestion = {
  inmueble: {
    titulo: string;
    tipo: string;
    operacion: string;
    sector: string;
    precio: number;
    moneda: string;
    metraje: number | null;
    publicadoDesde: string;
  };
  periodo: { desde: string; hasta: string; periodicidad: Periodicidad };
  actividad: {
    visualizaciones: number;
    matches: number;
    colegasInteresados: number;
  };
  visitas: { cantidad: number; fechas: string[] };
  interesados: { consultas: number; visitasAgendadas: number; enNegociacion: number };
  comparativo: {
    similares: number;
    diasPromedioPublicados: number | null;
    precioM2Referencia: number | null;
    cierresReferencia: number;
  } | null;
  acumulado: { semanas: number; visitas: number; consultas: number };
};

// ---- Reporte de tasacion --------------------------------------------------

export const TASACION_MINIMO_CIERRES = 5;
export const TASACION_COMPARABLES_MAXIMO = 5;
export const TASACION_COMPARABLES_MINIMO = 3;

// Texto obligatorio del punto 1.4. Vive como constante y la plantilla lo
// imprime tal cual: no pasa por ningun campo que el agente pueda editar.
export const ADVERTENCIA_TASACION =
  'Este reporte es una referencia de mercado basada en operaciones registradas por agentes en Redinmo. No constituye un avalúo profesional ni sustituye la valoración de un perito autorizado.';

export function mensajeSinCierres(sector: string): string {
  return `Aún no hay suficientes cierres registrados en ${sector} para generar un reporte confiable. Registra tus cierres y anima a tus colegas: el mapa se construye entre todos.`;
}

// ---- Comun ----------------------------------------------------------------

export const REPORTE_PALETAS = ['clara', 'oscura'] as const;
export type ReportePaleta = (typeof REPORTE_PALETAS)[number];

export const REPORTE_FORMATOS = ['pdf', 'png'] as const;
export type ReporteFormato = (typeof REPORTE_FORMATOS)[number];

export function esPaleta(valor: unknown): valor is ReportePaleta {
  return valor === 'clara' || valor === 'oscura';
}

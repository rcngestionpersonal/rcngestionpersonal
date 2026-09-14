import { z } from 'zod';
import { ANTIGUEDAD_OPTIONS, TIEMPO_MERCADO_OPTIONS, pricePerM2 } from '@/lib/real-estate/closed-deals-config';
import { propertyTypeLabelEs } from '@/lib/real-estate/labels';
import { mediana, percentil } from './estadistica';
import {
  TASACION_COMPARABLES_MAXIMO,
  TASACION_COMPARABLES_MINIMO,
  TASACION_MINIMO_CIERRES,
  mensajeSinCierres,
} from './tipos';

// Reporte de tasacion (punto 1). ESTADO: en construccion. Depende del volumen
// del Mapa de Cierres, que hoy no alcanza: con menos de 5 cierres en el sector
// el reporte NO se genera, y eso se decide aqui, en un solo lugar.
//
// PRIVACIDAD (punto 1.5): de cada cierre solo se usan tipo, metraje,
// antiguedad, precio y $/m2. Nunca la fecha, la ubicacion exacta, la
// direccion ni el agente que lo registro. Ademas precio y metraje se
// redondean: con la cifra exacta, quien participo en una operacion podria
// reconocerla en el reporte.

export const OPERACIONES_TASACION = ['SALE', 'RENT'] as const;

// Desde el inventario basta el listingId: tipo, operacion, zona y metraje
// salen del inmueble. A mano, esos cuatro son obligatorios.
export const tasacionSchema = z
  .object({
  listingId: z.string().optional().nullable(),
  titulo: z.string().trim().max(120).optional().nullable(),
  tipo: z.string().min(1).optional(),
  operacion: z.enum(OPERACIONES_TASACION).optional(),
  zona: z.string().min(1).optional(),
  metraje: z.coerce.number().positive().max(100_000).optional(),
  antiguedad: z.string().optional().nullable(),
  dormitorios: z.coerce.number().int().min(0).max(50).optional().nullable(),
  banos: z.coerce.number().int().min(0).max(50).optional().nullable(),
  parqueaderos: z.coerce.number().int().min(0).max(50).optional().nullable(),
  precioActual: z.coerce.number().positive().optional().nullable(),
  })
  .refine((e) => Boolean(e.listingId) || (Boolean(e.tipo) && Boolean(e.operacion) && Boolean(e.zona) && Boolean(e.metraje)), {
    message: 'Completa tipo, operación, sector y metraje.',
  });

export type EntradaCruda = z.infer<typeof tasacionSchema>;

// La entrada ya resuelta, con los cuatro datos garantizados.
export type EntradaTasacion = EntradaCruda & { tipo: string; operacion: (typeof OPERACIONES_TASACION)[number]; zona: string; metraje: number };

export type CierreParaTasacion = {
  propertyType: string;
  price: number;
  areaM2: number | null;
  landAreaM2: number | null;
  antiguedad: string | null;
  timeOnMarket: string | null;
};

export type Comparable = { tipo: string; metraje: number; antiguedad: string; precio: number; precioM2: number };

export type DatosTasacion = {
  inmueble: { titulo: string; tipo: string; operacion: string; sector: string; metraje: number; caracteristicas: string[] };
  cierres: number;
  precioM2: { mediana: number; p25: number; p75: number };
  rango: { minimo: number; maximo: number; central: number };
  comparables: Comparable[];
  puntos: Array<{ metraje: number; precio: number }>;
  tiempoMercado: string | null;
  conclusion: string;
  esArriendo: boolean;
};

export type ResultadoTasacion =
  | { disponible: false; sector: string; cierres: number; mensaje: string }
  | { disponible: true; datos: DatosTasacion };

function pasoDePrecio(valor: number, arriendo: boolean): number {
  return arriendo ? 10 : valor >= 100_000 ? 1_000 : 500;
}

function redondearPrecio(valor: number, arriendo: boolean, modo: 'cerca' | 'abajo' | 'arriba' = 'cerca'): number {
  const paso = pasoDePrecio(valor, arriendo);
  const f = modo === 'abajo' ? Math.floor : modo === 'arriba' ? Math.ceil : Math.round;
  return f(valor / paso) * paso;
}

function redondearMetraje(valor: number): number {
  return valor >= 100 ? Math.round(valor / 5) * 5 : Math.round(valor);
}

function etiquetaAntiguedad(valor: string | null): string {
  return ANTIGUEDAD_OPTIONS.find((o) => o.value === valor)?.labelEs ?? 'No indicada';
}

function metrajeDe(c: CierreParaTasacion): number | null {
  const m = c.propertyType === 'LAND' ? c.landAreaM2 : c.areaM2;
  return m && m > 0 ? m : null;
}

function dinero(valor: number): string {
  return `$${Math.round(valor).toLocaleString('es-EC')}`;
}

export function analizarTasacion(
  entrada: EntradaTasacion,
  sector: string,
  cierres: CierreParaTasacion[],
  titulo: string,
): ResultadoTasacion {
  const validos = cierres
    .map((c) => ({ c, m2: metrajeDe(c), ppm2: pricePerM2(c) }))
    .filter((x): x is { c: CierreParaTasacion; m2: number; ppm2: number } => x.m2 !== null && typeof x.ppm2 === 'number' && x.ppm2 > 0);

  // La salvaguarda del punto 1.2. Cuenta solo cierres con metraje y precio
  // utilizables: un cierre sin metraje no aporta un $/m2 y no puede sostener
  // un rango.
  if (validos.length < TASACION_MINIMO_CIERRES) {
    return { disponible: false, sector, cierres: validos.length, mensaje: mensajeSinCierres(sector) };
  }

  const arriendo = entrada.operacion === 'RENT';
  const precios = validos.map((v) => v.ppm2);
  const p25 = percentil(precios, 0.25) as number;
  const p75 = percentil(precios, 0.75) as number;
  const central = mediana(precios) as number;

  // Comparables: los mas parecidos en metraje, desempatando por antiguedad.
  const comparables = [...validos]
    .sort((a, b) => {
      const da = Math.abs(a.m2 - entrada.metraje) / entrada.metraje;
      const db = Math.abs(b.m2 - entrada.metraje) / entrada.metraje;
      if (Math.abs(da - db) > 0.05) return da - db;
      const aa = a.c.antiguedad === entrada.antiguedad ? 0 : 1;
      const ab = b.c.antiguedad === entrada.antiguedad ? 0 : 1;
      return aa - ab;
    })
    .slice(0, Math.max(TASACION_COMPARABLES_MINIMO, Math.min(TASACION_COMPARABLES_MAXIMO, validos.length)))
    .map((v) => ({
      tipo: capital(propertyTypeLabelEs(v.c.propertyType)),
      metraje: redondearMetraje(v.m2),
      antiguedad: etiquetaAntiguedad(v.c.antiguedad),
      precio: redondearPrecio(v.c.price, arriendo),
      precioM2: Math.round(v.ppm2),
    }));

  // Tiempo en mercado: la franja mas frecuente, y solo si la reportaron al
  // menos tantos cierres como los que exige el reporte.
  const conTiempo = validos.map((v) => v.c.timeOnMarket).filter((t): t is string => Boolean(t));
  let tiempoMercado: string | null = null;
  if (conTiempo.length >= TASACION_MINIMO_CIERRES) {
    const cuenta = new Map<string, number>();
    for (const t of conTiempo) cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
    const [masFrecuente] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
    tiempoMercado = TIEMPO_MERCADO_OPTIONS.find((o) => o.value === masFrecuente)?.labelEs ?? null;
  }

  const rango = {
    // El minimo baja y el maximo sube al redondear: redondeando los dos al mas
    // cercano, con cierres parecidos el rango colapsaba en un solo numero.
    minimo: redondearPrecio(p25 * entrada.metraje, arriendo, 'abajo'),
    maximo: redondearPrecio(p75 * entrada.metraje, arriendo, 'arriba'),
    central: redondearPrecio(central * entrada.metraje, arriendo),
  };

  const tipoPlural = pluralTipo(propertyTypeLabelEs(entrada.tipo));
  const unidad = arriendo ? ' mensuales' : '';
  const partes = [
    `Según ${validos.length} ${arriendo ? 'arriendos' : 'ventas'} de ${tipoPlural} registradas en ${sector}, un inmueble de ${Math.round(entrada.metraje)} m² se ubica entre ${dinero(rango.minimo)} y ${dinero(rango.maximo)}${unidad}, con un valor central cercano a ${dinero(rango.central)}.`,
  ];
  if (entrada.precioActual) {
    const p = entrada.precioActual;
    if (p > rango.maximo) {
      partes.push(`El precio actual de ${dinero(p)} está ${Math.round(((p - rango.maximo) / rango.maximo) * 100)}% por encima del rango del sector.`);
    } else if (p < rango.minimo) {
      partes.push(`El precio actual de ${dinero(p)} está ${Math.round(((rango.minimo - p) / rango.minimo) * 100)}% por debajo del rango del sector.`);
    } else {
      partes.push(`El precio actual de ${dinero(p)} está dentro del rango del sector.`);
    }
  }
  if (tiempoMercado) partes.push(`La mayoría de estas operaciones se cerró en ${tiempoMercado.toLowerCase()}.`);

  const caracteristicas = [
    entrada.antiguedad && ANTIGUEDAD_OPTIONS.some((o) => o.value === entrada.antiguedad) ? `Antigüedad: ${etiquetaAntiguedad(entrada.antiguedad)}` : null,
    entrada.dormitorios ? `${entrada.dormitorios} dormitorios` : null,
    entrada.banos ? `${entrada.banos} baños` : null,
    entrada.parqueaderos ? `${entrada.parqueaderos} parqueaderos` : null,
  ].filter((x): x is string => Boolean(x));

  return {
    disponible: true,
    datos: {
      inmueble: {
        titulo,
        tipo: capital(propertyTypeLabelEs(entrada.tipo)),
        operacion: arriendo ? 'Arriendo' : 'Venta',
        sector,
        // El inmueble analizado no es anonimo: es el del propietario. Solo se
        // redondean los cierres ajenos.
        metraje: Math.round(entrada.metraje),
        caracteristicas,
      },
      cierres: validos.length,
      precioM2: { mediana: Math.round(central), p25: Math.round(p25), p75: Math.round(p75) },
      rango,
      comparables,
      puntos: validos.map((v) => ({ metraje: redondearMetraje(v.m2), precio: redondearPrecio(v.c.price, arriendo) })),
      tiempoMercado,
      conclusion: partes.join(' '),
      esArriendo: arriendo,
    },
  };
}

function capital(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function pluralTipo(t: string): string {
  if (t.includes('/')) return t;
  return t
    .split(' ')
    .map((p, i) => (i === 0 ? (/[aeiou]$/i.test(p) ? `${p}s` : `${p}es`) : p))
    .join(' ');
}

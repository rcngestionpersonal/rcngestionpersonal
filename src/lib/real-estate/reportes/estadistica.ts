// Calculos puros de los reportes de gestion y tasacion. Sin Prisma: se prueban
// solos y el servidor les pasa los datos ya leidos.

import { GESTION_UMBRAL_ACTIVIDAD_BAJA } from './tipos';

const DIA_MS = 24 * 60 * 60 * 1000;

export function mediana(valores: number[]): number | null {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 === 0 ? (v[m - 1] + v[m]) / 2 : v[m];
}

// Percentil por interpolacion lineal. Con la mitad central (P25-P75) se arma el
// rango de la tasacion: los extremos de una muestra chica son justo los cierres
// raros, y un rango que los incluya no le sirve a nadie.
export function percentil(valores: number[], p: number): number | null {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const pos = (v.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  return v[base + 1] !== undefined ? v[base] + resto * (v[base + 1] - v[base]) : v[base];
}

// Una visita registrada con reporte y la misma visita marcada en el seguimiento
// de un match son UNA visita, no dos. No hay un vinculo entre ambas, asi que se
// cuenta como la misma si caen el mismo dia calendario (hora de Ecuador).
export function visitasSinDuplicar(deReportes: Date[], deSeguimientos: Date[]): Date[] {
  const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
  const diasConReporte = new Map<string, number>();
  for (const d of deReportes) diasConReporte.set(dia(d), (diasConReporte.get(dia(d)) ?? 0) + 1);

  const extra: Date[] = [];
  const usados = new Map<string, number>();
  for (const d of deSeguimientos) {
    const k = dia(d);
    const disponibles = (diasConReporte.get(k) ?? 0) - (usados.get(k) ?? 0);
    if (disponibles > 0) usados.set(k, (usados.get(k) ?? 0) + 1);
    else extra.push(d);
  }
  return [...deReportes, ...extra].sort((a, b) => a.getTime() - b.getTime());
}

// "Van 6 semanas de gestion". Semanas cumplidas, con un minimo de 1: la primera
// semana de gestion ya es gestion.
export function semanasDeGestion(desde: Date, hasta: Date): number {
  return Math.max(1, Math.floor((hasta.getTime() - desde.getTime()) / (7 * DIA_MS)));
}

export function diasEntre(desde: Date, hasta: Date): number {
  return Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / DIA_MS));
}

// Periodo del reporte. Si el anterior es reciente, el nuevo empieza donde
// termino aquel: los reportes seguidos no se pisan ni dejan huecos.
export function periodoSiguiente(ahora: Date, dias: number, hastaAnterior: Date | null): { desde: Date; hasta: Date } {
  const porDefecto = new Date(ahora.getTime() - dias * DIA_MS);
  if (hastaAnterior && hastaAnterior < ahora && ahora.getTime() - hastaAnterior.getTime() <= dias * 2 * DIA_MS) {
    return { desde: hastaAnterior, hasta: ahora };
  }
  return { desde: porDefecto, hasta: ahora };
}

// Punto 2.3: la actividad es baja si queda por debajo de una fraccion del
// promedio de inmuebles similares. Solo con muestra suficiente y un promedio
// que no sea cero: "cero contra cero" no dice que el precio este mal.
export function actividadBaja(propia: number, promedioSector: number | null, muestra: number, minimo: number): boolean {
  if (promedioSector === null || muestra < minimo || promedioSector <= 0) return false;
  return propia < promedioSector * GESTION_UMBRAL_ACTIVIDAD_BAJA;
}

import { describe, expect, it } from 'vitest';
import { actividadBaja, mediana, percentil, periodoSiguiente, semanasDeGestion, visitasSinDuplicar } from './estadistica';
import { difusionSchema } from './gestion-datos';

const DIA = 24 * 60 * 60 * 1000;

describe('reporte de gestión: cálculos', () => {
  it('una visita con reporte y la misma en el seguimiento cuentan una sola vez', () => {
    // 10:00 y 17:00 UTC del mismo dia en Quito (UTC-5).
    const conReporte = [new Date('2026-09-10T15:00:00Z')];
    const seguimiento = [new Date('2026-09-10T22:00:00Z'), new Date('2026-09-12T15:00:00Z')];
    const visitas = visitasSinDuplicar(conReporte, seguimiento);
    expect(visitas).toHaveLength(2);
  });

  it('dos visitas registradas el mismo día con reporte son dos', () => {
    const visitas = visitasSinDuplicar([new Date('2026-09-10T15:00:00Z'), new Date('2026-09-10T20:00:00Z')], []);
    expect(visitas).toHaveLength(2);
  });

  it('el día se cuenta en hora de Ecuador, no en UTC', () => {
    // 23:30 del 10 en Quito es 04:30 UTC del 11: siguen siendo el mismo dia.
    const visitas = visitasSinDuplicar([new Date('2026-09-11T04:30:00Z')], [new Date('2026-09-10T16:00:00Z')]);
    expect(visitas).toHaveLength(1);
  });

  it('semanas de gestión: cumplidas y al menos una', () => {
    const inicio = new Date('2026-08-01T00:00:00Z');
    expect(semanasDeGestion(inicio, new Date(inicio.getTime() + 3 * DIA))).toBe(1);
    expect(semanasDeGestion(inicio, new Date(inicio.getTime() + 44 * DIA))).toBe(6);
  });

  it('el período nuevo empieza donde terminó el anterior si es reciente', () => {
    const ahora = new Date('2026-09-14T12:00:00Z');
    const anterior = new Date('2026-09-06T12:00:00Z');
    expect(periodoSiguiente(ahora, 7, anterior).desde).toEqual(anterior);
  });

  it('si el anterior es viejo, el período es el estándar', () => {
    const ahora = new Date('2026-09-14T12:00:00Z');
    const r = periodoSiguiente(ahora, 7, new Date('2026-08-01T00:00:00Z'));
    expect(ahora.getTime() - r.desde.getTime()).toBe(7 * DIA);
  });

  it('actividad baja solo con muestra suficiente y un sector que sí se mueve', () => {
    expect(actividadBaja(0.5, 2, 8, 5)).toBe(true);
    expect(actividadBaja(1.5, 2, 8, 5)).toBe(false);
    // Muestra chica: no se compara.
    expect(actividadBaja(0, 2, 3, 5)).toBe(false);
    // Nadie en el sector recibe consultas: cero contra cero no dice nada del precio.
    expect(actividadBaja(0, 0, 8, 5)).toBe(false);
    expect(actividadBaja(0, null, 8, 5)).toBe(false);
  });

  it('mediana y percentiles', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(mediana([])).toBeNull();
    expect(percentil([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(percentil([10, 20, 30, 40, 50], 0.75)).toBe(40);
  });

  it('la difusión solo acepta enlaces http y un máximo de canales', () => {
    expect(difusionSchema.safeParse([{ canal: 'PORTAL', nombre: 'Plusvalía', enlace: 'https://plusvalia.com/x' }]).success).toBe(true);
    expect(difusionSchema.safeParse([{ canal: 'PORTAL', nombre: 'Plusvalía', enlace: 'javascript:alert(1)' }]).success).toBe(false);
    expect(difusionSchema.safeParse(Array.from({ length: 9 }, () => ({ canal: 'OTRO', nombre: 'x', enlace: null }))).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { analizarTasacion, type CierreParaTasacion } from './tasacion-datos';
import { mensajeSinCierres } from './tipos';
import { zonaDelMapa } from './zona';

// El reporte de tasacion depende de datos que todavia no existen. Lo que no
// puede fallar: que se niegue con menos de 5 cierres, y que nunca muestre algo
// que identifique una operacion.

const entrada = { tipo: 'APARTMENT', operacion: 'SALE' as const, zona: 'CENTRO_NORTE', metraje: 100, antiguedad: 'SEIS_A_QUINCE' };

function cierre(price: number, areaM2: number, extra: Partial<CierreParaTasacion> = {}): CierreParaTasacion {
  return { propertyType: 'APARTMENT', price, areaM2, landAreaM2: null, antiguedad: 'SEIS_A_QUINCE', timeOnMarket: 'UNO_A_TRES', ...extra };
}

describe('reporte de tasación', () => {
  it('con 4 cierres no se genera y da el mensaje exacto', () => {
    const r = analizarTasacion(entrada, 'Centro-Norte', [cierre(100000, 90), cierre(120000, 100), cierre(130000, 110), cierre(98000, 85)], 'x');
    expect(r.disponible).toBe(false);
    if (!r.disponible) {
      expect(r.mensaje).toBe(
        'Aún no hay suficientes cierres registrados en Centro-Norte para generar un reporte confiable. Registra tus cierres y anima a tus colegas: el mapa se construye entre todos.',
      );
      expect(r.mensaje).toBe(mensajeSinCierres('Centro-Norte'));
    }
  });

  it('un cierre sin metraje no cuenta para llegar a 5', () => {
    const cierres = [cierre(100000, 90), cierre(120000, 100), cierre(130000, 110), cierre(98000, 85), cierre(150000, 0)];
    expect(analizarTasacion(entrada, 'Centro-Norte', cierres, 'x').disponible).toBe(false);
  });

  it('con 5 cierres se genera: rango, $/m² y entre 3 y 5 comparables', () => {
    const cierres = [cierre(100000, 100), cierre(120000, 100), cierre(110000, 100), cierre(90000, 100), cierre(130000, 100), cierre(115000, 100)];
    const r = analizarTasacion({ ...entrada, precioActual: 150000 }, 'Centro-Norte', cierres, 'Depto');
    expect(r.disponible).toBe(true);
    if (!r.disponible) return;
    expect(r.datos.cierres).toBe(6);
    expect(r.datos.rango.minimo).toBeLessThanOrEqual(r.datos.rango.central);
    expect(r.datos.rango.central).toBeLessThanOrEqual(r.datos.rango.maximo);
    expect(r.datos.comparables.length).toBeGreaterThanOrEqual(3);
    expect(r.datos.comparables.length).toBeLessThanOrEqual(5);
    expect(r.datos.conclusion).toContain('por encima del rango');
    expect(r.datos.tiempoMercado).toBe('1-3 meses');
  });

  it('los comparables son anónimos: sin fecha, sin ubicación, sin agente, con cifras redondeadas', () => {
    const cierres = Array.from({ length: 6 }, (_, i) => cierre(123456 + i * 777, 97 + i));
    const r = analizarTasacion(entrada, 'Centro-Norte', cierres, 'Depto');
    if (!r.disponible) throw new Error('debia estar disponible');
    for (const c of r.datos.comparables) {
      expect(Object.keys(c).sort()).toEqual(['antiguedad', 'metraje', 'precio', 'precioM2', 'tipo']);
      expect(c.precio % 1000).toBe(0);
    }
    // Ninguna cifra exacta de un cierre aparece en el reporte.
    const texto = JSON.stringify(r.datos);
    expect(texto).not.toContain('123456');
    expect(texto).not.toContain('124233');
  });

  it('en arriendo redondea a decenas y habla de montos mensuales', () => {
    const cierres = Array.from({ length: 5 }, (_, i) => cierre(1234 + i * 13, 80, { antiguedad: null, timeOnMarket: null }));
    const r = analizarTasacion({ ...entrada, operacion: 'RENT' }, 'Centro-Norte', cierres, 'Depto');
    if (!r.disponible) throw new Error('debia estar disponible');
    expect(r.datos.comparables.every((c) => c.precio % 10 === 0)).toBe(true);
    expect(r.datos.conclusion).toContain('mensuales');
    expect(r.datos.tiempoMercado).toBeNull();
  });

  it('traduce el barrio del inmueble a la zona del Mapa de Cierres', () => {
    expect(zonaDelMapa('Bellavista')?.key).toBe('CENTRO_NORTE');
    expect(zonaDelMapa('Carcelen')?.key).toBe('NORTE');
    expect(zonaDelMapa('La Primavera')?.key).toBe('CUMBAYA_TUMBACO');
    expect(zonaDelMapa('CENTRO_NORTE')?.key).toBe('CENTRO_NORTE');
    expect(zonaDelMapa('Un barrio que no existe')).toBeNull();
  });
});

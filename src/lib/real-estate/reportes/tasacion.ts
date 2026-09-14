import { prisma } from '@/lib/prisma';
import { analizarTasacion, tasacionSchema, type EntradaCruda, type EntradaTasacion, type ResultadoTasacion } from './tasacion-datos';
import { inmuebleDelAgente, tipoImpreso } from './servidor';
import { zonaDelMapa } from './zona';

// Lado servidor de la tasacion. No se guarda: se calcula cada vez con los
// cierres de hoy, porque un rango de precios viejo guardado en un historial se
// leeria como vigente.

// Los parametros llegan por query string (descarga) o por JSON (envio). Los
// campos vacios se descartan antes de validar: "" no es un metraje.
// Tambien se descartan los campos que no son del inmueble (formato, paleta,
// destinatario), que viajan en el mismo objeto.
const NO_SON_DEL_INMUEBLE = new Set(['formato', 'paleta', 'previa', 'para', 'mensaje']);

export function leerEntrada(crudo: Record<string, unknown>) {
  const limpio = Object.fromEntries(
    Object.entries(crudo).filter(([k, v]) => !NO_SON_DEL_INMUEBLE.has(k) && v !== '' && v !== null && v !== undefined),
  );
  return tasacionSchema.safeParse(limpio);
}

export type TasacionPreparada =
  | { error: string; status: number }
  | { entrada: EntradaTasacion; resultado: ResultadoTasacion; telefonoPropietario: string | null };

export async function prepararTasacion(entradaBase: EntradaCruda, agentId: string): Promise<TasacionPreparada> {
  let entrada: EntradaTasacion | null = null;
  let titulo = entradaBase.titulo?.trim() || '';
  let telefonoPropietario: string | null = null;

  // Desde el inventario: los datos salen del inmueble, no de lo que mande la
  // pantalla, y solo si el inmueble es del agente.
  if (entradaBase.listingId) {
    const l = await inmuebleDelAgente(entradaBase.listingId, agentId);
    if (!l) return { error: 'Inmueble no encontrado.', status: 404 };
    const metraje = l.propertyType === 'LAND' ? l.terrenoTotalM2 ?? l.areaM2 : l.areaM2;
    if (!metraje) return { error: 'El inmueble no tiene metraje registrado. Agrégalo en tu inventario para analizarlo.', status: 400 };
    entrada = {
      ...entradaBase,
      tipo: l.propertyType,
      operacion: l.operationType === 'RENT' ? 'RENT' : 'SALE',
      zona: l.zone ?? '',
      metraje,
      antiguedad: l.antiguedad,
      dormitorios: l.bedrooms,
      banos: l.bathrooms,
      parqueaderos: l.parkingSpaces,
      precioActual: l.price,
    };
    titulo = l.title;
    telefonoPropietario = l.ownerPhone;
  } else if (entradaBase.tipo && entradaBase.operacion && entradaBase.zona && entradaBase.metraje) {
    entrada = { ...entradaBase, tipo: entradaBase.tipo, operacion: entradaBase.operacion, zona: entradaBase.zona, metraje: entradaBase.metraje };
  }
  if (!entrada) return { error: 'Completa tipo, operación, sector y metraje.', status: 400 };

  const zona = zonaDelMapa(entrada.zona);
  const sector = zona?.labelEs ?? entrada.zona;
  if (!titulo) titulo = `${tipoImpreso(entrada.tipo)} de ${Math.round(entrada.metraje)} m² en ${sector}`;

  // Sin zona del mapa no hay cierres que buscar: se responde con el mismo
  // mensaje de muestra insuficiente, que es exactamente lo que pasa.
  const cierres = zona
    ? await prisma.closedDeal.findMany({
        where: { zone: zona.key, propertyType: entrada.tipo as never, operationType: entrada.operacion, declaredAccurate: true },
        select: { propertyType: true, price: true, areaM2: true, landAreaM2: true, antiguedad: true, timeOnMarket: true },
        take: 1000,
      })
    : [];

  return { entrada, resultado: analizarTasacion(entrada, sector, cierres, titulo), telefonoPropietario };
}

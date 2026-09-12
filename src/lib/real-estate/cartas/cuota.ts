import { prisma } from '@/lib/prisma';
import { CARTA_LIMITE_MENSUAL } from './tipos';

// Control de costos de la generacion: tope mensual de CARTAS NUEVAS por
// agente.
//
// Se cuentan cartas, no llamadas al modelo. Regenerar un parrafo tambien
// cuesta tokens, pero descontarlo del mismo tope castigaria al agente que
// pule su texto - que es exactamente lo que queremos que haga. Las
// regeneraciones quedan registradas igual (tipo 'bloque') para medir el gasto.
//
// El tope aplica SOLO a generar cartas nuevas: editar, descargar, duplicar y
// enviar las que ya existen nunca se bloquean.

export type EstadoCuota = {
  usadas: number;
  limite: number;
  restantes: number;
  // Cuando se reinicia el contador: el primer dia del mes siguiente.
  reiniciaEl: string;
};

function inicioDelMes(fecha = new Date()): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

function inicioDelMesSiguiente(fecha = new Date()): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 1));
}

export async function estadoDeCuota(agentId: string): Promise<EstadoCuota> {
  const usadas = await prisma.cartaGeneracion.count({
    where: { agentId, tipo: 'carta', createdAt: { gte: inicioDelMes() } },
  });
  return {
    usadas,
    limite: CARTA_LIMITE_MENSUAL,
    restantes: Math.max(0, CARTA_LIMITE_MENSUAL - usadas),
    reiniciaEl: inicioDelMesSiguiente().toISOString(),
  };
}

export async function quedaCuota(agentId: string): Promise<boolean> {
  const { restantes } = await estadoDeCuota(agentId);
  return restantes > 0;
}

// Se registra SIEMPRE despues de la llamada, con el consumo real devuelto por
// el proveedor. Guardar los tokens ademas del conteo es lo que permite ajustar
// el limite mirando el gasto de verdad y no a ojo.
export async function registrarGeneracion(input: {
  agentId: string;
  tipo: 'carta' | 'bloque';
  cartaId?: string | null;
  modelo?: string | null;
  tokensEntrada?: number | null;
  tokensSalida?: number | null;
}): Promise<void> {
  await prisma.cartaGeneracion
    .create({
      data: {
        agentId: input.agentId,
        tipo: input.tipo,
        cartaId: input.cartaId ?? null,
        modelo: input.modelo ?? null,
        tokensEntrada: input.tokensEntrada ?? null,
        tokensSalida: input.tokensSalida ?? null,
      },
    })
    // El registro es contabilidad, no parte del producto: si falla, el agente
    // igual se queda con su carta.
    .catch(() => {});
}

// -----------------------------------------------------------------------------
// Freno de seguridad para "regenerar este parrafo".
//
// NO es un limite de uso: regenerar es gratis para el agente y no descuenta del
// tope mensual, porque pulir el texto es justamente lo que queremos que haga. Es
// proteccion contra automatizacion accidental, un bucle en la pantalla o un
// clic que se queda pegado. El numero esta alto a proposito: quien pule una
// carta de verdad no llega ni cerca.
// -----------------------------------------------------------------------------
export const CARTA_REGENERACIONES_POR_HORA = 30;

export async function regeneracionesEnLaUltimaHora(cartaId: string): Promise<number> {
  const desde = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.cartaGeneracion.count({
    where: { cartaId, tipo: 'bloque', createdAt: { gte: desde } },
  });
}

export async function puedeRegenerar(cartaId: string): Promise<{ permitido: boolean; usadas: number; limite: number }> {
  const usadas = await regeneracionesEnLaUltimaHora(cartaId);
  return { permitido: usadas < CARTA_REGENERACIONES_POR_HORA, usadas, limite: CARTA_REGENERACIONES_POR_HORA };
}

// -----------------------------------------------------------------------------
// Consumo agregado del mes, para vigilar el gasto sin depender del panel del
// proveedor. Solo lo lee el administrador.
// -----------------------------------------------------------------------------
export type ConsumoIA = {
  desde: string;
  cartas: number;
  bloques: number;
  tokensEntrada: number;
  tokensSalida: number;
  agentesActivos: number;
};

export async function consumoDelMes(): Promise<ConsumoIA> {
  const desde = inicioDelMes();
  const [cartas, bloques, suma, agentes] = await Promise.all([
    prisma.cartaGeneracion.count({ where: { tipo: 'carta', createdAt: { gte: desde } } }),
    prisma.cartaGeneracion.count({ where: { tipo: 'bloque', createdAt: { gte: desde } } }),
    prisma.cartaGeneracion.aggregate({
      where: { createdAt: { gte: desde } },
      _sum: { tokensEntrada: true, tokensSalida: true },
    }),
    prisma.cartaGeneracion.findMany({
      where: { createdAt: { gte: desde } },
      select: { agentId: true },
      distinct: ['agentId'],
    }),
  ]);
  return {
    desde: desde.toISOString(),
    cartas,
    bloques,
    tokensEntrada: suma._sum.tokensEntrada ?? 0,
    tokensSalida: suma._sum.tokensSalida ?? 0,
    agentesActivos: agentes.length,
  };
}

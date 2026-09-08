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

import { prisma } from '@/lib/prisma';
import { getAgentPointsSummary } from '@/lib/real-estate/points-log';
import { zoneLabel } from '@/lib/real-estate/quito-zones';
import { propertyTypeLabelEs } from '@/lib/real-estate/labels';
import type { CartaDatosAgente } from './tipos';

// Recoleccion de los datos REALES del agente para la carta (punto 2.1).
//
// Este modulo es la unica fuente de lo que el modelo puede afirmar. Todo lo
// que no salga de aca no existe para la carta: es la mitad de servidor de la
// regla de cero invencion (la otra mitad es el prompt, en generar.ts).
//
// Nunca se consultan datos de clientes del agente ni de inmuebles de terceros
// (punto 7.3): solo agregados de SU propia cartera.

const ESPECIALIDAD: Record<string, string> = {
  SALE: 'venta',
  RENT: 'arriendo',
  BOTH: 'venta y arriendo',
};

export async function recolectarDatosDeAgente(agentId: string): Promise<CartaDatosAgente | null> {
  const agente = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      fullName: true,
      company: true,
      zones: true,
      specializationZones: true,
      specialty: true,
      licenseNumber: true,
      yearsExperience: true,
      idNumber: true,
      phoneVerifiedAt: true,
      createdAt: true,
    },
  });
  if (!agente) return null;

  const [cierres, inventario, puntos] = await Promise.all([
    prisma.closedDeal.count({ where: { createdByAgentId: agentId } }),
    // Composicion por tipo de la cartera ACTIVA. Solo conteos: ni un titulo,
    // ni una direccion, ni el dueño de ningun inmueble llega al modelo.
    prisma.listing.groupBy({
      by: ['propertyType'],
      where: { managingAgentId: agentId, status: 'ACTIVE' },
      _count: { propertyType: true },
    }),
    getAgentPointsSummary(agentId).catch(() => null),
  ]);

  const composicion = inventario
    .map((fila) => ({ tipo: propertyTypeLabelEs(fila.propertyType), cantidad: fila._count.propertyType }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const clavesZona = agente.specializationZones.length > 0 ? agente.specializationZones : agente.zones;

  return {
    nombre: agente.fullName,
    empresa: agente.company,
    // Años cumplidos desde el registro, sin redondear al alza: un agente de
    // ocho meses tiene 0, no "casi un año" (punto 2.2).
    aniosEnRedinmo: aniosCumplidosDesde(agente.createdAt),
    anioIngreso: agente.createdAt.getFullYear(),
    nivel: puntos?.level.labelEs ?? 'Agente Inicial',
    zonas: clavesZona.map((z) => zoneLabel(z, 'es') || z).filter(Boolean),
    especialidad: ESPECIALIDAD[agente.specialty] ?? 'venta y arriendo',
    inmueblesActivos: composicion.reduce((total, fila) => total + fila.cantidad, 0),
    composicionInventario: composicion,
    cierresRegistrados: cierres,
    aniosDeExperiencia: agente.yearsExperience,
    licencia: agente.licenseNumber,
    verificado: Boolean(agente.idNumber) && Boolean(agente.phoneVerifiedAt),
  };
}

function aniosCumplidosDesde(desde: Date): number {
  const ahora = new Date();
  let anios = ahora.getFullYear() - desde.getFullYear();
  const cumpleEsteAnio =
    ahora.getMonth() > desde.getMonth() || (ahora.getMonth() === desde.getMonth() && ahora.getDate() >= desde.getDate());
  if (!cumpleEsteAnio) anios -= 1;
  return Math.max(0, anios);
}

// Muestras de estilo para cartas futuras (punto 3.3): los bloques que el
// agente REESCRIBIO en sus ultimas cartas. Solo se toman los que cambio de
// verdad respecto de lo generado - un bloque que acepto tal cual no dice nada
// sobre como escribe el.
export async function recolectarMuestrasDeEstilo(agentId: string, maximo = 4): Promise<string[]> {
  const previas = await prisma.carta.findMany({
    where: { agentId },
    orderBy: { updatedAt: 'desc' },
    take: 6,
    select: { bloques: true, bloquesOriginales: true },
  });

  const muestras: string[] = [];
  for (const carta of previas) {
    const actuales = (carta.bloques ?? {}) as Record<string, unknown>;
    const originales = (carta.bloquesOriginales ?? {}) as Record<string, unknown>;
    for (const [clave, texto] of Object.entries(actuales)) {
      if (typeof texto !== 'string' || texto.trim().length < 40) continue;
      if (texto.trim() === String(originales[clave] ?? '').trim()) continue;
      muestras.push(texto.trim());
      if (muestras.length >= maximo) return muestras;
    }
  }
  return muestras;
}

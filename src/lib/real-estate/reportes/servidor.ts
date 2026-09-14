import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tieneAccesoPorAgenteId } from '@/lib/real-estate/access-server';
import { construirEncabezado } from '@/lib/real-estate/cartas/servidor';
import type { CartaEncabezado } from '@/lib/real-estate/cartas/plantilla';
import { propertyTypeLabelEs } from '@/lib/real-estate/labels';
import { zoneLabel } from '@/lib/real-estate/quito-zones';

// Piezas compartidas por las rutas de reportes: guarda de sesion + feature,
// propiedad del inmueble y encabezado del documento.

// Defensa en profundidad, igual que cartas y fichas: la pestaña ya esta detras
// de RequiereFeature, pero cada ruta vuelve a validar el plan.
export async function agenteConReportes(
  request: NextRequest,
): Promise<{ error: NextResponse; agentId?: undefined } | { error?: undefined; agentId: string }> {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  }
  if (!(await tieneAccesoPorAgenteId(session.agentId, 'reportes_clientes'))) {
    return {
      error: NextResponse.json(
        { error: 'Los reportes a clientes son una función del plan Pro.', code: 'feature_locked' },
        { status: 403 },
      ),
    };
  }
  return { agentId: session.agentId };
}

// Los reportes de visita guardan datos de terceros cifrados. Sin la clave no
// se opera: guardarlos en claro no es una opcion, y leerlos daria vacio. Se
// dice con un 503 explicito, igual que el modulo de contratos.
export function faltaClaveDeCifrado(): NextResponse | null {
  if (process.env.ENCRYPTION_KEY) return null;
  console.error('[reportes] ENCRYPTION_KEY no configurada: los reportes de visita no pueden operar');
  return NextResponse.json(
    { error: 'Los reportes de visita no están disponibles en este momento.', code: 'cifrado_no_configurado' },
    { status: 503 },
  );
}

// El inmueble solo si lo gestiona el agente de la sesion. Un reporte sobre el
// inmueble de otro agente expondria datos que no son suyos (punto 5.1).
export async function inmuebleDelAgente(listingId: string, agentId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.managingAgentId !== agentId) return null;
  return listing;
}

// El encabezado es el mismo de las cartas: la marca del agente arriba, Redinmo
// discreto abajo. Se respeta la imagen que el agente eligio para sus cartas.
export async function encabezadoDelAgente(agentId: string): Promise<CartaEncabezado | null> {
  const agente = await prisma.agent.findUnique({ where: { id: agentId }, select: { cartaImagenTipo: true } });
  if (!agente) return null;
  return construirEncabezado(agentId, agente.cartaImagenTipo ?? 'foto');
}

const OPERACION_IMPRESA: Record<string, string> = { SALE: 'Venta', RENT: 'Arriendo', BOTH: 'Venta y arriendo' };

export function operacionImpresa(op: string): string {
  return OPERACION_IMPRESA[op] ?? op;
}

export function sectorImpreso(listing: { city: string; zone: string | null }): string {
  const zona = listing.zone ? zoneLabel(listing.zone, 'es') || listing.zone : null;
  return [zona, listing.city].filter(Boolean).join(', ');
}

export function tipoImpreso(propertyType: string): string {
  const etiqueta = propertyTypeLabelEs(propertyType);
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
}

export function nombreArchivoReporte(tipo: 'Visita' | 'Gestion' | 'Tasacion', titulo: string, fecha: Date, extension: string): string {
  const limpio = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const dia = fecha.toISOString().slice(0, 10);
  return `Reporte-${tipo}-${limpio || 'Inmueble'}-${dia}.${extension}`;
}

// Fechas impresas en hora de Ecuador: el servidor corre en UTC y una visita a
// las 19:00 no puede salir fechada al dia siguiente.
const ZONA = 'America/Guayaquil';

export function fechaImpresa(fecha: Date): string {
  return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });
}

export function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', timeZone: ZONA });
}

export function horaImpresa(fecha: Date): string {
  return fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });
}

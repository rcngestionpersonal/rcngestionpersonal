import type { ContratoEventoTipo, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptAtRest, encryptAtRest } from '@/lib/real-estate/payments/encryption';
import { describirNavegador, fechaConZona, ipDeSolicitud } from './aprobacion';
import type { CambiosEntreVersiones } from './clausulas';
import type { Etapa } from './tipos';

// Historial del contrato. Cada acción deja una fila y ninguna se modifica.
//
// Lo que identifica a alguien (nombre, comentario, IP, navegador) viaja cifrado
// en el detalle. La fecha se guarda en UTC y se registra además, legible, en la
// hora de Ecuador continental (America/Guayaquil), que es la que se muestra.

export type TipoEvento = ContratoEventoTipo;
export type Actor = 'AGENTE' | 'PARTE' | 'SISTEMA';

export type Solicitud = { ip: string | null; userAgent: string | null };

export type DetalleEvento = {
  nombre?: string;
  comentario?: string;
  ip?: string | null;
  userAgent?: string | null;
  navegador?: string;
  zonaHoraria?: string | null;
  canal?: 'whatsapp' | 'correo';
  vigenciaHoras?: number;
  cambios?: CambiosEntreVersiones | null;
  campos?: string[];
  base?: number;
  nota?: string;
  fechaEcuador?: string | null;
};

type Db = PrismaClient | Prisma.TransactionClient;

export function solicitudDe(headers: Headers): Solicitud {
  return { ip: ipDeSolicitud(headers), userAgent: headers.get('user-agent') };
}

export async function registrarEvento(
  db: Db,
  evento: {
    contratoId: string;
    tipo: TipoEvento;
    actor: Actor;
    parteId?: string | null;
    rol?: string | null;
    etapa?: Etapa | null;
    versionNumero?: number | null;
    huella?: string | null;
    detalle?: DetalleEvento;
    solicitud?: Solicitud | null;
    fecha?: Date;
  },
): Promise<void> {
  const fecha = evento.fecha ?? new Date();
  const detalle: DetalleEvento = {
    ...evento.detalle,
    ...(evento.solicitud
      ? { ip: evento.solicitud.ip, userAgent: evento.solicitud.userAgent, navegador: describirNavegador(evento.solicitud.userAgent) }
      : {}),
    fechaEcuador: fechaConZona(fecha),
  };
  await db.contratoEvento.create({
    data: {
      contratoId: evento.contratoId,
      tipo: evento.tipo,
      actor: evento.actor,
      parteId: evento.parteId ?? null,
      rol: evento.rol ?? null,
      etapa: evento.etapa ?? null,
      versionNumero: evento.versionNumero ?? null,
      huella: evento.huella ?? null,
      detalleCifrado: encryptAtRest(JSON.stringify(detalle)),
      createdAt: fecha,
    },
  });
}

export function leerDetalle(cifrado: string | null): DetalleEvento | null {
  if (!cifrado) return null;
  try {
    return JSON.parse(decryptAtRest(cifrado)) as DetalleEvento;
  } catch {
    return null;
  }
}

// El formulario se guarda solo mientras el agente escribe: registrar cada
// guardado llenaría el historial de ruido. Se registra una edición por tanda
// (la primera después de un envío, una decisión o media hora sin tocarlo).
const TANDA_EDICION_MS = 30 * 60 * 1000;

export async function registrarEdicion(contratoId: string, solicitud: Solicitud): Promise<void> {
  const ultimo = await prisma.contratoEvento.findFirst({
    where: { contratoId },
    orderBy: { createdAt: 'desc' },
    select: { tipo: true, createdAt: true },
  });
  if (ultimo?.tipo === 'EDICION' && Date.now() - ultimo.createdAt.getTime() < TANDA_EDICION_MS) return;
  await registrarEvento(prisma, { contratoId, tipo: 'EDICION', actor: 'AGENTE', solicitud });
}

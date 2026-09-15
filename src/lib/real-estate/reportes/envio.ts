import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { referenceCodeFor } from '@/lib/real-estate/ficha/snapshot';
import { getAppUrl } from '@/lib/real-estate/subscription-config';
import type { AgenteCorreo, InmuebleCorreo } from './correos/componentes';
import type { EntregaCorreo } from './correos/fechas';
import { enlaceDeDescarga, type DocumentoPdf } from './documento';
import type { ModoEntrega, ResultadoEntrega } from './entrega';
import { encabezadoDelAgente, tipoImpreso } from './servidor';

// Piezas comunes a las tres rutas que envian un reporte por correo.

export const envioSchema = z.object({
  para: z.string().trim().email('Correo del propietario no válido.'),
  mensaje: z.string().trim().max(2000).optional().transform((v) => (v ? v : null)),
  nombreDestinatario: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  // El agente pide "enlace" solo despues de que el adjunto supero el limite.
  modo: z.enum(['adjunto', 'enlace']).default('adjunto'),
  paleta: z.string().optional(),
});

export type Envio = z.infer<typeof envioSchema>;

export async function agenteParaCorreo(agentId: string): Promise<{ agente: AgenteCorreo; correo: string } | { error: NextResponse }> {
  const [fila, encabezado] = await Promise.all([
    prisma.agent.findUnique({ where: { id: agentId }, select: { email: true } }),
    encabezadoDelAgente(agentId),
  ]);
  if (!fila?.email || !encabezado) {
    return { error: NextResponse.json({ error: 'Necesitas un correo en tu perfil para enviar reportes.', code: 'sin_correo' }, { status: 409 }) };
  }
  return {
    correo: fila.email,
    agente: {
      nombre: encabezado.nombre,
      empresa: encabezado.empresa,
      telefono: encabezado.telefono,
      correo: fila.email,
      imagenUrl: encabezado.imagenUrl,
      verificado: encabezado.verificado,
      urlMiniSitio: encabezado.urlMiniSitioAbsoluta,
    },
  };
}

type InmuebleFila = {
  id: string;
  propertyType: string;
  operationType: string;
  zone: string | null;
  city: string;
  price: number;
  currency: string;
  coverPhotoUrl: string | null;
};

// "La Carolina": el barrio que eligio el agente, que es como el propietario
// conoce su zona. Sin barrio, la ciudad.
export function barrioDe(l: Pick<InmuebleFila, 'zone' | 'city'>): string {
  return l.zone?.trim() || l.city;
}

export function precioImpreso(precio: number, moneda: string, operacion: string): string {
  const cifra = Math.round(precio).toLocaleString('es-EC');
  const monto = moneda === 'USD' ? `$${cifra}` : `${cifra} ${moneda}`;
  return operacion === 'RENT' ? `${monto} mensuales` : monto;
}

export function inmuebleParaCorreo(l: InmuebleFila, sector?: string): InmuebleCorreo {
  return {
    fotoUrl: l.coverPhotoUrl,
    tipo: tipoImpreso(l.propertyType),
    sector: sector ?? barrioDe(l),
    referencia: referenceCodeFor(l.id),
    precio: precioImpreso(l.price, l.currency, l.operationType),
  };
}

export function entregaParaCorreo(documento: DocumentoPdf, modo: ModoEntrega): EntregaCorreo {
  return modo === 'adjunto' ? { modo } : { modo, ...enlaceDeDescarga(documento.id, getAppUrl()) };
}

export function adjuntos(documento: DocumentoPdf, modo: ModoEntrega) {
  return modo === 'adjunto' ? [{ filename: documento.nombreArchivo, content: documento.buffer }] : undefined;
}

export function respuestaDeEntrega(resultado: ResultadoEntrega, extra: Record<string, unknown> = {}): NextResponse {
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, code: resultado.code, bytes: resultado.bytes, ...extra }, { status: resultado.status });
  }
  return NextResponse.json({ ok: true, documento: resultado.documento, modo: resultado.modo, reenvio: resultado.reenvio, ...extra });
}

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cifrarBytes, descifrarBytes } from './cifrado';

// El PDF de cada reporte tal como lo recibio el propietario.
//
// Se congela en el primer envio por correo y desde ahi es inmutable: cada
// reenvio y cada descarga en PDF entregan esos mismos bytes. Va cifrado porque
// el de una visita lleva datos y foto de un tercero.

export type TipoReporte = 'visita' | 'gestion' | 'tasacion';

export type DocumentoPdf = {
  id: string;
  buffer: Buffer;
  nombreArchivo: string;
  paleta: string;
  bytes: number;
  createdAt: Date;
};

export type MetaDocumento = { nombreArchivo: string; paleta: string; bytes: number; creadoAt: string };

// 2 MB (punto 4.1): por encima, muchos correos corporativos rechazan el adjunto.
const LIMITE_PDF_BYTES = 2 * 1024 * 1024;

// Solo fuera de produccion se puede bajar el limite, para poder probar el
// camino del enlace de descarga sin fabricar un PDF de 2 MB. En produccion la
// variable se ignora.
export function limitePdfBytes(): number {
  const prueba = Number(process.env.REPORTES_PDF_LIMITE_PRUEBA);
  if (process.env.NODE_ENV !== 'production' && Number.isFinite(prueba) && prueba > 0) return prueba;
  return LIMITE_PDF_BYTES;
}

function columna(tipo: TipoReporte): 'reporteVisitaId' | 'reporteGestionId' | 'reporteTasacionId' {
  return tipo === 'visita' ? 'reporteVisitaId' : tipo === 'gestion' ? 'reporteGestionId' : 'reporteTasacionId';
}

function desdeFila(fila: { id: string; pdfCifrado: Uint8Array; nombreArchivo: string; paleta: string; bytes: number; createdAt: Date }): DocumentoPdf {
  return {
    id: fila.id,
    buffer: descifrarBytes(fila.pdfCifrado),
    nombreArchivo: fila.nombreArchivo,
    paleta: fila.paleta,
    bytes: fila.bytes,
    createdAt: fila.createdAt,
  };
}

export async function documentoGuardado(tipo: TipoReporte, reporteId: string): Promise<DocumentoPdf | null> {
  const fila = await prisma.reporteDocumento.findFirst({ where: { [columna(tipo)]: reporteId } });
  return fila ? desdeFila(fila) : null;
}

// Metadatos sin los bytes, para la pantalla.
export async function metaDocumento(tipo: TipoReporte, reporteId: string): Promise<MetaDocumento | null> {
  const fila = await prisma.reporteDocumento.findFirst({
    where: { [columna(tipo)]: reporteId },
    select: { nombreArchivo: true, paleta: true, bytes: true, createdAt: true },
  });
  return fila ? { nombreArchivo: fila.nombreArchivo, paleta: fila.paleta, bytes: fila.bytes, creadoAt: fila.createdAt.toISOString() } : null;
}

export async function guardarDocumento(input: {
  tipo: TipoReporte;
  reporteId: string;
  agentId: string;
  buffer: Buffer;
  nombreArchivo: string;
  paleta: string;
}): Promise<DocumentoPdf> {
  try {
    const fila = await prisma.reporteDocumento.create({
      data: {
        agentId: input.agentId,
        [columna(input.tipo)]: input.reporteId,
        nombreArchivo: input.nombreArchivo,
        paleta: input.paleta,
        bytes: input.buffer.length,
        pdfCifrado: cifrarBytes(input.buffer),
      },
    });
    return desdeFila(fila);
  } catch (error) {
    // Dos envios simultaneos del mismo reporte: gana el primero que se guardo,
    // y los dos entregan ese.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existente = await documentoGuardado(input.tipo, input.reporteId);
      if (existente) return existente;
    }
    throw error;
  }
}

// ---- Enlace de descarga (punto 4.3) ------------------------------------------
// Solo para cuando el PDF supera el limite y el agente elige mandar un enlace.
// El token lleva el id y el vencimiento firmados con AUTH_SECRET: sin la firma
// no se puede fabricar ni alargar.

const DIAS_ENLACE = 30;

function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET no esta configurada.');
  return s;
}

function firmar(valor: string): string {
  return crypto.createHmac('sha256', secreto()).update(`reporte-documento:${valor}`).digest('base64url');
}

export function enlaceDeDescarga(documentoId: string, base: string, ahora = new Date()): { url: string; venceAt: Date } {
  const venceAt = new Date(ahora.getTime() + DIAS_ENLACE * 24 * 60 * 60 * 1000);
  const carga = `${documentoId}.${Math.floor(venceAt.getTime() / 1000)}`;
  return { url: `${base}/api/documentos/${carga}.${firmar(carga)}`, venceAt };
}

export function verificarEnlace(token: string, ahora = new Date()): { documentoId: string } | { error: 'invalido' | 'vencido' } {
  const partes = token.split('.');
  if (partes.length !== 3) return { error: 'invalido' };
  const [documentoId, vence, firma] = partes;
  const esperada = firmar(`${documentoId}.${vence}`);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { error: 'invalido' };
  if (Number(vence) * 1000 < ahora.getTime()) return { error: 'vencido' };
  return { documentoId };
}

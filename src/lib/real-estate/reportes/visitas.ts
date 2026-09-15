import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { referenceCodeFor } from '@/lib/real-estate/ficha/snapshot';
import { cifrarTexto, cifrarTextoOpcional, descifrarTexto } from './cifrado';
import { fotoComoDataUri } from './foto';
import { fechaImpresa, horaImpresa, operacionImpresa, sectorImpreso, tipoImpreso } from './servidor';
import { REACCIONES_VISITA, VISITA_LIMITES, cedulaEnmascarada, type ReaccionVisita } from './tipos';
import type { VisitaImpresa } from './visita-plantilla';

// Datos del reporte de visita: validacion de entrada, lectura descifrada para
// el agente y armado de lo que se imprime para el propietario.

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const visitaSchema = z.object({
  listingId: z.string().min(1, 'Elige el inmueble visitado.'),
  visitadaAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida.')
    // Una visita no puede estar en el futuro. Se da una hora de margen por los
    // relojes de celular desfasados.
    .refine((v) => Date.parse(v) <= Date.now() + 60 * 60 * 1000, 'La visita no puede tener fecha futura.'),
  duracionMinutos: z.number().int().min(5).max(480).optional().nullable(),
  visitanteNombre: z.string().trim().min(2, 'Escribe el nombre del visitante.').max(VISITA_LIMITES.nombre),
  visitanteCedula: z
    .string()
    .trim()
    .max(VISITA_LIMITES.cedula)
    .optional()
    .nullable()
    .refine((v) => !v || /^\d{10}(\d{3})?$/.test(v.replace(/\D/g, '')), 'La cédula debe tener 10 dígitos.')
    .transform((v) => (v ? v.replace(/\D/g, '') : null)),
  acompanantes: texto(VISITA_LIMITES.acompanantes),
  reaccion: z.enum(REACCIONES_VISITA),
  observaciones: texto(VISITA_LIMITES.observaciones),
  objeciones: texto(VISITA_LIMITES.objeciones),
  proximoPaso: texto(VISITA_LIMITES.proximoPaso),
  consentimientoRespaldo: z.boolean().default(false),
  consentimientoRedes: z.boolean().default(false),
});

export type EntradaVisita = z.infer<typeof visitaSchema>;

export function datosCifradosDeVisita(entrada: EntradaVisita) {
  return {
    visitanteNombreCifrado: cifrarTexto(entrada.visitanteNombre),
    visitanteCedulaCifrada: cifrarTextoOpcional(entrada.visitanteCedula),
    visitanteCedulaUlt4: entrada.visitanteCedula ? entrada.visitanteCedula.slice(-4) : null,
    acompanantesCifrado: cifrarTextoOpcional(entrada.acompanantes),
  };
}

const conInmueble = {
  listing: { select: { id: true, title: true, propertyType: true, operationType: true, city: true, zone: true, ownerName: true } },
  foto: { select: { consentimientoRedes: true, ancho: true, alto: true } },
} as const;

export async function visitaDelAgente(id: string, agentId: string) {
  const reporte = await prisma.reporteVisita.findUnique({ where: { id }, include: conInmueble });
  if (!reporte || reporte.agentId !== agentId) return null;
  return reporte;
}

type VisitaConInmueble = NonNullable<Awaited<ReturnType<typeof visitaDelAgente>>>;

// Lo que ve el AGENTE: todo descifrado, cedula completa incluida. Nunca sale
// de la sesion del agente que la registro.
export function visitaParaAgente(r: VisitaConInmueble) {
  return {
    id: r.id,
    listingId: r.listingId,
    inmueble: r.listing.title,
    visitadaAt: r.visitadaAt.toISOString(),
    duracionMinutos: r.duracionMinutos,
    visitanteNombre: descifrarTexto(r.visitanteNombreCifrado) ?? '(dato no disponible)',
    visitanteCedula: descifrarTexto(r.visitanteCedulaCifrada),
    acompanantes: descifrarTexto(r.acompanantesCifrado),
    reaccion: r.reaccion as ReaccionVisita,
    observaciones: r.observaciones,
    objeciones: r.objeciones,
    proximoPaso: r.proximoPaso,
    paleta: r.paleta,
    foto: r.foto ? { redes: r.foto.consentimientoRedes } : null,
    enviadoAt: r.enviadoAt?.toISOString() ?? null,
    enviadoA: r.enviadoA,
    createdAt: r.createdAt.toISOString(),
  };
}

// Lo que recibe el PROPIETARIO: la cedula enmascarada.
export async function visitaImpresa(r: VisitaConInmueble): Promise<VisitaImpresa> {
  let fotoDataUri: string | null = null;
  if (r.foto) {
    const fila = await prisma.reporteVisitaFoto.findUnique({ where: { reporteId: r.id }, select: { datosCifrados: true } });
    if (fila) fotoDataUri = await fotoComoDataUri(fila.datosCifrados);
  }

  return {
    inmueble: {
      titulo: r.listing.title,
      tipo: tipoImpreso(r.listing.propertyType),
      operacion: operacionImpresa(r.listing.operationType),
      sector: sectorImpreso(r.listing),
      referencia: referenceCodeFor(r.listing.id),
    },
    fecha: fechaImpresa(r.visitadaAt),
    hora: horaImpresa(r.visitadaAt),
    duracion: r.duracionMinutos ? `${r.duracionMinutos} minutos` : null,
    visitante: descifrarTexto(r.visitanteNombreCifrado) ?? 'Dato no disponible',
    cedulaEnmascarada: cedulaEnmascarada(r.visitanteCedulaUlt4),
    acompanantes: descifrarTexto(r.acompanantesCifrado),
    reaccion: (REACCIONES_VISITA as readonly string[]).includes(r.reaccion) ? (r.reaccion as ReaccionVisita) : 'INTERESADO_CON_REPAROS',
    observaciones: r.observaciones,
    objeciones: r.objeciones,
    proximoPaso: r.proximoPaso,
    fotoDataUri,
    // La fecha de emision es la del reporte, no la del render: el mismo reporte
    // descargado dos veces tiene que decir lo mismo.
    generadoEl: fechaImpresa(r.createdAt),
  };
}

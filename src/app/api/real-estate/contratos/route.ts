import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConContratos, describirInmueble } from '@/lib/real-estate/contratos/servidor';
import { cifrarDatos, generarCodigoVerificacion } from '@/lib/real-estate/contratos/firma';
import { CONTRATO_TIPOS, camposFaltantes, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';
import { PLANTILLA_ACTUAL, obtenerPlantilla } from '@/lib/real-estate/contratos/plantillas';
import type { ContratoTipo as PrismaContratoTipo } from '@prisma/client';

// Listado y creacion de contratos.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const crearSchema = z.object({
  tipo: z.enum(CONTRATO_TIPOS),
  listingId: z.string().min(1).optional().nullable(),
  datos: z.record(z.string(), z.string()).default({}),
});

export async function GET(request: NextRequest) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const [contratos, listings, agente] = await Promise.all([
    prisma.contrato.findMany({
      where: { agentId: auth.agentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, tipo: true, estado: true, listingId: true, codigoVerificacion: true,
        createdAt: true, enviadoAt: true, firmadoAt: true, anuladoAt: true, anuladoNota: true,
        firmantes: {
          select: { id: true, rol: true, nombre: true, correo: true, estado: true, enviadoAt: true, abiertoAt: true, firmadoAt: true, rechazadoAt: true, motivoRechazo: true, expiraAt: true },
        },
      },
    }),
    prisma.listing.findMany({
      where: { managingAgentId: auth.agentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, propertyType: true, city: true, zone: true },
    }),
    prisma.agent.findUnique({
      where: { id: auth.agentId },
      select: { fullName: true, idNumber: true, direccion: true, ciudad: true, email: true },
    }),
  ]);

  const plantilla = obtenerPlantilla(PLANTILLA_ACTUAL);

  return NextResponse.json({
    contratos,
    listings,
    // El agente necesita saber si le faltan datos propios ANTES de empezar: un
    // contrato sin la cedula del agente no sirve.
    agente: {
      nombre: agente?.fullName ?? '',
      tieneCedula: Boolean(agente?.idNumber),
      tieneDireccion: Boolean(agente?.direccion),
      tieneCorreo: Boolean(agente?.email),
    },
    plantilla: { version: plantilla.version, revisada: plantilla.revisadaPorAbogado, aviso: plantilla.avisoSinRevisar },
  });
}

export async function POST(request: NextRequest) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const parsed = crearSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { tipo, listingId, datos } = parsed.data;

  // Se congela la descripcion del inmueble dentro de los datos: si mañana el
  // agente edita o borra el inmueble, el contrato tiene que seguir diciendo lo
  // que decia el dia que se creo.
  const inmueble = await describirInmueble(listingId ?? null, auth.agentId);
  const datosCompletos = {
    ...datos,
    __inmuebleDescripcion: inmueble.descripcion,
    __inmuebleUbicacion: inmueble.ubicacion,
    __inmuebleCaracteristicas: inmueble.caracteristicas,
  };

  const contrato = await prisma.contrato.create({
    data: {
      agentId: auth.agentId,
      tipo: tipo as PrismaContratoTipo,
      listingId: listingId ?? null,
      plantillaVersion: PLANTILLA_ACTUAL,
      datosCifrados: cifrarDatos(datosCompletos),
      codigoVerificacion: generarCodigoVerificacion(),
    },
  });

  return NextResponse.json({
    contrato: { id: contrato.id, tipo: contrato.tipo, estado: contrato.estado, codigoVerificacion: contrato.codigoVerificacion },
    // Se informan los campos que faltan, pero NO se bloquea guardar un
    // borrador incompleto: el agente puede estar frente al cliente y
    // completarlo en dos tiempos. La validacion dura es al enviar a firma.
    faltantes: camposFaltantes(tipo as ContratoTipo, datos),
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConContratos, describirInmueble, logContratos } from '@/lib/real-estate/contratos/servidor';
import { filasTolerantes, type ContratoFila } from '@/lib/real-estate/contratos/listado';
import { cifrarDatos, generarCodigoVerificacion } from '@/lib/real-estate/contratos/aprobacion';
import {
  AVISO_MODULO,
  CONTRATO_TIPOS,
  CONTRATO_TIPOS_LEGADO,
  camposFaltantes,
  type ContratoTipo,
} from '@/lib/real-estate/contratos/tipos';
import { plantillaActual, plantillasVigentes } from '@/lib/real-estate/contratos/plantillas';
import type { ContratoTipo as PrismaContratoTipo } from '@prisma/client';

// Listado y creación de contratos.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const crearSchema = z.object({
  tipo: z.enum(CONTRATO_TIPOS),
  listingId: z.string().min(1).optional().nullable(),
  datos: z.record(z.string(), z.string().max(5000)).default({}),
});

export async function GET(request: NextRequest) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  try {
    return await listar(auth.agentId);
  } catch (error) {
    logContratos('fallo al cargar el listado de contratos', { agentId: auth.agentId, error });
    return NextResponse.json(
      { error: 'No se pudieron cargar tus contratos. Vuelve a intentarlo.', code: 'error_listado' },
      { status: 500 },
    );
  }
}

async function listar(agentId: string) {
  const [contratos, listings, agente] = await Promise.all([
    prisma.contrato.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, tipo: true, estado: true, listingId: true, codigoVerificacion: true, versionActual: true,
        createdAt: true, enviadoAt: true, aprobadoAt: true, firmadoAt: true, anuladoAt: true, anuladoNota: true,
        versiones: { select: { id: true, numero: true } },
        partes: {
          select: {
            id: true, versionId: true, rol: true, nombre: true, correo: true, estado: true, enviadoAt: true, abiertoAt: true,
            aprobadoAt: true, firmadoAt: true, rechazadoAt: true, motivoRechazo: true, expiraAt: true,
          },
        },
      },
    }),
    prisma.listing.findMany({
      where: { managingAgentId: agentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, propertyType: true, operationType: true, city: true, zone: true, address: true,
        price: true, ownerName: true, ownerPhone: true,
      },
    }),
    prisma.agent.findUnique({
      where: { id: agentId },
      select: { fullName: true, company: true, idNumber: true, direccion: true, ciudad: true, email: true },
    }),
  ]);

  // En la fila solo viajan las partes de la versión vigente (o los firmantes
  // de un contrato de la etapa de firma): es lo que el agente necesita ver de
  // un vistazo. El historial completo está en el detalle.
  const filas = contratos.map(({ versiones, partes, ...c }) => {
    const vigente = versiones.find((v) => v.numero === c.versionActual);
    return { ...c, partes: vigente ? partes.filter((p) => p.versionId === vigente.id) : partes.filter((p) => !p.versionId) };
  });

  return NextResponse.json({
    contratos: filasTolerantes(filas as unknown as ContratoFila[], (contrato, error) =>
      logContratos('no se pudo preparar un contrato para el listado: se muestra degradado', {
        agentId,
        contratoId: typeof contrato?.id === 'string' ? contrato.id : undefined,
        error,
      }),
    ),
    listings,
    // El agente necesita saber si le faltan datos propios ANTES de empezar: un
    // contrato sin la cédula del agente no sirve.
    agente: {
      nombre: agente?.fullName ?? '',
      empresa: agente?.company ?? null,
      tieneCedula: Boolean(agente?.idNumber),
      tieneDireccion: Boolean(agente?.direccion),
      tieneCorreo: Boolean(agente?.email),
    },
    plantilla: {
      aviso: AVISO_MODULO,
      versiones: plantillasVigentes().filter((p) => !CONTRATO_TIPOS_LEGADO.includes(p.tipo)),
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const parsed = crearSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { tipo, listingId } = parsed.data;
  // Las claves internas (__) las escribe solo el servidor.
  const datos = Object.fromEntries(Object.entries(parsed.data.datos).filter(([k]) => !k.startsWith('__')));

  if (CONTRATO_TIPOS_LEGADO.includes(tipo)) {
    return NextResponse.json({ error: 'Ese tipo de contrato ya no está disponible.', code: 'tipo_archivado' }, { status: 400 });
  }

  // Se congela la descripción del inmueble dentro de los datos: si mañana el
  // agente edita o borra el inmueble, el contrato sigue diciendo lo que decía.
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
      plantillaVersion: plantillaActual(tipo as ContratoTipo),
      datosCifrados: cifrarDatos(datosCompletos),
      codigoVerificacion: generarCodigoVerificacion(),
    },
  });

  return NextResponse.json({
    contrato: { id: contrato.id, tipo: contrato.tipo, estado: contrato.estado, codigoVerificacion: contrato.codigoVerificacion },
    // Se informan los campos que faltan, pero NO se bloquea guardar un
    // borrador incompleto: el agente puede estar frente al cliente y
    // completarlo en dos tiempos. La validación dura es al enviar.
    faltantes: camposFaltantes(tipo as ContratoTipo, datos),
  });
}

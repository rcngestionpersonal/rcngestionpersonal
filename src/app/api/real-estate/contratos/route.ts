import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConContratos, describirInmueble, logContratos } from '@/lib/real-estate/contratos/servidor';
import { filasTolerantes, type ContratoFila } from '@/lib/real-estate/contratos/listado';
import { cifrarDatos, generarCodigoVerificacion } from '@/lib/real-estate/contratos/firma';
import {
  AVISO_MODULO_VERSION,
  CONTRATO_TIPOS,
  CONTRATO_TIPOS_LEGADO,
  camposFaltantes,
  debeAceptarAviso,
  type ContratoTipo,
} from '@/lib/real-estate/contratos/tipos';
import {
  AVISO_PLANTILLA_SIN_REVISAR,
  hayPlantillasSinRevisar,
  plantillaActual,
  plantillasVigentes,
} from '@/lib/real-estate/contratos/plantillas';
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

  try {
    return await listar(auth.agentId);
  } catch (error) {
    // Antes esto salía como un 500 sin rastro. Ahora el log dice qué reventó
    // y a quién le pasó, que es lo único que sirve para arreglarlo.
    logContratos('fallo al cargar el listado de contratos', { agentId: auth.agentId, error });
    return NextResponse.json(
      { error: 'No se pudieron cargar tus contratos. Vuelve a intentarlo.', code: 'error_listado' },
      { status: 500 },
    );
  }
}

async function listar(agentId: string) {
  const auth = { agentId };
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
      select: {
        fullName: true, idNumber: true, direccion: true, ciudad: true, email: true,
        contratosAvisoAt: true, contratosAvisoVersion: true,
      },
    }),
  ]);

  return NextResponse.json({
    contratos: filasTolerantes(contratos as unknown as ContratoFila[], (contrato, error) =>
      logContratos('no se pudo preparar un contrato para el listado: se muestra degradado', {
        agentId,
        contratoId: typeof contrato?.id === 'string' ? contrato.id : undefined,
        error,
      }),
    ),
    listings,
    // El agente necesita saber si le faltan datos propios ANTES de empezar: un
    // contrato sin la cedula del agente no sirve.
    agente: {
      nombre: agente?.fullName ?? '',
      tieneCedula: Boolean(agente?.idNumber),
      tieneDireccion: Boolean(agente?.direccion),
      tieneCorreo: Boolean(agente?.email),
    },
    // Cada documento versiona su plantilla por separado (punto 1.4), asi que
    // ya no hay "una version" del modulo sino una por tipo.
    plantilla: {
      revisada: !hayPlantillasSinRevisar(),
      aviso: AVISO_PLANTILLA_SIN_REVISAR,
      // Las legadas no se muestran: el agente no puede generarlas.
      versiones: plantillasVigentes().filter((p) => !CONTRATO_TIPOS_LEGADO.includes(p.tipo)),
    },
    // Aviso de modelo referencial (punto 4.2.a): si toca aceptarlo, el modulo
    // lo pide antes de dejar generar nada.
    avisoLegal: {
      debeAceptar: debeAceptarAviso(agente?.contratosAvisoAt ?? null, agente?.contratosAvisoVersion ?? null),
      aceptadoAt: agente?.contratosAvisoAt ?? null,
      version: AVISO_MODULO_VERSION,
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
  const { tipo, listingId, datos } = parsed.data;

  // El corretaje sin modalidad ya no se genera: hay que elegir exclusivo o
  // abierto (punto 1.1). Los contratos viejos con ese tipo siguen abriendose.
  if (CONTRATO_TIPOS_LEGADO.includes(tipo)) {
    return NextResponse.json(
      { error: 'Elige la modalidad del corretaje: exclusivo o abierto.', code: 'tipo_legado' },
      { status: 400 },
    );
  }

  // El aviso de modelo referencial se acepta ANTES del primer contrato, y otra
  // vez cada 90 dias (punto 4.2.a). La comprobacion vive tambien aca y no solo
  // en la pantalla: la aceptacion es la constancia, y una constancia que se
  // puede saltar desde la consola del navegador no es una constancia.
  const agente = await prisma.agent.findUnique({
    where: { id: auth.agentId },
    select: { contratosAvisoAt: true, contratosAvisoVersion: true },
  });
  if (debeAceptarAviso(agente?.contratosAvisoAt ?? null, agente?.contratosAvisoVersion ?? null)) {
    return NextResponse.json(
      { error: 'Antes de generar un contrato debes aceptar el aviso sobre modelos referenciales.', code: 'aviso_pendiente' },
      { status: 409 },
    );
  }

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
      plantillaVersion: plantillaActual(tipo as ContratoTipo),
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

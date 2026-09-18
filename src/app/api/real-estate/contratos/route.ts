import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConContratos, contratoDelAgente, describirInmueble, logContratos } from '@/lib/real-estate/contratos/servidor';
import { filasTolerantes, type ContratoFila } from '@/lib/real-estate/contratos/listado';
import { cifrarDatos, descifrarDatos, generarCodigoVerificacion } from '@/lib/real-estate/contratos/aprobacion';
import { registrarEvento, solicitudDe } from '@/lib/real-estate/contratos/eventos';
import { estaPendiente, estadoDelContrato } from '@/lib/real-estate/contratos/flujo';
import { sincronizarVencimiento } from '@/lib/real-estate/contratos/versiones';
import {
  AVISO_MODULO,
  CONTRATO_DEFINICION,
  CONTRATO_TIPOS,
  CONTRATO_TIPOS_LEGADO,
  HORAS_AVISO_VENCIMIENTO,
  camposFaltantes,
  esContratoDeFirmaLegado,
  etiquetasEtapas,
  ladosDelTipo,
  listaDeNombres,
  nombresDeEtapa,
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
  representa: z.string().max(40).optional(),
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

// Avisos para el agente, calculados de lo que ya está registrado. No se manda
// nada a los clientes: el agente decide qué hacer con cada uno.
type Alerta = {
  contratoId: string;
  tipo: 'enviar_contraparte' | 'cambios_pedidos' | 'por_vencer' | 'vencido' | 'enlace_bloqueado';
  tipoEtiqueta: string;
  quien: string;
  etapa: string | null;
  horas?: number;
  destino?: string;
};

type FilaListado = Awaited<ReturnType<typeof leerContratos>>[number];

async function leerContratos(agentId: string) {
  return prisma.contrato.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, tipo: true, estado: true, listingId: true, codigoVerificacion: true, versionActual: true, representa: true,
      createdAt: true, enviadoAt: true, aprobadoAt: true, firmadoAt: true, anuladoAt: true, anuladoNota: true,
      versiones: {
        select: {
          id: true, numero: true, estado: true, representa: true, requierePrincipal: true, requiereContraparte: true,
          principalHeredadaDe: true, simultanea: true, contraparteEnviadaAt: true,
        },
      },
      partes: {
        select: {
          id: true, versionId: true, rol: true, etapa: true, nombre: true, correo: true, estado: true, enviadoAt: true, abiertoAt: true,
          aprobadoAt: true, firmadoAt: true, rechazadoAt: true, motivoRechazo: true, expiraAt: true, bloqueadoAt: true,
        },
      },
    },
  });
}

function alertasDe(c: FilaListado, destino?: string): Alerta[] {
  const tipo = c.tipo as ContratoTipo;
  const vigente = c.versiones.find((v) => v.numero === c.versionActual);
  if (!vigente || esContratoDeFirmaLegado(c)) return [];
  const etiquetasVigentes = etiquetasEtapas(tipo, vigente.representa);
  const tipoEtiqueta = CONTRATO_DEFINICION[tipo]?.titulo ?? 'Documento';
  // Un enlace bloqueado por intentos fallidos se avisa aparte y antes que todo:
  // hasta que el agente genere uno nuevo, esa persona no puede decidir.
  const bloqueadas: Alerta[] =
    vigente.estado === 'EN_APROBACION'
      ? c.partes
          .filter((p) => p.versionId === vigente.id && p.bloqueadoAt && estaPendiente(p))
          .map((p) => ({ contratoId: c.id, tipoEtiqueta, tipo: 'enlace_bloqueado', quien: p.nombre, etapa: etiquetasVigentes[p.etapa] }))
      : [];
  return [...bloqueadas, ...alertasDelEstado(c, vigente, destino)];
}

function alertasDelEstado(c: FilaListado, vigente: FilaListado['versiones'][number], destino?: string): Alerta[] {
  const tipo = c.tipo as ContratoTipo;
  // Los enlaces bloqueados ya tienen su propia alerta.
  const partes = c.partes.filter((p) => p.versionId === vigente.id && !p.bloqueadoAt);
  const etiquetas = etiquetasEtapas(tipo, vigente.representa);
  const base = { contratoId: c.id, tipoEtiqueta: CONTRATO_DEFINICION[tipo]?.titulo ?? 'Documento' };
  const ahora = Date.now();

  switch (c.estado) {
    case 'APROBADO_PRINCIPAL':
      return [
        {
          ...base,
          tipo: 'enviar_contraparte',
          quien: partes.filter((p) => p.etapa === 'PRINCIPAL').map((p) => p.nombre).join(' y '),
          etapa: etiquetas.CONTRAPARTE,
          ...(destino ? { destino } : {}),
        },
      ];
    case 'CAMBIOS_SOLICITADOS_PRINCIPAL':
    case 'CAMBIOS_SOLICITADOS_CONTRAPARTE': {
      const quien = partes.find((p) => p.estado === 'RECHAZADO');
      return [{ ...base, tipo: 'cambios_pedidos', quien: quien?.nombre ?? '', etapa: quien ? etiquetas[quien.etapa] : null }];
    }
    case 'VENCIDO':
      return partes
        .filter((p) => estaPendiente(p) && p.expiraAt.getTime() < ahora)
        .map((p) => ({ ...base, tipo: 'vencido' as const, quien: p.nombre, etapa: etiquetas[p.etapa] }));
    case 'EN_REVISION_PRINCIPAL':
    case 'EN_REVISION_CONTRAPARTE':
      return partes
        .filter((p) => estaPendiente(p) && p.expiraAt.getTime() - ahora < HORAS_AVISO_VENCIMIENTO * 3600_000 && p.expiraAt.getTime() > ahora)
        .map((p) => ({
          ...base,
          tipo: 'por_vencer' as const,
          quien: p.nombre,
          etapa: etiquetas[p.etapa],
          horas: Math.max(1, Math.round((p.expiraAt.getTime() - ahora) / 3600_000)),
        }));
    default:
      return [];
  }
}

async function destinosDeContraparte(contratos: FilaListado[]): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  const esperando = contratos.filter((c) => c.estado === 'APROBADO_PRINCIPAL' && CONTRATO_DEFINICION[c.tipo as ContratoTipo]);
  const ids = esperando.map((c) => c.versiones.find((v) => v.numero === c.versionActual)?.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return salida;
  const versiones = await prisma.contratoVersion.findMany({ where: { id: { in: ids } }, select: { contratoId: true, representa: true, datosCifrados: true } });
  for (const v of versiones) {
    const c = esperando.find((x) => x.id === v.contratoId);
    if (!c || !v.datosCifrados) continue;
    try {
      const nombres = nombresDeEtapa(c.tipo as ContratoTipo, v.representa, descifrarDatos(v.datosCifrados), 'CONTRAPARTE');
      if (nombres.length > 0) salida.set(c.id, listaDeNombres(nombres));
    } catch {
      // Sin nombres, la alerta nombra el lado ("el comprador").
    }
  }
  return salida;
}

async function listar(agentId: string) {
  const [primeraLectura, listings, agente] = await Promise.all([
    leerContratos(agentId),
    prisma.listing.findMany({
      where: { managingAgentId: agentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, propertyType: true, operationType: true, city: true, zone: true, address: true,
        price: true, ownerName: true, ownerPhone: true,
        // Para prellenar la descripción del inmueble en el corretaje.
        areaM2: true, bedrooms: true, bathrooms: true, parkingSpaces: true,
      },
    }),
    prisma.agent.findUnique({
      where: { id: agentId },
      select: { fullName: true, company: true, idNumber: true, direccion: true, ciudad: true, email: true },
    }),
  ]);

  let contratos = primeraLectura;
  // Los enlaces que vencieron desde la última visita pasan el contrato a
  // VENCIDO (y lo registran) antes de armar la lista.
  const vencidos = contratos.filter((c) => {
    if (c.estado !== 'EN_REVISION_PRINCIPAL' && c.estado !== 'EN_REVISION_CONTRAPARTE') return false;
    const vigente = c.versiones.find((v) => v.numero === c.versionActual);
    return vigente ? estadoDelContrato(vigente, c.partes.filter((p) => p.versionId === vigente.id)) === 'VENCIDO' : false;
  });
  if (vencidos.length > 0) {
    for (const c of vencidos) {
      const completo = await contratoDelAgente(c.id, agentId);
      if (completo) await sincronizarVencimiento(completo);
    }
    contratos = await leerContratos(agentId);
  }

  // "Envíasela a Juan Pérez": para los contratos cuyo cliente ya aprobó, los
  // nombres de la otra parte salen de los datos con que se envió la versión.
  const destinos = await destinosDeContraparte(contratos);

  // En la fila solo viajan las partes de la versión vigente (o los firmantes
  // de un contrato de la etapa de firma): es lo que el agente necesita ver de
  // un vistazo. El historial completo está en el detalle.
  const filas = contratos.map(({ versiones, partes, ...c }) => {
    const vigente = versiones.find((v) => v.numero === c.versionActual);
    const tipo = c.tipo as ContratoTipo;
    return {
      ...c,
      etiquetas: CONTRATO_DEFINICION[tipo] ? etiquetasEtapas(tipo, vigente?.representa ?? c.representa) : null,
      partes: vigente ? partes.filter((p) => p.versionId === vigente.id) : partes.filter((p) => !p.versionId),
    };
  });

  return NextResponse.json({
    contratos: filasTolerantes(filas as unknown as ContratoFila[], (contrato, error) =>
      logContratos('no se pudo preparar un contrato para el listado: se muestra degradado', {
        agentId,
        contratoId: typeof contrato?.id === 'string' ? contrato.id : undefined,
        error,
      }),
    ),
    alertas: contratos.flatMap((c) => {
      try {
        return alertasDe(c, destinos.get(c.id));
      } catch {
        return [];
      }
    }),
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
  const { tipo, listingId, representa } = parsed.data;
  // Las claves internas (__) las escribe solo el servidor.
  const datos = Object.fromEntries(Object.entries(parsed.data.datos).filter(([k]) => !k.startsWith('__')));

  if (CONTRATO_TIPOS_LEGADO.includes(tipo)) {
    return NextResponse.json({ error: 'Ese tipo de contrato ya no está disponible.', code: 'tipo_archivado' }, { status: 400 });
  }
  if (representa !== undefined && !ladosDelTipo(tipo as ContratoTipo)?.lados.some((l) => l.clave === representa)) {
    return NextResponse.json({ error: 'Ese lado no existe en este documento.', code: 'representa_invalido' }, { status: 400 });
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

  const contrato = await prisma.$transaction(async (tx) => {
    const creado = await tx.contrato.create({
      data: {
        agentId: auth.agentId,
        tipo: tipo as PrismaContratoTipo,
        listingId: listingId ?? null,
        plantillaVersion: plantillaActual(tipo as ContratoTipo),
        datosCifrados: cifrarDatos(datosCompletos),
        codigoVerificacion: generarCodigoVerificacion(),
        representa: representa ?? null,
      },
    });
    await registrarEvento(tx, { contratoId: creado.id, tipo: 'CREACION', actor: 'AGENTE', solicitud: solicitudDe(request.headers) });
    return creado;
  });

  return NextResponse.json({
    contrato: { id: contrato.id, tipo: contrato.tipo, estado: contrato.estado, codigoVerificacion: contrato.codigoVerificacion },
    // Se informan los campos que faltan, pero NO se bloquea guardar un
    // borrador incompleto: el agente puede estar frente al cliente y
    // completarlo en dos tiempos. La validación dura es al enviar.
    faltantes: camposFaltantes(tipo as ContratoTipo, datos),
  });
}

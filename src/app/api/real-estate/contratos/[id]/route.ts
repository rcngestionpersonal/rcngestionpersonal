import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import {
  agenteConContratos,
  cambiosSinEnviar,
  congelada,
  contratoDelAgente,
  describirInmueble,
  documentoDeTrabajo,
  esContratoDeFirma,
  etiquetaRol,
  nombreDeParte,
  resultadoDeVersion,
  type ContratoCompleto,
} from '@/lib/real-estate/contratos/servidor';
import { cifrarDatos, descifrarDatos } from '@/lib/real-estate/contratos/aprobacion';
import { CLAVE_EDICION, compararVersiones, hayEdiciones } from '@/lib/real-estate/contratos/clausulas';
import { correoCancelado } from '@/lib/real-estate/contratos/correos';
import {
  CONTRATO_DEFINICION,
  camposFaltantes,
  esEditable,
  esTipoArchivado,
  type ContratoEstado,
  type ContratoTipo,
} from '@/lib/real-estate/contratos/tipos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLAVE_CLAUSULA = z.string().regex(/^[\w-]{1,60}$/);

// Lo que el editor de cláusulas puede guardar. Límites generosos para una
// cláusula real y cortos para un abuso.
const edicionSchema = z.object({
  textos: z
    .record(CLAVE_CLAUSULA, z.object({ titulo: z.string().trim().min(1).max(200), texto: z.string().trim().min(1).max(12000) }))
    .refine((o) => Object.keys(o).length <= 200),
  activas: z.record(CLAVE_CLAUSULA, z.boolean()).refine((o) => Object.keys(o).length <= 200),
  nuevas: z
    .array(
      z.object({
        id: z.string().regex(/^nueva-[a-z0-9]{4,24}$/),
        titulo: z.string().trim().min(1).max(200),
        texto: z.string().trim().min(1).max(12000),
        despuesDe: CLAVE_CLAUSULA.nullable(),
      }),
    )
    .max(50),
});

const editarSchema = z.object({
  datos: z.record(z.string(), z.string().max(5000)).optional(),
  listingId: z.string().min(1).nullable().optional(),
  clausulas: edicionSchema.optional(),
});

const anularSchema = z.object({ nota: z.string().trim().min(3, 'Indica el motivo.').max(500) });

function parteResumen(contrato: ContratoCompleto, p: ContratoCompleto['partes'][number]) {
  return {
    id: p.id,
    rol: p.rol,
    rolEtiqueta: etiquetaRol(contrato.tipo as ContratoTipo, p.rol),
    nombre: p.nombre,
    correo: p.correo,
    estado: p.estado,
    enviadoAt: p.enviadoAt,
    abiertoAt: p.abiertoAt,
    aprobadoAt: p.aprobadoAt,
    firmadoAt: p.firmadoAt,
    rechazadoAt: p.rechazadoAt,
    motivoRechazo: p.motivoRechazo,
    expiraAt: p.expiraAt,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  const tipo = contrato.tipo as ContratoTipo;
  const datos = descifrarDatos(contrato.datosCifrados);
  // Los campos internos (la foto del inmueble, las ediciones de cláusulas) no
  // vuelven al formulario.
  const visibles = Object.fromEntries(Object.entries(datos).filter(([k]) => !k.startsWith('__')));
  const deFirma = esContratoDeFirma(contrato);
  const editable = !deFirma && esEditable(contrato.estado as ContratoEstado, tipo);

  // Cada versión con lo que cambió respecto de la anterior: es el recorrido
  // de la negociación que el agente lleva a la notaría.
  const congeladas = contrato.versiones.map((v) => congelada(v));
  const versiones = contrato.versiones
    .map((v, i) => {
      const doc = congeladas[i];
      const previa = i > 0 ? congeladas[i - 1] : null;
      return {
        numero: v.numero,
        estado: v.estado,
        enviadaAt: v.enviadaAt,
        aprobadaAt: v.aprobadaAt,
        cerradaAt: v.cerradaAt,
        huella: v.huella,
        resultado: resultadoDeVersion(contrato, v),
        cambios: doc && previa ? compararVersiones(previa.bloques, doc.bloques) : null,
        partes: contrato.partes
          .filter((p) => p.versionId === v.id)
          .map((p) => ({ ...parteResumen(contrato, p), nombreParte: nombreDeParte(doc, tipo, p) })),
      };
    })
    .reverse();

  let cambios = null;
  if (editable && contrato.versionActual > 0) {
    const trabajo = await documentoDeTrabajo(contrato);
    cambios = cambiosSinEnviar(contrato, trabajo.preparado.bloques);
  }

  const vigente = contrato.versiones.find((v) => v.numero === contrato.versionActual);
  return NextResponse.json({
    contrato: {
      id: contrato.id,
      tipo: contrato.tipo,
      tipoEtiqueta: CONTRATO_DEFINICION[tipo]?.titulo ?? 'Documento',
      tipoConocido: Boolean(CONTRATO_DEFINICION[tipo]),
      archivado: esTipoArchivado(tipo),
      deFirma,
      editable,
      estado: contrato.estado,
      listingId: contrato.listingId,
      codigoVerificacion: contrato.codigoVerificacion,
      plantillaVersion: contrato.plantillaVersion,
      versionActual: contrato.versionActual,
      createdAt: contrato.createdAt,
      enviadoAt: contrato.enviadoAt,
      aprobadoAt: contrato.aprobadoAt,
      firmadoAt: contrato.firmadoAt,
      anuladoAt: contrato.anuladoAt,
      anuladoNota: contrato.anuladoNota,
      datos: visibles,
      inmueble: {
        descripcion: datos.__inmuebleDescripcion ?? '',
        ubicacion: datos.__inmuebleUbicacion ?? '',
      },
      partes: contrato.partes
        .filter((p) => (vigente ? p.versionId === vigente.id : !p.versionId))
        .map((p) => parteResumen(contrato, p)),
      versiones,
      cambiosSinEnviar: cambios,
    },
    faltantes: camposFaltantes(tipo, visibles),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  // Se edita mientras la negociación esté abierta. Lo enviado no se toca: los
  // cambios van a la copia de trabajo y salen como versión nueva.
  if (esContratoDeFirma(contrato) || !esEditable(contrato.estado as ContratoEstado, contrato.tipo)) {
    const archivado = esTipoArchivado(contrato.tipo);
    return NextResponse.json(
      {
        error: archivado
          ? 'Este tipo de contrato fue retirado. Puedes abrirlo y descargarlo, pero ya no se edita.'
          : 'Este contrato ya no se puede editar.',
        code: archivado ? 'tipo_archivado' : 'no_editable',
      },
      { status: 409 },
    );
  }

  const parsed = editarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const previos = descifrarDatos(contrato.datosCifrados);
  const internos = Object.fromEntries(Object.entries(previos).filter(([k]) => k.startsWith('__')));
  // Las claves internas las escribe solo el servidor.
  const delFormulario = parsed.data.datos
    ? Object.fromEntries(Object.entries(parsed.data.datos).filter(([k]) => !k.startsWith('__')))
    : Object.fromEntries(Object.entries(previos).filter(([k]) => !k.startsWith('__')));
  const datos: Record<string, string> = { ...delFormulario, ...internos };

  if (parsed.data.clausulas) {
    if (hayEdiciones(parsed.data.clausulas)) datos[CLAVE_EDICION] = JSON.stringify(parsed.data.clausulas);
    else delete datos[CLAVE_EDICION];
  }

  // Cambió el inmueble: se vuelve a congelar su descripción.
  const cambiaInmueble = parsed.data.listingId !== undefined && parsed.data.listingId !== contrato.listingId;
  if (cambiaInmueble) {
    const inmueble = await describirInmueble(parsed.data.listingId ?? null, auth.agentId);
    datos.__inmuebleDescripcion = inmueble.descripcion;
    datos.__inmuebleUbicacion = inmueble.ubicacion;
    datos.__inmuebleCaracteristicas = inmueble.caracteristicas;
  }

  await prisma.contrato.update({
    where: { id },
    data: {
      datosCifrados: cifrarDatos(datos),
      ...(cambiaInmueble ? { listingId: parsed.data.listingId ?? null } : {}),
    },
  });

  const visibles = Object.fromEntries(Object.entries(datos).filter(([k]) => !k.startsWith('__')));
  return NextResponse.json({ ok: true, faltantes: camposFaltantes(contrato.tipo as ContratoTipo, visibles) });
}

// DELETE solo borra lo que nunca salió. Un contrato enviado se anula, no se
// borra: hay terceros que recibieron un enlace y el historial es de ellos
// también.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  if (contrato.estado !== 'BORRADOR' || contrato.versionActual > 0 || contrato.partes.length > 0) {
    return NextResponse.json(
      { error: 'Solo se pueden eliminar borradores que nunca se enviaron. Los enviados se anulan.', code: 'no_borrable' },
      { status: 409 },
    );
  }

  await prisma.contrato.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// Anular: el agente detiene la negociación. Los enlaces dejan de servir y las
// partes que no habían decidido reciben aviso.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });
  if (contrato.estado === 'ANULADO') return NextResponse.json({ ok: true, yaAnulado: true });
  if (contrato.estado === 'FIRMADO') {
    return NextResponse.json({ error: 'Un contrato firmado no se anula desde aquí.', code: 'firmado' }, { status: 409 });
  }

  const parsed = anularSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Indica el motivo de la anulación.' }, { status: 400 });
  }

  const nombreDocumento = CONTRATO_DEFINICION[contrato.tipo as ContratoTipo].nombreDocumento;
  const ahora = new Date();
  const pendientes = contrato.partes.filter(
    (p) => (p.estado === 'ENVIADO' || p.estado === 'ABIERTO') && p.expiraAt.getTime() > ahora.getTime(),
  );

  await prisma.$transaction([
    prisma.contrato.update({
      where: { id },
      data: { estado: 'ANULADO', anuladoAt: ahora, anuladoNota: parsed.data.nota },
    }),
    prisma.contratoVersion.updateMany({
      where: { contratoId: id, estado: 'EN_APROBACION' },
      data: { estado: 'ANULADA', cerradaAt: ahora },
    }),
    // Los enlaces se invalidan venciéndolos: no se borran, para que quien
    // entre vea "este documento fue cancelado" y no un 404 sin explicación.
    prisma.contratoParte.updateMany({
      where: { contratoId: id, estado: { in: ['ENVIADO', 'ABIERTO'] } },
      data: { expiraAt: ahora },
    }),
  ]);

  if (isEmailConfigured()) {
    for (const p of pendientes) {
      const correo = correoCancelado({ nombreParte: p.nombre, nombreDocumento });
      await sendEmailNotification({ to: p.correo, ...correo }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

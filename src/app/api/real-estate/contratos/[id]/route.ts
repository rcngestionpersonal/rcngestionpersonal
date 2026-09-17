import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import {
  agenteConContratos,
  baseUrl,
  cambiosSinEnviar,
  congelada,
  contratoDelAgente,
  describirInmueble,
  documentoDeTrabajo,
  esContratoDeFirma,
  etiquetaRol,
  nombreDeParte,
  referenciaInmueble,
  resultadoDeVersion,
  ultimaVersion,
  type ContratoCompleto,
} from '@/lib/real-estate/contratos/servidor';
import { cifrarDatos, descifrarDatos, descifrarToken, fechaConZona } from '@/lib/real-estate/contratos/aprobacion';
import { CLAVE_EDICION, compararVersiones, hayEdiciones } from '@/lib/real-estate/contratos/clausulas';
import { correoCancelado } from '@/lib/real-estate/contratos/correos';
import { leerDetalle, registrarEdicion, registrarEvento, solicitudDe } from '@/lib/real-estate/contratos/eventos';
import {
  enlaceWhatsApp,
  estaPendiente,
  etapaCompleta,
  indicadorEtapas,
  mensajeParaCompartir,
  parteHabilitada,
} from '@/lib/real-estate/contratos/flujo';
import { sincronizarVencimiento } from '@/lib/real-estate/contratos/versiones';
import {
  CONTRATO_DEFINICION,
  VIGENCIAS_HORAS,
  camposFaltantes,
  esEditable,
  esTipoArchivado,
  etiquetasEtapas,
  identidadParte,
  ladoRepresentado,
  ladosDelTipo,
  vigenciaPorDefectoHoras,
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
  // A quién representa el agente: decide quién revisa primero.
  representa: z.string().max(40).optional(),
});

const anularSchema = z.object({ nota: z.string().trim().min(3, 'Indica el motivo.').max(500) });

type ParteFila = ContratoCompleto['partes'][number];

function parteResumen(contrato: ContratoCompleto, p: ParteFila) {
  return {
    id: p.id,
    rol: p.rol,
    rolEtiqueta: etiquetaRol(contrato.tipo as ContratoTipo, p.rol),
    etapa: p.etapa,
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
  let contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  // Un enlace vencido deja el contrato en VENCIDO (y el historial lo registra)
  // en cuanto alguien lo mira.
  const deFirma = esContratoDeFirma(contrato);
  if (!deFirma && (await sincronizarVencimiento(contrato)) !== contrato.estado) {
    contrato = (await contratoDelAgente(id, auth.agentId)) ?? contrato;
  }

  const tipo = contrato.tipo as ContratoTipo;
  const datos = descifrarDatos(contrato.datosCifrados);
  // Los campos internos (la foto del inmueble, las ediciones de cláusulas) no
  // vuelven al formulario.
  const visibles = Object.fromEntries(Object.entries(datos).filter(([k]) => !k.startsWith('__')));
  const editable = !deFirma && esEditable(contrato.estado, tipo);
  const vigente = ultimaVersion(contrato);
  const referencia = await referenciaInmueble(contrato, datos);
  const tipoDocumento = (CONTRATO_DEFINICION[tipo]?.titulo ?? 'documento').toLowerCase();

  // Cada versión con lo que cambió respecto de la anterior y quién decidió qué,
  // etapa por etapa. Las personas que aún no deciden la versión vigente traen
  // su enlace para compartirlo otra vez.
  const congeladas = contrato.versiones.map((v) => congelada(v));
  const versiones = contrato.versiones
    .map((v, i) => {
      const doc = congeladas[i];
      const previa = i > 0 ? congeladas[i - 1] : null;
      const partesVersion = contrato!.partes.filter((p) => p.versionId === v.id);
      return {
        numero: v.numero,
        estado: v.estado,
        enviadaAt: v.enviadaAt,
        aprobadaAt: v.aprobadaAt,
        cerradaAt: v.cerradaAt,
        huella: v.huella,
        simultanea: v.simultanea,
        principalHeredadaDe: v.principalHeredadaDe,
        contraparteEnviadaAt: v.contraparteEnviadaAt,
        principalAprobadaAt: v.principalAprobadaAt,
        etiquetas: etiquetasEtapas(tipo, v.representa),
        resultado: resultadoDeVersion(contrato!, v),
        cambios: doc && previa ? compararVersiones(previa.bloques, doc.bloques) : null,
        partes: partesVersion.map((p) => {
          const vigenteYPendiente = v.id === vigente?.id && v.estado === 'EN_APROBACION' && estaPendiente(p) && parteHabilitada(p, v, partesVersion);
          const token = vigenteYPendiente ? descifrarToken(p.tokenCifrado) : null;
          const url = token ? `${baseUrl()}/aprobar/${token}` : null;
          const mensaje = url ? mensajeParaCompartir({ nombre: p.nombre, tipoDocumento, referencia, enlace: url }) : null;
          return {
            ...parteResumen(contrato!, p),
            nombreParte: nombreDeParte(doc, tipo, p),
            // null si ya decidió, si la versión no está en revisión o si el
            // enlace es anterior al guardado cifrado (hay que regenerarlo).
            enlace:
              url && mensaje
                ? { url, mensaje, whatsapp: enlaceWhatsApp(identidadParte(tipo, datos, p.rol).telefono, mensaje), vencido: p.expiraAt.getTime() < Date.now() }
                : null,
            puedeRegenerar: vigenteYPendiente,
          };
        }),
      };
    })
    .reverse();

  let cambios = null;
  if (editable && contrato.versionActual > 0) {
    const trabajo = await documentoDeTrabajo(contrato);
    cambios = cambiosSinEnviar(contrato, trabajo.preparado.bloques);
  }

  const partesVigentes = vigente ? contrato.partes.filter((p) => p.versionId === vigente.id) : [];
  const representaVigente = vigente?.representa ?? contrato.representa;
  const eventos = await prisma.contratoEvento.findMany({ where: { contratoId: id }, orderBy: { createdAt: 'desc' }, take: 200 });

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
      representa: ladoRepresentado(tipo, contrato.representa)?.clave ?? null,
      lados: (ladosDelTipo(tipo)?.lados ?? []).map((l) => ({ clave: l.clave, etiqueta: l.etiqueta })),
      etiquetas: etiquetasEtapas(tipo, representaVigente),
      indicador: deFirma
        ? []
        : indicadorEtapas({
            etiquetas: etiquetasEtapas(tipo, representaVigente),
            estado: contrato.estado,
            principalCompleta: vigente ? etapaCompleta(vigente, partesVigentes, 'PRINCIPAL') : false,
          }),
      vigenciaHoras: contrato.vigenciaHoras ?? vigenciaPorDefectoHoras(tipo),
      vigencias: VIGENCIAS_HORAS,
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
      partes: contrato.partes.filter((p) => (vigente ? p.versionId === vigente.id : !p.versionId)).map((p) => parteResumen(contrato!, p)),
      versiones,
      cambiosSinEnviar: cambios,
      eventos: eventos.map((e) => {
        const d = leerDetalle(e.detalleCifrado);
        return {
          id: e.id,
          tipo: e.tipo,
          actor: e.actor,
          fecha: e.createdAt,
          fechaEcuador: fechaConZona(e.createdAt),
          etapa: e.etapa,
          rolEtiqueta: e.rol ? etiquetaRol(tipo, e.rol) : null,
          versionNumero: e.versionNumero,
          huella: e.huella,
          nombre: d?.nombre ?? null,
          comentario: d?.comentario ?? null,
          canal: d?.canal ?? null,
          campos: d?.campos ?? null,
          nota: d?.nota ?? null,
          ip: d?.ip ?? null,
          navegador: d?.navegador ?? null,
        };
      }),
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
  // cambios van a la copia de trabajo y salen como versión nueva, que vuelve a
  // pasar por las aprobaciones.
  if (esContratoDeFirma(contrato) || !esEditable(contrato.estado, contrato.tipo)) {
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
  const tipo = contrato.tipo as ContratoTipo;
  if (parsed.data.representa !== undefined && !ladosDelTipo(tipo)?.lados.some((l) => l.clave === parsed.data.representa)) {
    return NextResponse.json({ error: 'Ese lado no existe en este documento.', code: 'representa_invalido' }, { status: 400 });
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

  const nuevoCifrado = cifrarDatos(datos);
  const cambioAlgo =
    JSON.stringify(previos) !== JSON.stringify(datos) || cambiaInmueble || (parsed.data.representa !== undefined && parsed.data.representa !== contrato.representa);

  await prisma.contrato.update({
    where: { id },
    data: {
      datosCifrados: nuevoCifrado,
      ...(cambiaInmueble ? { listingId: parsed.data.listingId ?? null } : {}),
      ...(parsed.data.representa !== undefined ? { representa: parsed.data.representa } : {}),
    },
  });
  if (cambioAlgo) await registrarEdicion(id, solicitudDe(request.headers));

  const visibles = Object.fromEntries(Object.entries(datos).filter(([k]) => !k.startsWith('__')));
  return NextResponse.json({ ok: true, faltantes: camposFaltantes(tipo, visibles) });
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
// personas que no habían decidido y tienen correo reciben aviso: se lo pidió el
// agente con esta acción.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });
  if (contrato.estado === 'ANULADO') return NextResponse.json({ ok: true, yaAnulado: true });
  if (esContratoDeFirma(contrato)) {
    return NextResponse.json({ error: 'Un contrato de la etapa de firma electrónica no se anula desde aquí.', code: 'firmado' }, { status: 409 });
  }

  const parsed = anularSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Indica el motivo de la anulación.' }, { status: 400 });
  }

  const nombreDocumento = CONTRATO_DEFINICION[contrato.tipo as ContratoTipo].nombreDocumento;
  const ahora = new Date();
  const pendientes = contrato.partes.filter((p) => estaPendiente(p) && p.expiraAt.getTime() > ahora.getTime());
  const vigente = ultimaVersion(contrato);

  await prisma.$transaction(async (tx) => {
    await tx.contrato.update({ where: { id }, data: { estado: 'ANULADO', anuladoAt: ahora, anuladoNota: parsed.data.nota } });
    await tx.contratoVersion.updateMany({ where: { contratoId: id, estado: 'EN_APROBACION' }, data: { estado: 'ANULADA', cerradaAt: ahora } });
    // Los enlaces se invalidan venciéndolos: no se borran, para que quien
    // entre vea "este documento fue cancelado" y no un 404 sin explicación.
    await tx.contratoParte.updateMany({ where: { contratoId: id, estado: { in: ['ENVIADO', 'ABIERTO'] } }, data: { expiraAt: ahora } });
    await registrarEvento(tx, {
      contratoId: id,
      tipo: 'ANULACION',
      actor: 'AGENTE',
      versionNumero: vigente?.numero ?? null,
      huella: vigente?.huella ?? null,
      solicitud: solicitudDe(request.headers),
      detalle: { comentario: parsed.data.nota },
      fecha: ahora,
    });
  });

  if (isEmailConfigured()) {
    for (const p of pendientes) {
      if (!p.correo) continue;
      const correo = correoCancelado({ nombreParte: p.nombre, nombreDocumento });
      await sendEmailNotification({ to: p.correo, ...correo }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

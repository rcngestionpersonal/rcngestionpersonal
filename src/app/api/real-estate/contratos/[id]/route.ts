import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { agenteConContratos, contratoDelAgente, etiquetaRol } from '@/lib/real-estate/contratos/servidor';
import { cifrarDatos, descifrarDatos } from '@/lib/real-estate/contratos/firma';
import { correoCancelado } from '@/lib/real-estate/contratos/correos';
import { CONTRATO_DEFINICION, camposFaltantes, esEditable, esTipoArchivado, type ContratoEstado, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const editarSchema = z.object({
  datos: z.record(z.string(), z.string()).optional(),
  listingId: z.string().min(1).nullable().optional(),
});

const anularSchema = z.object({ nota: z.string().trim().min(3, 'Indica el motivo.').max(500) });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  const datos = descifrarDatos(contrato.datosCifrados);
  // Los campos internos (la foto del inmueble) no vuelven al formulario.
  const visibles = Object.fromEntries(Object.entries(datos).filter(([k]) => !k.startsWith('__')));

  return NextResponse.json({
    contrato: {
      id: contrato.id,
      tipo: contrato.tipo,
      estado: contrato.estado,
      listingId: contrato.listingId,
      codigoVerificacion: contrato.codigoVerificacion,
      plantillaVersion: contrato.plantillaVersion,
      createdAt: contrato.createdAt,
      enviadoAt: contrato.enviadoAt,
      firmadoAt: contrato.firmadoAt,
      anuladoAt: contrato.anuladoAt,
      anuladoNota: contrato.anuladoNota,
      datos: visibles,
      inmueble: {
        descripcion: datos.__inmuebleDescripcion ?? '',
        ubicacion: datos.__inmuebleUbicacion ?? '',
      },
      firmantes: contrato.firmantes.map((f) => ({
        id: f.id,
        rol: f.rol,
        rolEtiqueta: etiquetaRol(contrato.tipo as ContratoTipo, f.rol),
        nombre: f.nombre,
        correo: f.correo,
        estado: f.estado,
        enviadoAt: f.enviadoAt,
        abiertoAt: f.abiertoAt,
        firmadoAt: f.firmadoAt,
        rechazadoAt: f.rechazadoAt,
        motivoRechazo: f.motivoRechazo,
        expiraAt: f.expiraAt,
      })),
    },
    faltantes: camposFaltantes(contrato.tipo as ContratoTipo, visibles),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  // Un contrato firmado NO se puede editar (punto 4.3). Tampoco uno que ya
  // salio a firmar: las partes estan leyendo ese texto en este momento.
  if (!esEditable(contrato.estado as ContratoEstado, contrato.tipo)) {
    return NextResponse.json(
      {
        error: esTipoArchivado(contrato.tipo)
          ? 'Este tipo de contrato fue retirado. Puedes abrirlo y descargarlo, pero ya no se edita.'
          : 'Este contrato ya no se puede editar. Anúlalo y genera uno nuevo.',
        code: esTipoArchivado(contrato.tipo) ? 'tipo_archivado' : 'no_editable',
      },
      { status: 409 },
    );
  }

  const parsed = editarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });

  const previos = descifrarDatos(contrato.datosCifrados);
  const internos = Object.fromEntries(Object.entries(previos).filter(([k]) => k.startsWith('__')));
  const datos = parsed.data.datos ? { ...parsed.data.datos, ...internos } : previos;

  const actualizado = await prisma.contrato.update({
    where: { id },
    data: {
      datosCifrados: cifrarDatos(datos),
      ...(parsed.data.listingId !== undefined ? { listingId: parsed.data.listingId } : {}),
    },
  });

  const visibles = Object.fromEntries(Object.entries(datos).filter(([k]) => !k.startsWith('__')));
  return NextResponse.json({
    ok: true,
    estado: actualizado.estado,
    faltantes: camposFaltantes(contrato.tipo as ContratoTipo, visibles),
  });
}

// DELETE solo borra BORRADORES. Un contrato enviado o firmado se anula, no se
// borra: hay terceros que recibieron un enlace y merecen una traza.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  if (contrato.estado !== 'BORRADOR') {
    return NextResponse.json(
      { error: 'Solo se pueden eliminar borradores. Los contratos enviados se anulan.', code: 'no_borrable' },
      { status: 409 },
    );
  }

  await prisma.contrato.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// Anular: el agente detiene el proceso. Los enlaces dejan de servir y las
// partes reciben aviso (punto 3.9).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });
  if (contrato.estado === 'ANULADO') return NextResponse.json({ ok: true, yaAnulado: true });

  const parsed = anularSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Indica el motivo de la anulación.' }, { status: 400 });
  }

  const nombreDocumento = CONTRATO_DEFINICION[contrato.tipo as ContratoTipo].nombreDocumento;
  const estabaEnFirma = contrato.estado === 'PENDIENTE_FIRMA';

  await prisma.$transaction([
    prisma.contrato.update({
      where: { id },
      data: { estado: 'ANULADO', anuladoAt: new Date(), anuladoNota: parsed.data.nota },
    }),
    // Los enlaces se invalidan venciendolos: no se borran, para que quien
    // entre vea "este documento fue cancelado" y no un 404 sin explicacion.
    prisma.contratoFirmante.updateMany({
      where: { contratoId: id, estado: { in: ['ENVIADO', 'ABIERTO'] } },
      data: { expiraAt: new Date() },
    }),
  ]);

  if (estabaEnFirma && isEmailConfigured()) {
    for (const f of contrato.firmantes) {
      if (f.estado === 'FIRMADO' || f.estado === 'RECHAZADO') continue;
      const correo = correoCancelado({ nombreFirmante: f.nombre, nombreDocumento });
      await sendEmailNotification({ to: f.correo, ...correo }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

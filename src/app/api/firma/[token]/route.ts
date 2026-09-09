import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { bloquesATextoPlano, construirDocumento } from '@/lib/real-estate/contratos/documento';
import {
  cifrarEvidencia,
  coincidenUltimos4,
  describirNavegador,
  descifrarDatos,
  hashToken,
  ipDeSolicitud,
} from '@/lib/real-estate/contratos/firma';
import { correoDocumentoFirmado, correoRechazo } from '@/lib/real-estate/contratos/correos';
import { baseUrl, calcularHash, construirPdf, etiquetaRol, nombreArchivoContrato } from '@/lib/real-estate/contratos/servidor';
import { CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';
import { obtenerPlantilla } from '@/lib/real-estate/contratos/plantillas';

// API publica de la firma. SIN sesion: la credencial es el acceso al correo
// donde llego el enlace (punto 3.4). El token nunca se guarda en claro, asi
// que se busca por su hash.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const firmarSchema = z.object({
  accion: z.literal('firmar'),
  ultimos4: z.string().regex(/^\d{4}$/, 'Ingresa los últimos 4 dígitos.'),
  leyoCompleto: z.boolean(),
  aceptoLectura: z.boolean(),
  aceptoValorFirma: z.boolean(),
  zonaHoraria: z.string().max(80).optional(),
});

const rechazarSchema = z.object({
  accion: z.literal('rechazar'),
  motivo: z.string().trim().min(3, 'Indica el motivo del rechazo.').max(500),
});

async function cargarPorToken(token: string) {
  const firmante = await prisma.contratoFirmante.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { contrato: { include: { firmantes: true } } },
  });
  return firmante;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const firmante = await cargarPorToken(token);
  if (!firmante) return NextResponse.json({ error: 'Enlace no válido.', code: 'invalido' }, { status: 404 });

  const contrato = firmante.contrato;
  const tipo = contrato.tipo as ContratoTipo;
  const nombreDocumento = CONTRATO_DEFINICION[tipo].nombreDocumento;

  if (contrato.estado === 'ANULADO') {
    return NextResponse.json({ error: 'Este documento fue cancelado.', code: 'cancelado' }, { status: 409 });
  }
  if (contrato.estado === 'RECHAZADO') {
    return NextResponse.json({ error: 'Este documento fue rechazado por una de las partes.', code: 'rechazado' }, { status: 409 });
  }
  if (firmante.estado === 'FIRMADO') {
    return NextResponse.json({ error: 'Ya firmaste este documento.', code: 'ya_firmado' }, { status: 409 });
  }
  if (firmante.expiraAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'El enlace venció.', code: 'vencido' }, { status: 410 });
  }

  const cuerpo = await request.json().catch(() => null);

  // ---- Rechazo (punto 3.9) ------------------------------------------------
  const rechazo = rechazarSchema.safeParse(cuerpo);
  if (rechazo.success) {
    await prisma.$transaction([
      prisma.contratoFirmante.update({
        where: { id: firmante.id },
        data: { estado: 'RECHAZADO', rechazadoAt: new Date(), motivoRechazo: rechazo.data.motivo },
      }),
      prisma.contrato.update({ where: { id: contrato.id }, data: { estado: 'RECHAZADO' } }),
      // El rechazo detiene el proceso: los enlaces de los demas dejan de
      // admitir firma.
      prisma.contratoFirmante.updateMany({
        where: { contratoId: contrato.id, estado: { in: ['ENVIADO', 'ABIERTO'] } },
        data: { expiraAt: new Date() },
      }),
    ]);

    const agente = await prisma.agent.findUnique({ where: { id: contrato.agentId }, select: { fullName: true, email: true } });
    if (agente?.email && isEmailConfigured()) {
      const correo = correoRechazo({
        nombreAgente: agente.fullName,
        nombreDocumento,
        quienRechazo: `${firmante.nombre} (${etiquetaRol(tipo, firmante.rol)})`,
        motivo: rechazo.data.motivo,
      });
      await sendEmailNotification({ to: agente.email, ...correo }).catch(() => {});
    }
    return NextResponse.json({ ok: true, estado: 'RECHAZADO' });
  }

  // ---- Firma --------------------------------------------------------------
  const parsed = firmarSchema.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos incompletos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const datosFirma = parsed.data;

  // Las dos casillas son obligatorias y el desplazamiento tambien: son la
  // prueba de que tuvo el contenido a la vista (puntos 3.4 y 3.5).
  if (!datosFirma.aceptoLectura || !datosFirma.aceptoValorFirma) {
    return NextResponse.json({ error: 'Debes aceptar ambas declaraciones para firmar.' }, { status: 400 });
  }
  if (!datosFirma.leyoCompleto) {
    return NextResponse.json({ error: 'Desplaza el documento hasta el final antes de firmar.' }, { status: 400 });
  }
  if (!coincidenUltimos4(datosFirma.ultimos4, firmante.cedulaUlt4)) {
    return NextResponse.json(
      { error: 'Los últimos 4 dígitos no coinciden con los registrados.', code: 'cedula_no_coincide' },
      { status: 403 },
    );
  }

  // Hash del texto exacto que el firmante tenia a la vista.
  const datos = descifrarDatos(contrato.datosCifrados);
  const agenteDoc = await prisma.agent.findUnique({
    where: { id: contrato.agentId },
    select: { fullName: true, idNumber: true, direccion: true, referenciaDireccion: true, ciudad: true, phone: true, email: true },
  });
  const doc = construirDocumento({
    tipo,
    version: contrato.plantillaVersion,
    datos,
    agente: {
      nombre: agenteDoc?.fullName ?? '—',
      cedula: agenteDoc?.idNumber ?? '—',
      ruc: null,
      direccion: [agenteDoc?.direccion, agenteDoc?.referenciaDireccion, agenteDoc?.ciudad].filter(Boolean).join(', ') || 'Quito',
      telefono: agenteDoc?.phone ?? '—',
      correo: agenteDoc?.email ?? '—',
      ciudad: agenteDoc?.ciudad || 'Quito',
    },
    inmueble: {
      descripcion: datos.__inmuebleDescripcion ?? '',
      ubicacion: datos.__inmuebleUbicacion ?? '',
      caracteristicas: datos.__inmuebleCaracteristicas ?? '',
    },
    fecha: contrato.createdAt,
  });
  const hash = calcularHash(bloquesATextoPlano(doc.bloques), contrato.codigoVerificacion);

  const evidencia = cifrarEvidencia({
    ip: ipDeSolicitud(request.headers),
    userAgent: describirNavegador(request.headers.get('user-agent')),
    leyoCompleto: true,
    hashDocumento: hash,
    aceptoLectura: true,
    aceptoValorFirma: true,
    zonaHoraria: datosFirma.zonaHoraria ?? null,
  });

  await prisma.contratoFirmante.update({
    where: { id: firmante.id },
    data: { estado: 'FIRMADO', firmadoAt: new Date(), evidenciaCifrada: evidencia },
  });

  // ¿Firmaron todos? Se relee para no depender de la copia en memoria.
  const restantes = await prisma.contratoFirmante.count({
    where: { contratoId: contrato.id, estado: { not: 'FIRMADO' } },
  });

  if (restantes > 0) {
    return NextResponse.json({ ok: true, estado: 'FIRMADO', faltanOtros: restantes });
  }

  // ---- Sellado final (punto 3.8) -----------------------------------------
  await prisma.contrato.update({
    where: { id: contrato.id },
    data: { estado: 'FIRMADO', firmadoAt: new Date(), hashDocumento: hash },
  });

  const completo = await prisma.contrato.findUnique({ where: { id: contrato.id }, include: { firmantes: true } });
  if (completo && isEmailConfigured()) {
    const { buffer } = await construirPdf(completo);
    const adjunto = { filename: nombreArchivoContrato(tipo, contrato.codigoVerificacion), content: buffer };
    const urlVerificacion = `${baseUrl()}/c/${contrato.codigoVerificacion}`;

    const destinatarios = new Map<string, string>();
    for (const f of completo.firmantes) destinatarios.set(f.correo, f.nombre);
    if (agenteDoc?.email) destinatarios.set(agenteDoc.email, agenteDoc.fullName);

    for (const [correoDestino, nombre] of destinatarios) {
      const correo = correoDocumentoFirmado({
        nombreFirmante: nombre,
        nombreDocumento,
        codigo: contrato.codigoVerificacion,
        urlVerificacion,
      });
      await sendEmailNotification({ to: correoDestino, ...correo, attachments: [adjunto] }).catch(() => {});
    }
  }

  // La plantilla usada queda registrada en la respuesta para trazabilidad.
  return NextResponse.json({
    ok: true,
    estado: 'FIRMADO',
    faltanOtros: 0,
    completo: true,
    plantilla: obtenerPlantilla(contrato.plantillaVersion).version,
  });
}

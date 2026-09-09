import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { agenteConContratos, baseUrl, contratoDelAgente } from '@/lib/real-estate/contratos/servidor';
import { fechaExpiracion, generarToken } from '@/lib/real-estate/contratos/firma';
import { correoSolicitudFirma } from '@/lib/real-estate/contratos/correos';
import { CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// Reenviar el enlace a un firmante (punto 3.7). Genera un token NUEVO y vence
// el anterior: si el correo viejo llego a la bandeja equivocada, deja de
// servir en el momento en que se reenvia.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ firmanteId: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });
  if (contrato.estado !== 'PENDIENTE_FIRMA') {
    return NextResponse.json({ error: 'Este contrato no está pendiente de firma.' }, { status: 409 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Firmante no válido.' }, { status: 400 });

  const firmante = contrato.firmantes.find((f) => f.id === parsed.data.firmanteId);
  if (!firmante) return NextResponse.json({ error: 'Firmante no encontrado.' }, { status: 404 });
  if (firmante.estado === 'FIRMADO') {
    return NextResponse.json({ error: 'Esta parte ya firmó.' }, { status: 409 });
  }

  const agente = await prisma.agent.findUnique({
    where: { id: auth.agentId },
    select: { fullName: true, company: true, email: true },
  });

  const { token, hash } = generarToken();
  const expira = fechaExpiracion();
  await prisma.contratoFirmante.update({
    where: { id: firmante.id },
    data: { tokenHash: hash, expiraAt: expira, estado: 'ENVIADO', enviadoAt: new Date(), abiertoAt: null },
  });

  const correo = correoSolicitudFirma({
    nombreFirmante: firmante.nombre,
    nombreDocumento: CONTRATO_DEFINICION[contrato.tipo as ContratoTipo].nombreDocumento,
    agente: { nombre: agente?.fullName ?? 'Su agente', empresa: agente?.company ?? null },
    url: `${baseUrl()}/firmar/${token}`,
    venceEl: expira.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }),
  });

  const resultado = await sendEmailNotification({
    to: firmante.correo,
    subject: correo.subject,
    text: correo.text,
    html: correo.html,
    ...(agente?.email ? { replyTo: agente.email } : {}),
  });

  if (!resultado.delivered) {
    return NextResponse.json({ error: resultado.error ?? 'No se pudo reenviar el correo.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, expiraAt: expira });
}

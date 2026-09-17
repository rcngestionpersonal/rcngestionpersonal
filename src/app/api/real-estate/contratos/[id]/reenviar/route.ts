import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { agenteConContratos, baseUrl, contratoDelAgente, perfilAgente, ultimaVersion } from '@/lib/real-estate/contratos/servidor';
import { regenerarEnlace } from '@/lib/real-estate/contratos/versiones';
import { fechaLarga } from '@/lib/real-estate/contratos/aprobacion';
import { correoSolicitudAprobacion } from '@/lib/real-estate/contratos/correos';
import { CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// Reenviar el enlace de la versión en revisión a una parte que aún no decidió.
// Genera un token NUEVO y vence el anterior: si el correo viejo llegó a la
// bandeja equivocada, deja de servir en el momento en que se reenvía.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ parteId: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  const version = ultimaVersion(contrato);
  if (contrato.estado !== 'EN_APROBACION' || !version || version.estado !== 'EN_APROBACION') {
    return NextResponse.json({ error: 'No hay una versión en revisión.', code: 'sin_version_en_revision' }, { status: 409 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Parte no válida.' }, { status: 400 });

  // Solo partes de la versión vigente: reenviar una versión reemplazada haría
  // aprobar un texto que ya no es el que se negocia.
  const parte = contrato.partes.find((p) => p.id === parsed.data.parteId && p.versionId === version.id);
  if (!parte) return NextResponse.json({ error: 'Parte no encontrada.' }, { status: 404 });
  if (parte.estado === 'APROBADO' || parte.estado === 'RECHAZADO') {
    return NextResponse.json({ error: 'Esta parte ya decidió sobre la versión.' }, { status: 409 });
  }

  const perfil = await perfilAgente(auth.agentId);
  const { token, expiraAt } = await regenerarEnlace(parte.id);

  const correo = correoSolicitudAprobacion({
    nombreParte: parte.nombre,
    nombreDocumento: CONTRATO_DEFINICION[contrato.tipo as ContratoTipo].nombreDocumento,
    numero: version.numero,
    agente: { nombre: perfil.nombre, empresa: perfil.empresa },
    url: `${baseUrl()}/aprobar/${token}`,
    venceEl: fechaLarga(expiraAt),
    cambios: null,
  });

  const resultado = await sendEmailNotification({
    to: parte.correo,
    ...correo,
    fromName: perfil.nombre,
    ...(perfil.correo ? { replyTo: perfil.correo } : {}),
  });

  if (!resultado.delivered) {
    return NextResponse.json({ error: resultado.error ?? 'No se pudo reenviar el correo.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, expiraAt });
}

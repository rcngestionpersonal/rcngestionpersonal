import { NextRequest, NextResponse } from 'next/server';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import {
  agenteConContratos,
  baseUrl,
  contratoDelAgente,
  esContratoDeFirma,
  logContratos,
  perfilAgente,
} from '@/lib/real-estate/contratos/servidor';
import { crearVersion } from '@/lib/real-estate/contratos/versiones';
import { correoSolicitudAprobacion } from '@/lib/real-estate/contratos/correos';
import { fechaLarga } from '@/lib/real-estate/contratos/aprobacion';

// "Enviar para aprobación": congela la copia de trabajo como la versión
// siguiente y manda a cada parte su propio enlace.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });
  if (esContratoDeFirma(contrato)) {
    return NextResponse.json(
      { error: 'Este contrato es de la etapa de firma electrónica y ya no admite envíos.', code: 'firma_retirada' },
      { status: 409 },
    );
  }
  // Sin correo no hay cómo hacer llegar la versión: se comprueba antes de
  // congelar nada.
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });
  }

  const perfil = await perfilAgente(auth.agentId);
  const resultado = await crearVersion(contrato, perfil);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error, code: resultado.code, ...(resultado.faltantes ? { faltantes: resultado.faltantes } : {}) },
      { status: resultado.status },
    );
  }

  const fallidos: string[] = [];
  for (const enlace of resultado.enlaces) {
    const correo = correoSolicitudAprobacion({
      nombreParte: enlace.nombre,
      nombreDocumento: resultado.nombreDocumento,
      numero: resultado.numero,
      agente: { nombre: perfil.nombre, empresa: perfil.empresa },
      url: `${baseUrl()}/aprobar/${enlace.token}`,
      venceEl: fechaLarga(resultado.expiraAt),
      cambios: resultado.cambios,
    });
    const envio = await sendEmailNotification({
      to: enlace.correo,
      ...correo,
      fromName: perfil.nombre,
      // Quien envía es el agente: la respuesta le llega a él.
      ...(perfil.correo ? { replyTo: perfil.correo } : {}),
    });
    if (!envio.delivered) {
      fallidos.push(enlace.correo);
      logContratos(`no se pudo enviar la versión ${resultado.numero} a una parte`, { agentId: auth.agentId, contratoId: id, error: envio.error });
    }
  }

  return NextResponse.json({ ok: true, numero: resultado.numero, enviados: resultado.enlaces.length, fallidos });
}

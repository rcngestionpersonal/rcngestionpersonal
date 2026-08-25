import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/real-estate/subscription-config';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { buildPasswordResetEmail } from '@/lib/real-estate/email-templates';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';
import {
  checkAccountRateLimit,
  checkIpRateLimit,
  createResetToken,
  findAgentByIdentifier,
  logIpAttempt,
} from '@/lib/real-estate/password-reset';

const ENTITY_TYPE = 'password_reset';

// Respuesta SIEMPRE identica (anti-enumeracion): nunca revela si el identificador
// corresponde a una cuenta real, si tiene correo, o si esta bloqueado por rate
// limit - toda la logica condicional ocurre puertas adentro.
const NEUTRAL_MESSAGE =
  'Si el dato corresponde a una cuenta de Redinmo, te enviamos un enlace para restablecer tu contraseña. Revisa tu correo (y la carpeta de spam).';

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

async function logEvent(agentId: string, eventType: string): Promise<void> {
  if (shouldUseMockStore()) return;
  try {
    await prisma.eventLog.create({ data: { entityType: ENTITY_TYPE, entityId: agentId, eventType } });
  } catch {
    // secundario: nunca debe interrumpir la respuesta neutra
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const identifier = typeof body?.identifier === 'string' ? body.identifier : '';
  const requestIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;

  const neutralResponse = () => NextResponse.json({ success: true, message: NEUTRAL_MESSAGE });

  if (!identifier.trim()) {
    return neutralResponse();
  }

  if (requestIp) {
    await logIpAttempt(requestIp);
    if (!(await checkIpRateLimit(requestIp))) {
      return neutralResponse();
    }
  }

  try {
    const agent = await findAgentByIdentifier(identifier);
    if (!agent) {
      return neutralResponse();
    }

    if (!(await checkAccountRateLimit(agent.id))) {
      return neutralResponse();
    }

    const rawToken = await createResetToken(agent.id, requestIp);
    await logEvent(agent.id, 'PASSWORD_RESET_REQUESTED');

    const link = `${getAppUrl()}/restablecer?token=${rawToken}`;
    if (agent.email) {
      const email = buildPasswordResetEmail(firstNameOf(agent.fullName), link);
      await sendEmailNotification({ to: agent.email, subject: email.subject, text: email.text, html: email.html });
    }

    // Solo en modo mock (sin correo real que revisar) se expone el token crudo en
    // la respuesta, para poder probar el flujo completo sin depender de Resend/Neon.
    // En produccion NUNCA se expone aqui, aunque el envio de correo falle o no
    // haya correo registrado - de lo contrario el endpoint filtraria el token.
    return NextResponse.json({ success: true, message: NEUTRAL_MESSAGE, ...(shouldUseMockStore() ? { devToken: rawToken } : {}) });
  } catch {
    return neutralResponse();
  }
}

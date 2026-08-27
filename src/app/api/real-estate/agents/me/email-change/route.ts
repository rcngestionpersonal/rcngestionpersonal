import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { buildEmailChangeVerificationEmail } from '@/lib/real-estate/email-templates';
import { isEmailTaken, requestEmailChange } from '@/lib/real-estate/email-change';
import { findAgentById, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/real-estate/subscription-config';

const schema = z.object({ email: z.string().trim().email('Ingresa un correo electrónico válido.') });

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// Pide el cambio de correo: el correo ACTUAL sigue vigente hasta que el
// agente confirme el nuevo desde el enlace que se le envia (seccion 3.4 de
// editar perfil). Nunca escribe directo a Agent.email aqui.
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados pueden cambiar su correo.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Correo inválido.' }, { status: 400 });
  }
  const newEmail = parsed.data.email;

  if (await isEmailTaken(newEmail, session.agentId)) {
    return NextResponse.json({ error: 'Ese correo ya está en uso por otra cuenta.' }, { status: 409 });
  }

  const fullName = shouldUseMockStore()
    ? findAgentById(session.agentId)?.fullName
    : (await prisma.agent.findUnique({ where: { id: session.agentId }, select: { fullName: true } }))?.fullName;

  const rawToken = await requestEmailChange(session.agentId, newEmail);
  const link = `${getAppUrl()}/api/real-estate/agents/me/email-change/confirm?token=${rawToken}`;
  const email = buildEmailChangeVerificationEmail(firstNameOf(fullName ?? 'agente'), link);
  await sendEmailNotification({ to: newEmail, subject: email.subject, text: email.text, html: email.html });

  return NextResponse.json({ success: true, ...(shouldUseMockStore() ? { devToken: rawToken } : {}) });
}

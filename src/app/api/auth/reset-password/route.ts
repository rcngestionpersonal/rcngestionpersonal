import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, hashPassword, normalizeTenant, signSession } from '@/lib/auth';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { buildPasswordChangedEmail } from '@/lib/real-estate/email-templates';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { consumeResetToken, updateAgentPassword } from '@/lib/real-estate/password-reset';

const ENTITY_TYPE = 'password_reset';

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

async function logEvent(agentId: string, eventType: string): Promise<void> {
  if (shouldUseMockStore()) return;
  try {
    await prisma.eventLog.create({ data: { entityType: ENTITY_TYPE, entityId: agentId, eventType } });
  } catch {
    // secundario: nunca debe interrumpir el flujo real de restablecimiento
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Token y una contraseña de al menos 8 caracteres son obligatorios.' }, { status: 400 });
  }

  const consumed = await consumeResetToken(token);
  if (!consumed.valid) {
    if (consumed.agentId) await logEvent(consumed.agentId, 'PASSWORD_RESET_INVALID_TOKEN_ATTEMPT');
    return NextResponse.json({ error: 'Este enlace ya no es válido.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const agent = await updateAgentPassword(consumed.agentId, passwordHash);
  if (!agent) {
    return NextResponse.json({ error: 'No se pudo actualizar la contraseña.' }, { status: 500 });
  }

  await logEvent(agent.id, 'PASSWORD_RESET_COMPLETED');

  if (agent.email) {
    const nowLabel = new Date().toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' });
    const email = buildPasswordChangedEmail(firstNameOf(agent.fullName), nowLabel);
    void sendEmailNotification({ to: agent.email, subject: email.subject, text: email.text, html: email.html });
  }

  const sessionToken = await signSession({
    role: 'agent',
    agentId: agent.id,
    tenantId: normalizeTenant(agent.company ?? process.env.TENANT_ID ?? 'brokerhub'),
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return response;
}

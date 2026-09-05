import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { requestPhoneOtp, shouldUseMockStore } from '@/lib/real-estate/mock-store';

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados pueden verificar su teléfono.' }, { status: 403 });
  }

  if (shouldUseMockStore()) {
    const result = await requestPhoneOtp(session.agentId);
    if (!result) {
      return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      fallback: true,
      demoCode: result.code,
    });
  }

  try {
    const agent = await prisma.agent.findUnique({ where: { id: session.agentId } });
    if (!agent) {
      return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    }

    const code = generateOtpCode();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.agent.update({ where: { id: agent.id }, data: { otpCode: code, otpExpiresAt } });

    let emailed = false;
    if (agent.email) {
      const result = await sendEmailNotification({
        to: agent.email,
        subject: 'Tu código de verificación - Redinmo.io',
        text: `Hola ${agent.fullName}, tu código de verificación de teléfono es: ${code}. Vence en 10 minutos.`,
      });
      emailed = result.delivered;
    }

    return NextResponse.json({
      success: true,
      demoCode: emailed ? undefined : code,
    });
  } catch {
    const result = await requestPhoneOtp(session.agentId);
    return NextResponse.json({ success: true, fallback: true, demoCode: result?.code });
  }
}

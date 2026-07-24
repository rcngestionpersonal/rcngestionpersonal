import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { confirmPhoneOtp, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { awardProfileComplete } from '@/lib/real-estate/points-log';

const confirmSchema = z.object({
  code: z.string().trim().min(4, 'Código inválido.'),
});

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados pueden verificar su teléfono.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
  }

  if (shouldUseMockStore()) {
    const result = confirmPhoneOtp(session.agentId, parsed.data.code);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'No se pudo verificar el código.' }, { status: 400 });
    }
    return NextResponse.json({ success: true, fallback: true });
  }

  try {
    const agent = await prisma.agent.findUnique({ where: { id: session.agentId } });
    if (!agent) {
      return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    }
    if (!agent.otpCode || !agent.otpExpiresAt) {
      return NextResponse.json({ error: 'Solicita un código primero.' }, { status: 400 });
    }
    if (agent.otpExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'El código expiró, solicita uno nuevo.' }, { status: 400 });
    }
    if (agent.otpCode !== parsed.data.code) {
      return NextResponse.json({ error: 'Código incorrecto.' }, { status: 400 });
    }

    await prisma.agent.update({
      where: { id: agent.id },
      data: { phoneVerifiedAt: new Date(), otpCode: null, otpExpiresAt: null },
    });

    await awardProfileComplete(session.agentId);

    return NextResponse.json({ success: true });
  } catch {
    const result = confirmPhoneOtp(session.agentId, parsed.data.code);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'No se pudo verificar el código.' }, { status: 400 });
    }
    return NextResponse.json({ success: true, fallback: true });
  }
}

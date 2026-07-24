import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';

const aliasSchema = z.object({
  rankingAlias: z.string().trim().max(40).optional(),
  useRankingAlias: z.boolean(),
});

// Solo permite que el propio agente actualice su alias de privacidad para el
// ranking publico - nunca otros campos del perfil (ver agents/[id] para eso, admin-only).
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados pueden configurar su alias.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = aliasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos.' }, { status: 400 });
  }

  if (shouldUseMockStore()) {
    return NextResponse.json({ success: true, fallback: true });
  }

  try {
    await prisma.agent.update({
      where: { id: session.agentId },
      data: { rankingAlias: parsed.data.rankingAlias || null, useRankingAlias: parsed.data.useRankingAlias },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el alias.' }, { status: 500 });
  }
}

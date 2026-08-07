import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAgentById, shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';
import { QUITO_ZONES } from '@/lib/real-estate/quito-zones';

const ZONE_KEYS = QUITO_ZONES.map((z) => z.key) as [string, ...string[]];

// Solo permite que el propio agente edite los datos de su Carnet de Agente
// (zonas de especializacion + mensaje de WhatsApp precargado en su QR) + su
// correo (solo si todavia no lo tiene registrado - nunca para reemplazar uno
// existente por este medio) - mismo patron restrictivo que points/alias:
// whitelist explicito, nunca un PATCH generico de todo el perfil.
const profileSchema = z.object({
  specializationZones: z.array(z.enum(ZONE_KEYS)).max(3, 'Máximo 3 zonas.').optional(),
  carnetMessage: z.string().trim().max(220, 'Máximo 220 caracteres.').optional(),
  email: z.string().trim().email('Ingresa un correo electrónico válido.').optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados pueden editar su carnet.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }, { status: 400 });
  }

  const data: { specializationZones?: string[]; carnetMessage?: string | null; email?: string } = {};
  if (parsed.data.specializationZones) data.specializationZones = parsed.data.specializationZones;
  if (parsed.data.carnetMessage !== undefined) data.carnetMessage = parsed.data.carnetMessage || null;

  if (parsed.data.email) {
    if (shouldUseMockStore()) {
      const current = findAgentById(session.agentId);
      if (current?.email) {
        return NextResponse.json({ error: 'Ya tienes un correo registrado.' }, { status: 400 });
      }
    } else {
      const current = await prisma.agent.findUnique({ where: { id: session.agentId }, select: { email: true } });
      if (current?.email) {
        return NextResponse.json({ error: 'Ya tienes un correo registrado.' }, { status: 400 });
      }
    }
    data.email = parsed.data.email;
  }

  if (shouldUseMockStore()) {
    updateAgent(session.agentId, data);
    return NextResponse.json({ success: true, fallback: true });
  }

  try {
    await prisma.agent.update({ where: { id: session.agentId }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ese correo ya está en uso por otra cuenta.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'No se pudo actualizar tu carnet.' }, { status: 500 });
  }
}

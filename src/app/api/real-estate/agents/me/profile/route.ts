import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';
import { QUITO_ZONES } from '@/lib/real-estate/quito-zones';

const ZONE_KEYS = QUITO_ZONES.map((z) => z.key) as [string, ...string[]];

// Solo permite que el propio agente edite los datos de su Carnet de Agente
// (zonas de especializacion + mensaje de WhatsApp precargado en su QR) -
// mismo patron restrictivo que points/alias: whitelist explicito, nunca un
// PATCH generico de todo el perfil.
const profileSchema = z.object({
  specializationZones: z.array(z.enum(ZONE_KEYS)).max(3, 'Máximo 3 zonas.').optional(),
  carnetMessage: z.string().trim().max(220, 'Máximo 220 caracteres.').optional(),
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

  const data: { specializationZones?: string[]; carnetMessage?: string | null } = {};
  if (parsed.data.specializationZones) data.specializationZones = parsed.data.specializationZones;
  if (parsed.data.carnetMessage !== undefined) data.carnetMessage = parsed.data.carnetMessage || null;

  if (shouldUseMockStore()) {
    updateAgent(session.agentId, data);
    return NextResponse.json({ success: true, fallback: true });
  }

  try {
    await prisma.agent.update({ where: { id: session.agentId }, data });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar tu carnet.' }, { status: 500 });
  }
}

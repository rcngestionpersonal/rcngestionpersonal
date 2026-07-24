import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deactivateAgent, sanitizeAgent, updateAgent } from '@/lib/real-estate/mock-store';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    let updated;
    try {
      updated = await prisma.agent.update({
        where: { id },
        data: body,
      });
    } catch {
      updated = updateAgent(id, body);
    }

    if (!updated) {
      return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ agent: sanitizeAgent(updated) });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el agente.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    try {
      await prisma.agent.update({
        where: { id },
        data: { isActive: false },
      });
    } catch {
      const ok = deactivateAgent(id);
      if (!ok) {
        return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo desactivar el agente.' }, { status: 500 });
  }
}

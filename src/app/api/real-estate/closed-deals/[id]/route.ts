import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteClosedDeal, findClosedDealById, shouldUseMockStore, updateClosedDeal } from '@/lib/real-estate/mock-store';
import { roundCoord, validateClosedDeal } from '@/lib/real-estate/closed-deals-config';

const editSchema = z.object({
  operationType: z.enum(['SALE', 'RENT', 'BOTH']).optional(),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM']).optional(),
  city: z.string().trim().min(2).optional(),
  zone: z.string().trim().optional(),
  sector: z.string().trim().optional(),
  microzona: z.string().trim().max(120).optional(),
  antiguedad: z.enum(['A_ESTRENAR', 'UNO_A_CINCO', 'SEIS_A_QUINCE', 'DIECISEIS_A_TREINTA', 'MAS_TREINTA']).optional(),
  estadoInmueble: z.enum(['EXCELENTE', 'BUENO', 'PARA_REMODELAR', 'OBRA_GRIS']).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  price: z.number().optional(),
  publicationPrice: z.number().positive().optional(),
  currency: z.string().trim().optional(),
  areaM2: z.number().optional(),
  landAreaM2: z.number().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  parkingSpaces: z.number().int().nonnegative().optional(),
  timeOnMarket: z.enum(['MENOS_1', 'UNO_A_TRES', 'TRES_A_SEIS', 'SEIS_A_DOCE', 'MAS_DOCE']).optional(),
  paymentMethod: z.enum(['CONTADO', 'CREDITO', 'MIXTO', 'OTRO']).optional(),
  financialEntity: z.string().trim().optional(),
  approvalDelayed: z.boolean().optional(),
  closedAt: z.string().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo el agente que creo este cierre puede editarlo.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos invalidos.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (typeof input.latitude === 'number') input.latitude = roundCoord(input.latitude);
  if (typeof input.longitude === 'number') input.longitude = roundCoord(input.longitude);

  if (input.price !== undefined || input.closedAt !== undefined || input.areaM2 !== undefined || input.landAreaM2 !== undefined) {
    const { errors } = validateClosedDeal({
      propertyType: input.propertyType ?? 'HOUSE',
      price: input.price ?? 1,
      publicationPrice: input.publicationPrice,
      areaM2: input.areaM2,
      landAreaM2: input.landAreaM2,
      closedAt: input.closedAt ?? new Date().toISOString(),
      details: input.details,
    });
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: 'Datos invalidos.', details: errors }, { status: 400 });
    }
  }

  const { closedAt, ...rest } = input;
  const patch = { ...rest, ...(closedAt ? { closedAt: new Date(closedAt) } : {}) };

  if (shouldUseMockStore()) {
    const existing = findClosedDealById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Registro no encontrado.' }, { status: 404 });
    }
    const updated = updateClosedDeal(id, session.agentId, { ...rest, ...(closedAt ? { closedAt } : {}) } as never);
    if (!updated) {
      return NextResponse.json({ error: 'Solo el agente que creo este cierre puede editarlo.' }, { status: 403 });
    }
    const safe: Record<string, unknown> = { ...updated };
    delete safe.createdByAgentId;
    return NextResponse.json({ deal: { ...safe, canEdit: true }, fallback: true });
  }

  try {
    const existing = await prisma.closedDeal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Registro no encontrado.' }, { status: 404 });
    }
    if (existing.createdByAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que creo este cierre puede editarlo.' }, { status: 403 });
    }

    const updated = await prisma.closedDeal.update({ where: { id }, data: patch as never });
    const safe: Record<string, unknown> = { ...updated };
    delete safe.createdByAgentId;
    return NextResponse.json({ deal: { ...safe, canEdit: true } });
  } catch {
    const updated = updateClosedDeal(id, session.agentId, { ...rest, ...(closedAt ? { closedAt } : {}) } as never);
    if (!updated) {
      return NextResponse.json({ error: 'No se pudo actualizar el registro.' }, { status: 500 });
    }
    const safe: Record<string, unknown> = { ...updated };
    delete safe.createdByAgentId;
    return NextResponse.json({ deal: { ...safe, canEdit: true }, fallback: true });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return NextResponse.json({ error: 'Solo el agente que creo este cierre puede eliminarlo.' }, { status: 403 });
  }

  if (shouldUseMockStore()) {
    const ok = deleteClosedDeal(id, session.agentId);
    if (!ok) {
      return NextResponse.json({ error: 'No se pudo eliminar (no existe o no te pertenece).' }, { status: 403 });
    }
    return NextResponse.json({ success: true, fallback: true });
  }

  try {
    const existing = await prisma.closedDeal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Registro no encontrado.' }, { status: 404 });
    }
    if (existing.createdByAgentId !== session.agentId) {
      return NextResponse.json({ error: 'Solo el agente que creo este cierre puede eliminarlo.' }, { status: 403 });
    }
    await prisma.closedDeal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    const ok = deleteClosedDeal(id, session.agentId);
    if (!ok) {
      return NextResponse.json({ error: 'No se pudo eliminar el registro.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, fallback: true });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAgentByPhone, findAgentById, shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';
import { QUITO_ZONES } from '@/lib/real-estate/quito-zones';
import { buildPhoneE164, isValidPhone } from '@/lib/real-estate/phone';

const ZONE_KEYS = QUITO_ZONES.map((z) => z.key) as [string, ...string[]];
const PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER'] as const;

// Whitelist explicito de lo que un agente puede editar de si mismo (Fase 7,
// seccion 3 - Editar Perfil). La cedula (idNumber) NUNCA se edita aqui: afecta
// la verificacion de identidad, se pide por soporte. El correo tampoco se
// escribe directo aqui salvo que el agente aun no tenga uno (primera vez); un
// cambio de correo YA existente pasa por /me/email-change, que requiere
// confirmar el nuevo antes de reemplazar el actual (seccion 3.4).
const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre es obligatorio.').max(120).optional(),
  photoUrl: z.string().trim().url().nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  zones: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  specialty: z.enum(['SALE', 'RENT', 'BOTH']).optional(),
  propertyTypesInterest: z.array(z.enum(PROPERTY_TYPES)).optional(),
  licenseNumber: z.string().trim().max(60).nullable().optional(),
  countryCode: z.string().trim().optional(),
  phoneLocal: z.string().trim().optional(),
  specializationZones: z.array(z.enum(ZONE_KEYS)).max(3, 'Máximo 3 zonas.').optional(),
  carnetMessage: z.string().trim().max(220, 'Máximo 220 caracteres.').optional(),
  email: z.string().trim().email('Ingresa un correo electrónico válido.').optional(),
  themePreference: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  yearsExperience: z.number().int().min(0, 'No puede ser negativo.').max(70, 'Revisa el valor.').nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.agentId) {
    return NextResponse.json({ error: 'Solo agentes autenticados pueden editar su perfil.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.fullName) data.fullName = parsed.data.fullName;
  if (parsed.data.photoUrl !== undefined) data.photoUrl = parsed.data.photoUrl;
  if (parsed.data.company !== undefined) data.company = parsed.data.company || null;
  if (parsed.data.zones) data.zones = parsed.data.zones;
  if (parsed.data.specialty) data.specialty = parsed.data.specialty;
  if (parsed.data.propertyTypesInterest) data.propertyTypesInterest = parsed.data.propertyTypesInterest;
  if (parsed.data.licenseNumber !== undefined) data.licenseNumber = parsed.data.licenseNumber || null;
  if (parsed.data.specializationZones) data.specializationZones = parsed.data.specializationZones;
  if (parsed.data.carnetMessage !== undefined) data.carnetMessage = parsed.data.carnetMessage || null;
  if (parsed.data.themePreference) data.themePreference = parsed.data.themePreference;
  if (parsed.data.yearsExperience !== undefined) data.yearsExperience = parsed.data.yearsExperience;

  // Telefono: mismo control unico (selector de pais + numero local) y misma
  // normalizacion que registro (seccion 3.3) - nunca se guarda lo que el
  // agente escribio sin limpiar.
  if (parsed.data.countryCode && parsed.data.phoneLocal !== undefined) {
    const phone = buildPhoneE164(parsed.data.countryCode, parsed.data.phoneLocal);
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: 'Ingresa un número de teléfono válido.' }, { status: 400 });
    }
    const currentPhone = shouldUseMockStore()
      ? findAgentById(session.agentId)?.phone
      : (await prisma.agent.findUnique({ where: { id: session.agentId }, select: { phone: true } }))?.phone;
    if (phone !== currentPhone) {
      const takenBy = shouldUseMockStore() ? findAgentByPhone(phone) : await prisma.agent.findUnique({ where: { phone } });
      if (takenBy && takenBy.id !== session.agentId) {
        return NextResponse.json({ error: 'Ese teléfono ya está en uso por otra cuenta.' }, { status: 409 });
      }
      data.phone = phone;
    }
  }

  if (parsed.data.email) {
    if (shouldUseMockStore()) {
      const current = findAgentById(session.agentId);
      if (current?.email) {
        return NextResponse.json({ error: 'Ya tienes un correo registrado. Para cambiarlo, usa "Cambiar correo".' }, { status: 400 });
      }
    } else {
      const current = await prisma.agent.findUnique({ where: { id: session.agentId }, select: { email: true } });
      if (current?.email) {
        return NextResponse.json({ error: 'Ya tienes un correo registrado. Para cambiarlo, usa "Cambiar correo".' }, { status: 400 });
      }
    }
    data.email = parsed.data.email;
  }

  if (shouldUseMockStore()) {
    const updated = updateAgent(session.agentId, data);
    return NextResponse.json({ success: true, fallback: true, agent: updated });
  }

  try {
    const updated = await prisma.agent.update({ where: { id: session.agentId }, data });
    return NextResponse.json({ success: true, agent: updated });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ese dato ya está en uso por otra cuenta.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'No se pudo actualizar tu perfil.' }, { status: 500 });
  }
}

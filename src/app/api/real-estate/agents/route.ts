import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionStatus } from '@prisma/client';
import { hashPassword } from '@/lib/auth';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAgent, listAgents, sanitizeAgent, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { TRIAL_DAYS } from '@/lib/real-estate/subscription-config';

// Direccion profesional y precio fundador: nunca visibles para otros agentes,
// solo para su propio dueno (via /me) o el admin (Fase 7, secciones 8.6 y
// 9.6 - el precio que paga cada agente es informacion de facturacion, igual
// de privada que su direccion). Esta lista la consultan tanto el admin
// (todos los agentes) como cualquier agente (sus colegas, para matching/red)
// con el mismo endpoint - se redacta aqui para todo caller que no sea admin,
// sin importar de que agente sea cada fila.
const ADDRESS_FIELDS = ['direccion', 'referenciaDireccion', 'ciudad', 'provincia', 'codigoPostal', 'precioFundadorBasico'] as const;
function redactAddressForNonAdmin<T extends Record<string, unknown>>(agent: T): T {
  const clone = { ...agent };
  for (const field of ADDRESS_FIELDS) delete clone[field];
  return clone;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const onlyActive = query.get('onlyActive') === 'true';
  const session = await getSessionFromRequest(request);
  const isAdmin = session?.role === 'admin';
  const redact = <T extends Record<string, unknown>>(list: T[]) => (isAdmin ? list : list.map(redactAddressForNonAdmin));

  if (shouldUseMockStore()) {
    return NextResponse.json({ agents: redact(listAgents(onlyActive).map(sanitizeAgent)), fallback: true });
  }

  try {
    const agents = await prisma.agent.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        matches: {
          take: 8,
          orderBy: { createdAt: 'desc' },
          include: { opportunity: true },
        },
      },
    });

    return NextResponse.json({ agents: redact(agents.map(sanitizeAgent)) });
  } catch {
    const agents = listAgents(onlyActive);
    return NextResponse.json({ agents: redact(agents.map(sanitizeAgent)), fallback: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      phone?: string;
      email?: string;
      password?: string;
      company?: string;
      zones?: string[];
      propertyTypesInterest?: string[];
      minBudget?: number;
      maxBudget?: number;
      specialty?: 'SALE' | 'RENT' | 'BOTH';
    };

    if (!body.fullName || !body.phone || !body.password) {
      return NextResponse.json({ error: 'fullName, phone y password son obligatorios.' }, { status: 400 });
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    if (shouldUseMockStore()) {
      const agent = await createAgent({
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        password: body.password,
        company: body.company,
        zones: body.zones,
        propertyTypesInterest: body.propertyTypesInterest,
        minBudget: body.minBudget,
        maxBudget: body.maxBudget,
        specialty: body.specialty,
      });
      return NextResponse.json({ agent: sanitizeAgent(agent), fallback: true }, { status: 201 });
    }

    try {
      const passwordHash = await hashPassword(body.password);
      const agent = await prisma.agent.create({
        data: {
          fullName: body.fullName,
          phone: body.phone,
          email: body.email,
          passwordHash,
          company: body.company,
          zones: body.zones ?? [],
          propertyTypesInterest: body.propertyTypesInterest as ('HOUSE' | 'APARTMENT' | 'SUITE' | 'OFFICE' | 'LAND' | 'COMMERCIAL' | 'WAREHOUSE' | 'FARM' | 'OTHER')[] | undefined,
          minBudget: body.minBudget,
          maxBudget: body.maxBudget,
          specialty: body.specialty ?? 'BOTH',
          trialEndsAt,
          subscriptionStatus: SubscriptionStatus.TRIAL,
        },
      });

      return NextResponse.json({ agent: sanitizeAgent(agent) }, { status: 201 });
    } catch {
      const agent = await createAgent({
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        password: body.password,
        company: body.company,
        zones: body.zones,
        propertyTypesInterest: body.propertyTypesInterest,
        minBudget: body.minBudget,
        maxBudget: body.maxBudget,
        specialty: body.specialty,
      });
      return NextResponse.json({ agent: sanitizeAgent(agent), fallback: true }, { status: 201 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creando agente.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

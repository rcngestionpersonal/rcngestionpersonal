import { PropertyType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bootstrapDemoAgents, DEMO_AGENT_PASSWORD, shouldUseMockStore } from '@/lib/real-estate/mock-store';

export async function POST() {
  if (shouldUseMockStore()) {
    const seededAgents = await bootstrapDemoAgents();
    return NextResponse.json({ success: true, seededAgents, fallback: true });
  }

  try {
    const agentsCount = await prisma.agent.count();

    if (agentsCount === 0) {
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const passwordHash = await hashPassword(DEMO_AGENT_PASSWORD);
      await prisma.agent.createMany({
        data: [
          {
            fullName: 'Sofia Paredes',
            phone: '+593998881111',
            email: 'sofia@brokerhub.ai',
            passwordHash,
            company: 'Andes Realty',
            zones: ['Quito', 'Cumbaya', 'Tumbaco'],
            propertyTypesInterest: [PropertyType.HOUSE, PropertyType.APARTMENT],
            minBudget: 70000,
            maxBudget: 250000,
            specialty: 'SALE',
            trialEndsAt,
          },
          {
            fullName: 'Carlos Mena',
            phone: '+593997772222',
            email: 'carlos@brokerhub.ai',
            passwordHash,
            company: 'Metro Brokers',
            zones: ['Guayaquil', 'Samborondon'],
            propertyTypesInterest: [PropertyType.OFFICE, PropertyType.COMMERCIAL],
            minBudget: 500,
            maxBudget: 2500,
            specialty: 'RENT',
            trialEndsAt,
          },
          {
            fullName: 'Valeria Alvarado',
            phone: '+593996663333',
            email: 'valeria@brokerhub.ai',
            passwordHash,
            company: 'Pacific Partners',
            zones: ['Cuenca', 'Quito'],
            propertyTypesInterest: [PropertyType.SUITE, PropertyType.APARTMENT, PropertyType.OTHER],
            minBudget: 40000,
            maxBudget: 180000,
            specialty: 'BOTH',
            trialEndsAt,
          },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      seededAgents: agentsCount === 0 ? 3 : 0,
    });
  } catch {
    const seededAgents = await bootstrapDemoAgents();
    return NextResponse.json({ success: true, seededAgents, fallback: true });
  }
}

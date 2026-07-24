import { SubscriptionStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword, normalizeTenant, SESSION_COOKIE_NAME, signSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildWelcomeEmail } from '@/lib/real-estate/email-templates';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { createAgent, findAgentById, findAgentByPhone, shouldUseMockStore } from '@/lib/real-estate/mock-store';
import { getAppUrl } from '@/lib/real-estate/paypal';
import { awardReferralSignup } from '@/lib/real-estate/points-log';

const TRIAL_DAYS = 7;

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre es obligatorio.'),
  phone: z.string().trim().min(6, 'El telefono es obligatorio.'),
  email: z.string().trim().email().optional(),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres.'),
  company: z.string().trim().optional(),
  idNumber: z.string().trim().min(5, 'La cedula o RUC es obligatoria.'),
  licenseNumber: z.string().trim().optional(),
  zones: z.array(z.string()).optional(),
  propertyTypesInterest: z.array(z.enum(['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER'])).optional(),
  specialty: z.enum(['SALE', 'RENT', 'BOTH']).optional(),
  referralCode: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos invalidos.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  try {
    let agentId: string;
    let company: string | null | undefined;

    if (shouldUseMockStore()) {
      const existing = findAgentByPhone(input.phone);
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un agente con ese teléfono.' }, { status: 409 });
      }

      const referrer = input.referralCode ? findAgentById(input.referralCode) : null;
      const agent = await createAgent({
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        password: input.password,
        company: input.company,
        idNumber: input.idNumber,
        licenseNumber: input.licenseNumber,
        zones: input.zones,
        propertyTypesInterest: input.propertyTypesInterest,
        specialty: input.specialty,
        referredByAgentId: referrer?.id,
      });
      agentId = agent.id;
      company = agent.company;
      if (referrer) await awardReferralSignup(referrer.id, agent.id);
    } else {
      const existing = await prisma.agent.findUnique({ where: { phone: input.phone } });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un agente con ese teléfono.' }, { status: 409 });
      }

      const referrer = input.referralCode
        ? await prisma.agent.findUnique({ where: { id: input.referralCode } })
        : null;

      const passwordHash = await hashPassword(input.password);
      const agent = await prisma.agent.create({
        data: {
          fullName: input.fullName,
          phone: input.phone,
          email: input.email,
          passwordHash,
          company: input.company,
          idNumber: input.idNumber,
          licenseNumber: input.licenseNumber,
          zones: input.zones ?? [],
          propertyTypesInterest: input.propertyTypesInterest,
          specialty: input.specialty ?? 'BOTH',
          trialEndsAt,
          subscriptionStatus: SubscriptionStatus.TRIAL,
          referredByAgentId: referrer?.id,
        },
      });
      agentId = agent.id;
      company = agent.company;
      if (referrer) await awardReferralSignup(referrer.id, agent.id);
    }

    if (input.email) {
      const welcome = buildWelcomeEmail(input.fullName, getAppUrl());
      void sendEmailNotification({ to: input.email, subject: welcome.subject, text: welcome.text });
    }

    const token = await signSession({
      role: 'agent',
      agentId,
      tenantId: normalizeTenant(company ?? process.env.TENANT_ID ?? 'brokerhub'),
    });

    const response = NextResponse.json({ success: true, role: 'agent', agentId }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar el agente.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

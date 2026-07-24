import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, normalizeTenant, signSession, verifyPassword } from '@/lib/auth';
import { listAgents, shouldUseMockStore } from '@/lib/real-estate/mock-store';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { phone?: string; password?: string };
    const phone = body.phone?.trim();
    const password = body.password;
    if (!phone || !password) {
      return NextResponse.json({ error: 'phone y password son obligatorios.' }, { status: 400 });
    }

    let agent: { id: string; phone: string; company?: string | null; passwordHash?: string | null } | null = null;

    if (shouldUseMockStore()) {
      const found = listAgents(false).find((a) => a.phone === phone);
      if (found) {
        agent = { id: found.id, phone: found.phone, company: found.company, passwordHash: found.passwordHash };
      }
    } else {
      try {
        const dbAgent = await prisma.agent.findUnique({ where: { phone } });
        if (dbAgent) {
          agent = { id: dbAgent.id, phone: dbAgent.phone, company: dbAgent.company, passwordHash: dbAgent.passwordHash };
        }
      } catch {
        const found = listAgents(false).find((a) => a.phone === phone);
        if (found) {
          agent = { id: found.id, phone: found.phone, company: found.company, passwordHash: found.passwordHash };
        }
      }
    }

    if (!agent || !(await verifyPassword(password, agent.passwordHash))) {
      return NextResponse.json({ error: 'Credenciales invalidas.' }, { status: 401 });
    }

    const token = await signSession({
      role: 'agent',
      agentId: agent.id,
      tenantId: normalizeTenant(agent.company ?? process.env.TENANT_ID ?? 'brokerhub'),
    });

    const response = NextResponse.json({ success: true, role: 'agent', agentId: agent.id });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'No se pudo iniciar sesion de agente.' }, { status: 500 });
  }
}

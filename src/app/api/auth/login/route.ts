import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, normalizeTenant, signSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@brokerhub.local').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin1234';

    if (!email || !password || email !== adminEmail || password !== adminPassword) {
      return NextResponse.json({ error: 'Credenciales invalidas.' }, { status: 401 });
    }

    const tenantId = normalizeTenant(process.env.TENANT_ID ?? 'brokerhub');
    const token = await signSession({ role: 'admin', email, tenantId });

    const response = NextResponse.json({ success: true, role: 'admin' });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'No se pudo iniciar sesion.' }, { status: 500 });
  }
}

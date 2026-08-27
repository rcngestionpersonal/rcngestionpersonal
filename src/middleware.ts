import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth';

function isPublicPath(pathname: string): boolean {
  if (pathname === '/login') return true;
  if (pathname === '/contacto') return true;
  if (pathname === '/agentes/registro') return true;
  if (pathname === '/agentes/recuperar-contrasena') return true;
  if (pathname === '/recuperar-acceso') return true;
  if (pathname === '/restablecer') return true;
  if (pathname === '/soporte') return true;
  if (pathname === '/politica-cancelacion') return true;
  if (pathname.startsWith('/v/')) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname === '/api/health') return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/api/real-estate/paypal/webhook')) return true;
  if (pathname.startsWith('/api/real-estate/leads/web-chat')) return true;
  if (pathname.startsWith('/api/real-estate/agents/register')) return true;
  // Protegido por su propio chequeo de CRON_SECRET, no por sesion de usuario.
  if (pathname.startsWith('/api/real-estate/cron/')) return true;
  return false;
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(token);

  if (!session) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/api/real-estate/')) {
    const method = request.method.toUpperCase();
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const allowAgentMutations =
      pathname.startsWith('/api/real-estate/opportunities/') ||
      pathname === '/api/real-estate/opportunities' ||
      pathname.startsWith('/api/real-estate/listings') ||
      pathname.startsWith('/api/real-estate/paypal/checkout') ||
      pathname.startsWith('/api/real-estate/paypal/confirm') ||
      pathname.startsWith('/api/real-estate/billing/') ||
      pathname.startsWith('/api/real-estate/closed-deals') ||
      pathname.startsWith('/api/real-estate/listing-matches') ||
      pathname.startsWith('/api/real-estate/agents/verify-phone') ||
      pathname.startsWith('/api/real-estate/agents/me') ||
      pathname.startsWith('/api/real-estate/points');

    if (isMutating && session.role !== 'admin' && !allowAgentMutations) {
      return NextResponse.json({ error: 'Permisos insuficientes.' }, { status: 403 });
    }
  }

  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)'],
};

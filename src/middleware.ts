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
  if (pathname.startsWith('/legal/')) return true;
  if (pathname.startsWith('/v/')) return true;
  // Mini-sitio publico del agente (Fase 3): sin sesion e indexable. Sus dos
  // endpoints tambien son publicos por definicion - los usa un visitante que
  // no tiene cuenta: el formulario de captacion y el registro de visitas.
  // Ambos validan por su cuenta que el sitio exista y este visible.
  if (pathname.startsWith('/a/')) return true;
  // Solo los dos endpoints que usa un VISITANTE sin cuenta. A proposito no se
  // abre todo /api/real-estate/mini-sitio/: bajo ese mismo prefijo vive /me,
  // que devuelve la configuracion y las metricas del agente y debe seguir
  // exigiendo sesion.
  if (/^\/api\/real-estate\/mini-sitio\/[^/]+\/(lead|visita)$/.test(pathname)) return true;
  // Firma de contratos: la persona que firma NO tiene cuenta. Su credencial
  // es el token del enlace que le llego por correo, que cada ruta valida por
  // su cuenta contra el hash guardado.
  if (pathname.startsWith('/firmar/')) return true;
  if (pathname.startsWith('/api/firma/')) return true;
  // Verificacion publica de un documento: solo existencia y estado, nunca
  // contenido.
  if (pathname.startsWith('/c/')) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname === '/api/health') return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/api/real-estate/paypal/webhook')) return true;
  if (pathname.startsWith('/api/real-estate/leads/web-chat')) return true;
  if (pathname.startsWith('/api/real-estate/agents/register')) return true;
  // El enlace de confirmacion viaja por correo - el agente puede abrirlo sin
  // sesion activa en ese navegador/dispositivo.
  if (pathname.startsWith('/api/real-estate/agents/me/email-change/confirm')) return true;
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
      // Configuracion del mini-sitio del agente (Fase 3). Sin esta linea el
      // panel de personalizacion carga (GET) pero NO guarda: el PATCH moria
      // en 403 y el agente veia que cambiar el color de acento no hacia nada.
      pathname === '/api/real-estate/mini-sitio/me' ||
      // Cartas de presentacion (Fase 4): crear, editar, regenerar un parrafo,
      // duplicar, borrar y enviar son todas acciones del propio agente.
      pathname.startsWith('/api/real-estate/cartas') ||
      // Contratos: crear, editar, enviar a firma, reenviar y anular son todas
      // acciones del propio agente sobre sus documentos.
      pathname.startsWith('/api/real-estate/contratos') ||
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

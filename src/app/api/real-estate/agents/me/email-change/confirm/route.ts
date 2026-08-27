import { NextRequest, NextResponse } from 'next/server';
import { confirmEmailChange } from '@/lib/real-estate/email-change';

// Enlace de correo -> confirma y redirige (mismo patron que /restablecer):
// no hace falta una pagina aparte, el propio GET aplica el cambio.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/?emailchange=invalid', request.url));
  }
  const result = await confirmEmailChange(token);
  if (!result.valid) {
    return NextResponse.redirect(new URL('/?emailchange=invalid', request.url));
  }
  return NextResponse.redirect(new URL('/?emailchange=ok', request.url));
}

import { NextResponse } from 'next/server';

// API de firma electrónica: RETIRADA el 2026-09-16.
//
// El módulo ya no firma. Registra aprobaciones de borrador (/api/aprobacion) y
// la firma es presencial y manuscrita. Esta ruta responde para que un enlace
// viejo que siga abierto en un navegador reciba una explicación y no un 404.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'La plataforma dejó de ofrecer firma electrónica. Contacte con quien le envió el documento para acordar cómo continuar.',
      code: 'firma_retirada',
    },
    { status: 410 },
  );
}

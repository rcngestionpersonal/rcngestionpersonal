import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { asuntoReporte, cuerpoHtmlReporte, cuerpoTextoReporte } from '@/lib/real-estate/reportes/correo';
import { gestionDelAgente, gestionImpresa } from '@/lib/real-estate/reportes/gestion';
import { reporteGestionPagina } from '@/lib/real-estate/reportes/gestion-plantilla';
import { A4, renderReporte } from '@/lib/real-estate/reportes/render';
import { agenteConReportes, encabezadoDelAgente, nombreArchivoReporte } from '@/lib/real-estate/reportes/servidor';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';

// Envio del reporte de gestion al propietario.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  para: z.string().trim().email('Correo del propietario no válido.'),
  mensaje: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  const g = await gestionDelAgente(id, auth.agentId);
  if (!g) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (!isEmailConfigured()) return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });

  const agente = await prisma.agent.findUnique({ where: { id: auth.agentId }, select: { fullName: true, email: true, company: true, phone: true } });
  if (!agente?.email) {
    return NextResponse.json({ error: 'Necesitas un correo en tu perfil para enviar reportes.', code: 'sin_correo' }, { status: 409 });
  }
  const encabezado = await encabezadoDelAgente(auth.agentId);
  if (!encabezado) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  const palette = FICHA_PALETTES[esPaleta(g.paleta) ? g.paleta : 'clara'];
  const render = await renderReporte(
    reporteGestionPagina({ encabezado, gestion: gestionImpresa(g), palette, width: A4.width, height: A4.height }),
    { formato: 'pdf', palette, titulo: 'Reporte de gestión - Redinmo.io' },
  );
  const nombreAdjunto = nombreArchivoReporte('Gestion', g.listing.title, g.periodoHasta, 'pdf');

  const datosCorreo = {
    agente: { nombre: agente.fullName, empresa: agente.company, telefono: agente.phone, correo: agente.email },
    tipo: 'de gestión',
    inmueble: g.listing.title,
    mensaje: parsed.data.mensaje ?? null,
    nombreAdjunto,
  };
  const resultado = await sendEmailNotification({
    to: parsed.data.para,
    subject: asuntoReporte(datosCorreo),
    text: cuerpoTextoReporte(datosCorreo),
    html: cuerpoHtmlReporte(datosCorreo),
    replyTo: agente.email,
    attachments: [{ filename: nombreAdjunto, content: render.buffer }],
  });
  if (!resultado.delivered) return NextResponse.json({ error: resultado.error ?? 'No se pudo enviar el correo.' }, { status: 502 });

  await prisma.reporteGestion.update({ where: { id }, data: { enviadoAt: new Date(), enviadoA: parsed.data.para } });
  return NextResponse.json({ ok: true });
}

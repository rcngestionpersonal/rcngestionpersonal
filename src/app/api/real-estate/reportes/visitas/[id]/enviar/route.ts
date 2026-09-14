import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { asuntoReporte, cuerpoHtmlReporte, cuerpoTextoReporte } from '@/lib/real-estate/reportes/correo';
import { A4, renderReporte } from '@/lib/real-estate/reportes/render';
import { agenteConReportes, faltaClaveDeCifrado, encabezadoDelAgente, nombreArchivoReporte } from '@/lib/real-estate/reportes/servidor';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';
import { reporteVisitaPagina } from '@/lib/real-estate/reportes/visita-plantilla';
import { visitaDelAgente, visitaImpresa } from '@/lib/real-estate/reportes/visitas';

// Envio del reporte de visita al propietario (punto 3.4). Igual que las
// cartas: sale por el dominio verificado, pero el "responder a" es el agente.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  para: z.string().trim().email('Correo del propietario no válido.'),
  mensaje: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const sinClave = faltaClaveDeCifrado();
  if (sinClave) return sinClave;
  const { id } = await params;

  const reporte = await visitaDelAgente(id, auth.agentId);
  if (!reporte) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });

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

  const palette = FICHA_PALETTES[esPaleta(reporte.paleta) ? reporte.paleta : 'clara'];
  const render = await renderReporte(
    reporteVisitaPagina({ encabezado, visita: await visitaImpresa(reporte), palette, width: A4.width, height: A4.height }),
    { formato: 'pdf', palette, titulo: 'Reporte de visita - Redinmo.io' },
  );
  const nombreAdjunto = nombreArchivoReporte('Visita', reporte.listing.title, reporte.visitadaAt, 'pdf');

  const datosCorreo = {
    agente: { nombre: agente.fullName, empresa: agente.company, telefono: agente.phone, correo: agente.email },
    tipo: 'de visita',
    inmueble: reporte.listing.title,
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
  if (!resultado.delivered) {
    return NextResponse.json({ error: resultado.error ?? 'No se pudo enviar el correo.' }, { status: 502 });
  }

  await prisma.reporteVisita.update({ where: { id }, data: { enviadoAt: new Date(), enviadoA: parsed.data.para } });
  return NextResponse.json({ ok: true });
}

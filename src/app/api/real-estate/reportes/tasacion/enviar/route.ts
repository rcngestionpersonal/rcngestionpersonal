import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { asuntoReporte, cuerpoHtmlReporte, cuerpoTextoReporte } from '@/lib/real-estate/reportes/correo';
import { A4, renderReporte } from '@/lib/real-estate/reportes/render';
import { agenteConReportes, encabezadoDelAgente, fechaImpresa, nombreArchivoReporte } from '@/lib/real-estate/reportes/servidor';
import { leerEntrada, prepararTasacion } from '@/lib/real-estate/reportes/tasacion';
import { reporteTasacionPagina } from '@/lib/real-estate/reportes/tasacion-plantilla';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';

// Envio del reporte de tasacion por correo. Misma salvaguarda que la descarga.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const envio = z.object({
  para: z.string().trim().email('Correo del propietario no válido.'),
  mensaje: z.string().trim().max(2000).optional(),
  paleta: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;

  const cuerpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!cuerpo) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const datosEnvio = envio.safeParse(cuerpo);
  const parsed = leerEntrada(cuerpo);
  if (!datosEnvio.success || !parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: datosEnvio.success ? undefined : datosEnvio.error.flatten().fieldErrors }, { status: 400 });
  }
  if (!isEmailConfigured()) return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });

  const r = await prepararTasacion(parsed.data, auth.agentId);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!r.resultado.disponible) return NextResponse.json({ error: r.resultado.mensaje, code: 'muestra_insuficiente' }, { status: 422 });

  const agente = await prisma.agent.findUnique({ where: { id: auth.agentId }, select: { fullName: true, email: true, company: true, phone: true } });
  if (!agente?.email) {
    return NextResponse.json({ error: 'Necesitas un correo en tu perfil para enviar reportes.', code: 'sin_correo' }, { status: 409 });
  }
  const encabezado = await encabezadoDelAgente(auth.agentId);
  if (!encabezado) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  const palette = FICHA_PALETTES[esPaleta(datosEnvio.data.paleta) ? datosEnvio.data.paleta : 'clara'];
  const render = await renderReporte(
    reporteTasacionPagina({ encabezado, datos: r.resultado.datos, emitidoEl: fechaImpresa(new Date()), palette, width: A4.width, height: A4.height }),
    { formato: 'pdf', palette, titulo: 'Reporte de tasación - Redinmo.io' },
  );
  const nombreAdjunto = nombreArchivoReporte('Tasacion', r.resultado.datos.inmueble.titulo, new Date(), 'pdf');
  const datosCorreo = {
    agente: { nombre: agente.fullName, empresa: agente.company, telefono: agente.phone, correo: agente.email },
    tipo: 'de tasación',
    inmueble: r.resultado.datos.inmueble.titulo,
    mensaje: datosEnvio.data.mensaje ?? null,
    nombreAdjunto,
  };
  const resultado = await sendEmailNotification({
    to: datosEnvio.data.para,
    subject: asuntoReporte(datosCorreo),
    text: cuerpoTextoReporte(datosCorreo),
    html: cuerpoHtmlReporte(datosCorreo),
    replyTo: agente.email,
    attachments: [{ filename: nombreAdjunto, content: render.buffer }],
  });
  if (!resultado.delivered) return NextResponse.json({ error: resultado.error ?? 'No se pudo enviar el correo.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}

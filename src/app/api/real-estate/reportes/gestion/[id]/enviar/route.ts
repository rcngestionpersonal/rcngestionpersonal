import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { nombreArchivoGestion } from '@/lib/real-estate/reportes/archivo';
import { correoGestion } from '@/lib/real-estate/reportes/correos/gestion';
import { documentoGuardado, guardarDocumento, limitePdfBytes } from '@/lib/real-estate/reportes/documento';
import { entregarReporte } from '@/lib/real-estate/reportes/entrega';
import { adjuntos, agenteParaCorreo, barrioDe, entregaParaCorreo, envioSchema, inmuebleParaCorreo, respuestaDeEntrega } from '@/lib/real-estate/reportes/envio';
import { gestionDelAgente, gestionImpresa } from '@/lib/real-estate/reportes/gestion';
import { reporteGestionPagina } from '@/lib/real-estate/reportes/gestion-plantilla';
import { A4, renderReporte } from '@/lib/real-estate/reportes/render';
import { agenteConReportes, encabezadoDelAgente } from '@/lib/real-estate/reportes/servidor';
import { esPaleta, type DatosGestion } from '@/lib/real-estate/reportes/tipos';

// Envio del reporte de gestion al propietario, con el PDF del periodo adjunto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  const g = await gestionDelAgente(id, auth.agentId);
  if (!g) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });

  const parsed = envioSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const envio = parsed.data;
  if (!isEmailConfigured()) return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });

  const remitente = await agenteParaCorreo(auth.agentId);
  if ('error' in remitente) return remitente.error;

  const listing = await prisma.listing.findUnique({ where: { id: g.listingId } });
  if (!listing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });

  const datos = g.datos as unknown as DatosGestion;
  const paleta = esPaleta(envio.paleta) ? envio.paleta : esPaleta(g.paleta) ? g.paleta : 'clara';

  const resultado = await entregarReporte({
    buscarGuardado: () => documentoGuardado('gestion', id),
    generarPdf: async () => {
      const encabezado = await encabezadoDelAgente(auth.agentId);
      if (!encabezado) throw new Error('agente sin encabezado');
      const palette = FICHA_PALETTES[paleta];
      const render = await renderReporte(
        reporteGestionPagina({ encabezado, gestion: gestionImpresa(g), palette, width: A4.width, height: A4.height }),
        { formato: 'pdf', palette, titulo: 'Reporte de gestión' },
      );
      return { buffer: render.buffer, paleta, nombreArchivo: nombreArchivoGestion(barrioDe(listing), g.periodoDesde, g.periodoHasta) };
    },
    guardar: (pdf) => guardarDocumento({ tipo: 'gestion', reporteId: id, agentId: auth.agentId, ...pdf }),
    enviar: (documento, modo) => {
      const correo = correoGestion({
        agente: remitente.agente,
        propietario: envio.nombreDestinatario ?? listing.ownerName,
        inmueble: inmuebleParaCorreo(listing),
        periodicidad: g.periodicidad === 'MENSUAL' ? 'MENSUAL' : 'SEMANAL',
        desde: g.periodoDesde,
        hasta: g.periodoHasta,
        visitas: datos.visitas.cantidad,
        consultas: datos.interesados.consultas,
        vistas: datos.actividad.visualizaciones,
        compradores: datos.actividad.matches,
        agendadas: datos.interesados.visitasAgendadas,
        enNegociacion: datos.interesados.enNegociacion,
        observaciones: g.observaciones,
        acumulado: datos.acumulado,
        mensaje: envio.mensaje,
        entrega: entregaParaCorreo(documento, modo),
      });
      return sendEmailNotification({
        to: envio.para,
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
        fromName: remitente.agente.nombre,
        replyTo: remitente.correo,
        attachments: adjuntos(documento, modo),
      });
    },
    limiteBytes: limitePdfBytes(),
    modo: envio.modo,
    registrarError: (m) => console.error(`[reportes] envio de gestion ${id}: ${m}`),
  });

  if (resultado.ok) {
    await prisma.reporteGestion.update({ where: { id }, data: { enviadoAt: new Date(), enviadoA: envio.para, paleta: resultado.documento.paleta } });
  }
  return respuestaDeEntrega(resultado);
}

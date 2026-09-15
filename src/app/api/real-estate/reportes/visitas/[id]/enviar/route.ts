import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { nombreArchivoVisita } from '@/lib/real-estate/reportes/archivo';
import { correoVisita } from '@/lib/real-estate/reportes/correos/visita';
import { documentoGuardado, guardarDocumento, limitePdfBytes } from '@/lib/real-estate/reportes/documento';
import { entregarReporte } from '@/lib/real-estate/reportes/entrega';
import { adjuntos, agenteParaCorreo, barrioDe, entregaParaCorreo, envioSchema, inmuebleParaCorreo, respuestaDeEntrega } from '@/lib/real-estate/reportes/envio';
import { A4, renderReporte } from '@/lib/real-estate/reportes/render';
import { agenteConReportes, encabezadoDelAgente, faltaClaveDeCifrado } from '@/lib/real-estate/reportes/servidor';
import { REACCIONES_VISITA, esPaleta, type ReaccionVisita } from '@/lib/real-estate/reportes/tipos';
import { reporteVisitaPagina } from '@/lib/real-estate/reportes/visita-plantilla';
import { visitaDelAgente, visitaImpresa, visitaParaAgente } from '@/lib/real-estate/reportes/visitas';

// Envio del reporte de visita al propietario (punto 3.4).
//
// Sale con el NOMBRE del agente como remitente y su correo como "responder a":
// el propietario le responde a el. El dominio verificado de Redinmo es solo el
// emisor tecnico. El PDF va siempre adjunto, y el primer envio lo congela.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const sinClave = faltaClaveDeCifrado();
  if (sinClave) return sinClave;
  const { id } = await params;

  const reporte = await visitaDelAgente(id, auth.agentId);
  if (!reporte) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });

  const parsed = envioSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const envio = parsed.data;
  if (!isEmailConfigured()) return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });

  const remitente = await agenteParaCorreo(auth.agentId);
  if ('error' in remitente) return remitente.error;

  const listing = await prisma.listing.findUnique({ where: { id: reporte.listingId } });
  if (!listing) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });

  const visita = visitaParaAgente(reporte);
  const paleta = esPaleta(envio.paleta) ? envio.paleta : esPaleta(reporte.paleta) ? reporte.paleta : 'clara';

  const resultado = await entregarReporte({
    buscarGuardado: () => documentoGuardado('visita', id),
    generarPdf: async () => {
      const encabezado = await encabezadoDelAgente(auth.agentId);
      if (!encabezado) throw new Error('agente sin encabezado');
      const palette = FICHA_PALETTES[paleta];
      const render = await renderReporte(
        reporteVisitaPagina({ encabezado, visita: await visitaImpresa(reporte), palette, width: A4.width, height: A4.height }),
        { formato: 'pdf', palette, titulo: 'Reporte de visita' },
      );
      return { buffer: render.buffer, paleta, nombreArchivo: nombreArchivoVisita(barrioDe(listing), reporte.visitadaAt) };
    },
    guardar: (pdf) => guardarDocumento({ tipo: 'visita', reporteId: id, agentId: auth.agentId, ...pdf }),
    enviar: (documento, modo) => {
      const correo = correoVisita({
        agente: remitente.agente,
        propietario: envio.nombreDestinatario ?? listing.ownerName,
        inmueble: inmuebleParaCorreo(listing),
        visitadaAt: reporte.visitadaAt,
        duracionMinutos: reporte.duracionMinutos,
        visitante: visita.visitanteNombre,
        acompanantes: visita.acompanantes,
        reaccion: (REACCIONES_VISITA as readonly string[]).includes(reporte.reaccion) ? (reporte.reaccion as ReaccionVisita) : 'INTERESADO_CON_REPAROS',
        observaciones: reporte.observaciones,
        objeciones: reporte.objeciones,
        proximoPaso: reporte.proximoPaso,
        mensaje: envio.mensaje,
        conFoto: Boolean(reporte.foto),
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
    registrarError: (m) => console.error(`[reportes] envio de visita ${id}: ${m}`),
  });

  if (resultado.ok) {
    await prisma.reporteVisita.update({ where: { id }, data: { enviadoAt: new Date(), enviadoA: envio.para, paleta: resultado.documento.paleta } });
  }
  return respuestaDeEntrega(resultado);
}

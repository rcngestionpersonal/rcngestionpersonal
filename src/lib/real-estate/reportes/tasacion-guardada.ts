import { NextResponse } from 'next/server';
import type { ReporteTasacion } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { nombreArchivoTasacion } from './archivo';
import { correoTasacion } from './correos/tasacion';
import { documentoGuardado, guardarDocumento, limitePdfBytes, type MetaDocumento } from './documento';
import { entregarReporte } from './entrega';
import { adjuntos, agenteParaCorreo, entregaParaCorreo, inmuebleParaCorreo, precioImpreso, respuestaDeEntrega, type Envio } from './envio';
import { A4, renderReporte } from './render';
import { encabezadoDelAgente, fechaImpresa, tipoImpreso } from './servidor';
import type { DatosTasacion, EntradaTasacion } from './tasacion-datos';
import { reporteTasacionPagina } from './tasacion-plantilla';
import { esPaleta } from './tipos';

// Tasacion enviada. La tasacion en vivo no se guarda; al enviarse por correo
// queda congelada con sus cifras y su PDF, para reenviarla identica.

export async function tasacionDelAgente(id: string, agentId: string) {
  const t = await prisma.reporteTasacion.findUnique({ where: { id } });
  if (!t || t.agentId !== agentId) return null;
  return t;
}

export function tasacionParaAgente(t: ReporteTasacion, documento: MetaDocumento | null) {
  const datos = t.datos as unknown as DatosTasacion;
  return {
    id: t.id,
    listingId: t.listingId,
    titulo: t.titulo,
    sector: t.sector,
    datos,
    paleta: t.paleta,
    enviadoAt: t.enviadoAt?.toISOString() ?? null,
    enviadoA: t.enviadoA,
    documento,
    createdAt: t.createdAt.toISOString(),
  };
}

function dinero(v: number): string {
  return `$${Math.round(v).toLocaleString('es-EC')}`;
}

export async function renderTasacionGuardada(t: ReporteTasacion, agentId: string, formato: 'pdf' | 'png', paleta: 'clara' | 'oscura') {
  const encabezado = await encabezadoDelAgente(agentId);
  if (!encabezado) throw new Error('agente sin encabezado');
  const palette = FICHA_PALETTES[paleta];
  return renderReporte(
    reporteTasacionPagina({ encabezado, datos: t.datos as unknown as DatosTasacion, emitidoEl: fechaImpresa(t.createdAt), palette, width: A4.width, height: A4.height }),
    { formato, palette, titulo: 'Reporte de tasación' },
  );
}

export async function enviarTasacionGuardada(t: ReporteTasacion, envio: Envio, agentId: string): Promise<NextResponse> {
  const remitente = await agenteParaCorreo(agentId);
  if ('error' in remitente) return remitente.error;

  const datos = t.datos as unknown as DatosTasacion;
  const entrada = t.entrada as unknown as EntradaTasacion;
  const listing = t.listingId ? await prisma.listing.findUnique({ where: { id: t.listingId } }) : null;
  const paleta = esPaleta(envio.paleta) ? envio.paleta : esPaleta(t.paleta) ? t.paleta : 'clara';

  const inmueble = listing
    ? inmuebleParaCorreo(listing, t.sector)
    : {
        fotoUrl: null,
        tipo: tipoImpreso(entrada.tipo),
        sector: t.sector,
        referencia: null,
        precio: entrada.precioActual ? precioImpreso(entrada.precioActual, 'USD', entrada.operacion) : null,
      };

  const resultado = await entregarReporte({
    buscarGuardado: () => documentoGuardado('tasacion', t.id),
    generarPdf: async () => {
      const render = await renderTasacionGuardada(t, agentId, 'pdf', paleta);
      return { buffer: render.buffer, paleta, nombreArchivo: nombreArchivoTasacion(t.sector, t.createdAt) };
    },
    guardar: (pdf) => guardarDocumento({ tipo: 'tasacion', reporteId: t.id, agentId, ...pdf }),
    enviar: (documento, modo) => {
      const correo = correoTasacion({
        agente: remitente.agente,
        propietario: envio.nombreDestinatario ?? listing?.ownerName ?? null,
        inmueble,
        emitidoAt: t.createdAt,
        minimo: dinero(datos.rango.minimo),
        central: dinero(datos.rango.central),
        maximo: dinero(datos.rango.maximo),
        conclusion: datos.conclusion,
        cierres: datos.cierres,
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
    registrarError: (m) => console.error(`[reportes] envio de tasacion ${t.id}: ${m}`),
  });

  if (resultado.ok) {
    await prisma.reporteTasacion.update({ where: { id: t.id }, data: { enviadoAt: new Date(), enviadoA: envio.para, paleta: resultado.documento.paleta } });
  }
  return respuestaDeEntrega(resultado, { tasacionId: t.id });
}

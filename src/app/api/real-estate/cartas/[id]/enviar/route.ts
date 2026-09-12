import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { agenteConCartas, bloquesDeCarta, cartaDelAgente, aplicarPreferenciaMiniSitio, construirEncabezado, nombreArchivoCarta } from '@/lib/real-estate/cartas/servidor';
import { cuerpoHtmlCarta, cuerpoTextoCarta } from '@/lib/real-estate/cartas/correo';
import { fechaLarga, renderCarta } from '@/lib/real-estate/cartas/render';
import { CARTA_DESTINATARIO_CONFIG, type CartaDestinatarioTipo, type CartaPaleta } from '@/lib/real-estate/cartas/tipos';

// Envio de la carta por correo (punto 5.1).
//
// Quien envia es EL AGENTE, no Redinmo (punto 7.2): salimos por el dominio
// verificado porque es el unico con reputacion para no caer en spam, pero el
// "responder a" es el correo del agente y el cuerpo lo deja explicito. El
// sistema es la herramienta, no el remitente comercial.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  para: z.string().trim().email('Correo del destinatario no válido.'),
  asunto: z.string().trim().min(3).max(160).optional(),
  mensaje: z.string().trim().max(4000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const carta = await cartaDelAgente(id, auth.agentId);
  if (!carta) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 });

  // Nada sale sin que el agente haya revisado y confirmado (punto 3.5).
  if (!carta.revisadaAt) {
    return NextResponse.json({ error: 'Revisa y confirma la carta antes de enviarla.', code: 'sin_revisar' }, { status: 409 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { para, asunto, mensaje } = parsed.data;

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });
  }

  const agente = await prisma.agent.findUnique({
    where: { id: auth.agentId },
    select: { fullName: true, email: true, company: true },
  });
  if (!agente?.email) {
    return NextResponse.json(
      { error: 'Necesitas un correo confirmado en tu perfil para enviar cartas.', code: 'sin_correo' },
      { status: 409 },
    );
  }

  const encabezadoBase = await construirEncabezado(auth.agentId, carta.imagenTipo);
  const encabezado = encabezadoBase ? aplicarPreferenciaMiniSitio(encabezadoBase, carta.incluirMiniSitio) : null;
  if (!encabezado) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  const bloques = bloquesDeCarta(carta.bloques);
  const pdf = await renderCarta({
    formato: 'pdf',
    paleta: carta.paleta as CartaPaleta,
    encabezado,
    destinatario: { nombre: carta.destinatarioNombre, cargo: carta.destinatarioCargo },
    bloques,
    fecha: fechaLarga(carta.createdAt),
  });

  const asuntoFinal = asunto || CARTA_DESTINATARIO_CONFIG[carta.destinatarioTipo as CartaDestinatarioTipo].asunto;

  // El enlace al perfil solo viaja si el mini-sitio esta publicado Y el agente
  // dejo el interruptor activo. Si falta cualquiera de las dos, no hay enlace:
  // ni boton, ni linea vacia, ni URL rota.
  const urlMiniSitio = carta.incluirMiniSitio ? encabezado.urlMiniSitioAbsoluta : null;
  const nombreAdjunto = nombreArchivoCarta(agente.fullName, carta.destinatarioNombre);

  // La carta va adjunta Y en el cuerpo (punto 5.1): mucha gente no abre
  // adjuntos de remitentes que no conoce, y el texto en el cuerpo hace que la
  // carta se lea igual.
  const datosCorreo = {
    agente: {
      nombre: agente.fullName,
      empresa: agente.company,
      telefono: encabezado.telefono,
      correo: agente.email,
      imagenUrl: encabezado.imagenUrl,
      verificado: encabezado.verificado,
    },
    destinatario: { nombre: carta.destinatarioNombre, cargo: carta.destinatarioCargo },
    bloques,
    mensaje: mensaje?.trim() || null,
    urlMiniSitio,
    nombreAdjunto,
  };

  // Multiparte: el HTML es lo que vera casi todo el mundo, el texto plano es el
  // respaldo y se sostiene solo.
  const resultado = await sendEmailNotification({
    to: para,
    subject: asuntoFinal,
    text: cuerpoTextoCarta(datosCorreo),
    html: cuerpoHtmlCarta(datosCorreo),
    replyTo: agente.email,
    attachments: [{ filename: nombreAdjunto, content: pdf.buffer }],
  });

  if (!resultado.delivered) {
    return NextResponse.json({ error: resultado.error ?? 'No se pudo enviar el correo.' }, { status: 502 });
  }

  const actualizada = await prisma.carta.update({
    where: { id },
    data: { estado: 'ENVIADA', enviadaAt: new Date(), enviadaA: para },
  });

  return NextResponse.json({ ok: true, carta: { ...actualizada, bloques } });
}

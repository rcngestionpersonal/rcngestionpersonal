import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConCartas, bloquesDeCarta, cartaDelAgente } from '@/lib/real-estate/cartas/servidor';
import { CARTA_BLOQUES, CARTA_IMAGEN_TIPOS, CARTA_PALETAS } from '@/lib/real-estate/cartas/tipos';

// Lectura, edicion y borrado de UNA carta. Siempre acotada al agente de la
// sesion: los datos del destinatario son de un tercero y no los ve nadie mas
// (punto 7.1).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bloquesSchema = z.object(
  Object.fromEntries(CARTA_BLOQUES.map((c) => [c, z.string().max(3000)])) as Record<
    (typeof CARTA_BLOQUES)[number],
    z.ZodString
  >,
);

const editarSchema = z.object({
  bloques: bloquesSchema.partial().optional(),
  paleta: z.enum(CARTA_PALETAS).optional(),
  imagenTipo: z.enum(CARTA_IMAGEN_TIPOS).optional(),
  // El agente confirma que reviso el texto. Es el requisito para descargar o
  // enviar (punto 3.5): sin esta marca las dos rutas devuelven 409.
  revisada: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const carta = await cartaDelAgente(id, auth.agentId);
  if (!carta) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 });

  return NextResponse.json({ carta: { ...carta, bloques: bloquesDeCarta(carta.bloques) } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const carta = await cartaDelAgente(id, auth.agentId);
  if (!carta) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 });

  const parsed = editarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const cambios = parsed.data;

  const data: Record<string, unknown> = {};
  if (cambios.bloques) {
    // Se mezcla sobre lo guardado: la pantalla edita un bloque a la vez y no
    // tiene por que reenviar los otros cinco.
    data.bloques = { ...bloquesDeCarta(carta.bloques), ...cambios.bloques };
  }
  if (cambios.paleta) data.paleta = cambios.paleta;
  if (cambios.imagenTipo) data.imagenTipo = cambios.imagenTipo;
  if (cambios.revisada === true) data.revisadaAt = new Date();
  // Editar despues de revisar invalida la revision: el agente tiene que volver
  // a confirmar lo que va a salir con su nombre.
  if (cambios.bloques && cambios.revisada !== true) data.revisadaAt = null;

  const actualizada = await prisma.carta.update({ where: { id }, data });

  if (cambios.imagenTipo) {
    await prisma.agent
      .update({ where: { id: auth.agentId }, data: { cartaImagenTipo: cambios.imagenTipo } })
      .catch(() => {});
  }

  return NextResponse.json({ carta: { ...actualizada, bloques: bloquesDeCarta(actualizada.bloques) } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const carta = await cartaDelAgente(id, auth.agentId);
  if (!carta) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 });

  await prisma.carta.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

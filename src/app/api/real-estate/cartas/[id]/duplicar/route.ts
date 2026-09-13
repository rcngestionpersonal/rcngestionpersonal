import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConCartas, bloquesDeCarta, cartaDelAgente } from '@/lib/real-estate/cartas/servidor';
import { aperturaDesdeContexto } from '@/lib/real-estate/cartas/generar';
import { resolverSaludo } from '@/lib/real-estate/cartas/saludo';

// Duplicar una carta para un destinatario nuevo (punto 6.2). NO llama al
// modelo: copia el texto que el agente ya trabajo y solo cambia a quien va
// dirigida, que es justo lo que ahorra tiempo en envios repetidos. Por eso
// tampoco consume cuota.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  destinatarioNombre: z.string().trim().min(2, 'El nombre del destinatario es obligatorio.').max(120),
  destinatarioCargo: z.string().trim().max(120).optional().nullable(),
  contexto: z.string().trim().max(240).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const original = await cartaDelAgente(id, auth.agentId);
  if (!original) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const entrada = parsed.data;

  const bloques = bloquesDeCarta(original.bloques);
  // El saludo nombra al destinatario anterior: se rehace para el nuevo con las
  // mismas reglas que al crear. La apertura retoma el contexto del destinatario
  // ANTERIOR ("tras nuestra conversacion en Guayaquil"), que al nuevo no le
  // corresponde: se arma desde su propio contexto, o se deja vacia.
  const bloquesNuevos = {
    ...bloques,
    saludo: resolverSaludo(entrada.destinatarioNombre, entrada.destinatarioCargo).texto,
    apertura: aperturaDesdeContexto(entrada.contexto),
  };

  const copia = await prisma.carta.create({
    data: {
      agentId: auth.agentId,
      destinatarioTipo: original.destinatarioTipo,
      destinatarioNombre: entrada.destinatarioNombre,
      destinatarioCargo: entrada.destinatarioCargo || null,
      contexto: entrada.contexto || null,
      bloques: bloquesNuevos,
      bloquesOriginales: original.bloquesOriginales ?? bloquesNuevos,
      datosUsados: original.datosUsados ?? {},
      imagenTipo: original.imagenTipo,
      paleta: original.paleta,
      incluirMiniSitio: original.incluirMiniSitio,
      // Nace como borrador SIN revisar: es una carta distinta, dirigida a otra
      // persona, y tiene que pasar otra vez por la revision (punto 3.5).
    },
  });

  return NextResponse.json({ carta: { ...copia, bloques: bloquesNuevos } });
}

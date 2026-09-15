import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured } from '@/lib/real-estate/email';
import { envioSchema } from '@/lib/real-estate/reportes/envio';
import { agenteConReportes } from '@/lib/real-estate/reportes/servidor';
import { leerEntrada, prepararTasacion } from '@/lib/real-estate/reportes/tasacion';
import { enviarTasacionGuardada } from '@/lib/real-estate/reportes/tasacion-guardada';

// Primer envio de una tasacion: se calcula con los cierres de hoy, se guarda y
// se envia. Los reenvios van por /tasacion/[id]/enviar con lo ya guardado.
// Con menos de 5 cierres no se guarda ni se envia nada (punto 1.2).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;

  const cuerpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!cuerpo) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const envio = envioSchema.safeParse(cuerpo);
  const parsed = leerEntrada(cuerpo);
  if (!envio.success || !parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: envio.success ? undefined : envio.error.flatten().fieldErrors }, { status: 400 });
  }
  if (!isEmailConfigured()) return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });

  const r = await prepararTasacion(parsed.data, auth.agentId);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!r.resultado.disponible) return NextResponse.json({ error: r.resultado.mensaje, code: 'muestra_insuficiente' }, { status: 422 });

  const fila = await prisma.reporteTasacion.create({
    data: {
      agentId: auth.agentId,
      listingId: parsed.data.listingId ?? null,
      titulo: r.resultado.datos.inmueble.titulo,
      sector: r.resultado.datos.inmueble.sector,
      entrada: r.entrada as unknown as object,
      datos: r.resultado.datos as unknown as object,
    },
  });

  const respuesta = await enviarTasacionGuardada(fila, envio.data, auth.agentId);
  // Solo queda en el historial una tasacion que efectivamente se envio. Si fallo
  // el PDF, el proveedor, o el adjunto supero el limite, la fila se borra: el
  // reintento (con adjunto o con enlace) crea una nueva y no deja una tasacion a
  // medias que parezca enviada.
  if (respuesta.status !== 200) await prisma.reporteTasacion.delete({ where: { id: fila.id } }).catch(() => {});
  return respuesta;
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FOTO_BYTES_MAXIMOS, esTipoDeFotoAceptado, prepararFoto } from '@/lib/real-estate/reportes/foto';
import { agenteConReportes, faltaClaveDeCifrado, inmuebleDelAgente } from '@/lib/real-estate/reportes/servidor';
import { validarConsentimientoFoto } from '@/lib/real-estate/reportes/tipos';
import { datosCifradosDeVisita, visitaDelAgente, visitaParaAgente, visitaSchema } from '@/lib/real-estate/reportes/visitas';

// Alta de un reporte de visita (punto 3). Llega como multipart: los datos en
// "datos" (JSON) y, si la hay, la foto en "foto". La foto ya viene comprimida
// desde el celular, asi que el cuerpo no se acerca al limite de 4.5MB de las
// funciones de Vercel.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const sinClave = faltaClaveDeCifrado();
  if (sinClave) return sinClave;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });

  let crudo: unknown = null;
  try {
    crudo = JSON.parse(String(form.get('datos') ?? ''));
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const parsed = visitaSchema.safeParse(crudo);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Revisa los datos de la visita.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const entrada = parsed.data;

  const inmueble = await inmuebleDelAgente(entrada.listingId, auth.agentId);
  if (!inmueble) return NextResponse.json({ error: 'Inmueble no encontrado.' }, { status: 404 });

  const archivo = form.get('foto');
  const foto = archivo instanceof File && archivo.size > 0 ? archivo : null;

  // La regla legal de la foto se decide en un solo lugar (tipos.ts), el mismo
  // que usa la pantalla. Una foto sin el primer consentimiento se RECHAZA: no
  // se guarda y el agente se entera.
  const consentimiento = validarConsentimientoFoto(Boolean(foto), {
    respaldo: entrada.consentimientoRespaldo,
    redes: entrada.consentimientoRedes,
  });
  if (!consentimiento.ok) {
    return NextResponse.json({ error: consentimiento.error, code: 'sin_consentimiento' }, { status: 400 });
  }

  let fotoPreparada: Awaited<ReturnType<typeof prepararFoto>> | null = null;
  if (foto && consentimiento.guardarFoto) {
    if (foto.size > FOTO_BYTES_MAXIMOS || !esTipoDeFotoAceptado(foto.type)) {
      return NextResponse.json({ error: 'La foto debe ser JPG, PNG o WEBP y pesar menos de 8 MB.' }, { status: 400 });
    }
    try {
      fotoPreparada = await prepararFoto(Buffer.from(await foto.arrayBuffer()));
    } catch {
      return NextResponse.json({ error: 'No se pudo leer la foto. Intenta tomarla de nuevo.' }, { status: 400 });
    }
  }

  const creado = await prisma.reporteVisita.create({
    data: {
      agentId: auth.agentId,
      listingId: inmueble.id,
      visitadaAt: new Date(entrada.visitadaAt),
      duracionMinutos: entrada.duracionMinutos ?? null,
      ...datosCifradosDeVisita(entrada),
      reaccion: entrada.reaccion,
      observaciones: entrada.observaciones,
      objeciones: entrada.objeciones,
      proximoPaso: entrada.proximoPaso,
      ...(fotoPreparada
        ? {
            foto: {
              create: {
                datosCifrados: fotoPreparada.cifrada,
                ancho: fotoPreparada.ancho,
                alto: fotoPreparada.alto,
                consentimientoRespaldo: true,
                consentimientoRedes: consentimiento.ok && consentimiento.redes,
              },
            },
          }
        : {}),
    },
  });

  const reporte = await visitaDelAgente(creado.id, auth.agentId);
  return NextResponse.json({ visita: reporte ? visitaParaAgente(reporte) : null }, { status: 201 });
}

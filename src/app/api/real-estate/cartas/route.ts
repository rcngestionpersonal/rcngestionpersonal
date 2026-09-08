import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConCartas } from '@/lib/real-estate/cartas/servidor';
import { recolectarDatosDeAgente, recolectarMuestrasDeEstilo } from '@/lib/real-estate/cartas/datos';
import { generarCarta } from '@/lib/real-estate/cartas/generar';
import { estadoDeCuota, quedaCuota, registrarGeneracion } from '@/lib/real-estate/cartas/cuota';
import { CARTA_DESTINATARIOS, CARTA_IMAGEN_TIPOS, CARTA_PALETAS, inventarioEsEscaso } from '@/lib/real-estate/cartas/tipos';
import type { CartaDestinatario } from '@prisma/client';

// Listado y creacion de cartas de presentacion (Fase 4).
// Node runtime: la generacion llama al proveedor del modelo.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const crearSchema = z.object({
  destinatarioTipo: z.enum(CARTA_DESTINATARIOS),
  destinatarioNombre: z.string().trim().min(2, 'El nombre del destinatario es obligatorio.').max(120),
  destinatarioCargo: z.string().trim().max(120).optional().nullable(),
  contexto: z.string().trim().max(240).optional().nullable(),
  imagenTipo: z.enum(CARTA_IMAGEN_TIPOS).default('foto'),
  paleta: z.enum(CARTA_PALETAS).default('clara'),
});

export async function GET(request: NextRequest) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const [cartas, cuota, datos, agente] = await Promise.all([
    prisma.carta.findMany({
      where: { agentId: auth.agentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        destinatarioTipo: true,
        destinatarioNombre: true,
        destinatarioCargo: true,
        estado: true,
        revisadaAt: true,
        enviadaAt: true,
        enviadaA: true,
        paleta: true,
        createdAt: true,
      },
    }),
    estadoDeCuota(auth.agentId),
    recolectarDatosDeAgente(auth.agentId),
    prisma.agent.findUnique({
      where: { id: auth.agentId },
      select: { cartaImagenTipo: true, cartaLogoUrl: true, photoUrl: true, email: true },
    }),
  ]);

  return NextResponse.json({
    cartas,
    cuota,
    datos,
    // El aviso del punto 2.3 se decide en el servidor con la misma funcion que
    // usa el prompt: la pantalla no puede discrepar de lo que el modelo vio.
    inventarioEscaso: datos ? inventarioEsEscaso(datos) : false,
    agente: {
      imagenTipoPreferida: agente?.cartaImagenTipo ?? 'foto',
      logoUrl: agente?.cartaLogoUrl ?? null,
      photoUrl: agente?.photoUrl ?? null,
      tieneCorreo: Boolean(agente?.email),
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const parsed = crearSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const entrada = parsed.data;

  if (!(await quedaCuota(auth.agentId))) {
    const cuota = await estadoDeCuota(auth.agentId);
    return NextResponse.json(
      { error: 'Llegaste al máximo de generaciones de este mes.', code: 'cuota_agotada', cuota },
      { status: 429 },
    );
  }

  const datos = await recolectarDatosDeAgente(auth.agentId);
  if (!datos) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  const muestrasDeEstilo = await recolectarMuestrasDeEstilo(auth.agentId).catch(() => []);

  const resultado = await generarCarta({
    datos,
    destinatarioTipo: entrada.destinatarioTipo,
    destinatarioNombre: entrada.destinatarioNombre,
    destinatarioCargo: entrada.destinatarioCargo,
    contexto: entrada.contexto,
    muestrasDeEstilo,
  });

  const carta = await prisma.carta.create({
    data: {
      agentId: auth.agentId,
      destinatarioTipo: entrada.destinatarioTipo as CartaDestinatario,
      destinatarioNombre: entrada.destinatarioNombre,
      destinatarioCargo: entrada.destinatarioCargo || null,
      contexto: entrada.contexto || null,
      bloques: resultado.bloques,
      bloquesOriginales: resultado.bloques,
      // Se congela la foto de los datos con los que se escribio: es la
      // evidencia de que la carta no afirmo nada que no fuera cierto ese dia.
      datosUsados: datos as unknown as object,
      imagenTipo: entrada.imagenTipo,
      paleta: entrada.paleta,
    },
  });

  // Si el texto salio de la plantilla local no hubo llamada al modelo, asi
  // que no se descuenta del tope mensual: la cuota mide gasto, no cartas.
  if (resultado.modelo) {
    await registrarGeneracion({
      agentId: auth.agentId,
      tipo: 'carta',
      cartaId: carta.id,
      modelo: resultado.modelo,
      tokensEntrada: resultado.tokensEntrada,
      tokensSalida: resultado.tokensSalida,
    });
  }

  // La preferencia de imagen se recuerda para la proxima carta (punto 1.4).
  await prisma.agent
    .update({ where: { id: auth.agentId }, data: { cartaImagenTipo: entrada.imagenTipo } })
    .catch(() => {});

  return NextResponse.json({
    carta: {
      id: carta.id,
      destinatarioTipo: carta.destinatarioTipo,
      destinatarioNombre: carta.destinatarioNombre,
      destinatarioCargo: carta.destinatarioCargo,
      contexto: carta.contexto,
      bloques: resultado.bloques,
      imagenTipo: carta.imagenTipo,
      paleta: carta.paleta,
      estado: carta.estado,
      revisadaAt: carta.revisadaAt,
      createdAt: carta.createdAt,
    },
    cuota: await estadoDeCuota(auth.agentId),
    inventarioEscaso: inventarioEsEscaso(datos),
    // Se le dice a la pantalla cuando el texto salio de la plantilla local
    // (sin proveedor configurado): el agente merece saber que ese borrador es
    // mas basico y conviene que lo trabaje.
    usoPlantilla: resultado.usoPlantilla,
  });
}

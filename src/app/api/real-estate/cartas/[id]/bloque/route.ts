import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { agenteConCartas, bloquesDeCarta, cartaDelAgente } from '@/lib/real-estate/cartas/servidor';
import { recolectarDatosDeAgente, recolectarMuestrasDeEstilo } from '@/lib/real-estate/cartas/datos';
import { regenerarBloque } from '@/lib/real-estate/cartas/generar';
import { estadoDeCuota, puedeRegenerar, registrarGeneracion } from '@/lib/real-estate/cartas/cuota';
import { CARTA_BLOQUES, type CartaDestinatarioTipo } from '@/lib/real-estate/cartas/tipos';
import { resolverSaludo } from '@/lib/real-estate/cartas/saludo';

// "Regenerar este párrafo" (punto 3.2): rehace UN bloque sin tocar los demas
// ni el trabajo de edicion que el agente ya hizo en ellos.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ bloque: z.enum(CARTA_BLOQUES) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const carta = await cartaDelAgente(id, auth.agentId);
  if (!carta) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bloque no válido.' }, { status: 400 });
  const { bloque } = parsed.data;

  // El saludo no pasa por el modelo: tiene reglas fijas (ver saludo.ts). No
  // consume freno ni se registra como generacion, porque no hubo llamada.
  if (bloque === 'saludo') {
    const saludo = resolverSaludo(carta.destinatarioNombre, carta.destinatarioCargo);
    const bloques = { ...bloquesDeCarta(carta.bloques), saludo: saludo.texto };
    const actualizada = await prisma.carta.update({ where: { id }, data: { bloques, revisadaAt: null } });
    return NextResponse.json({
      bloque,
      texto: saludo.texto,
      carta: { ...actualizada, bloques: bloquesDeCarta(actualizada.bloques) },
      cuota: await estadoDeCuota(auth.agentId),
    });
  }
  if (bloque === 'apertura' && !carta.contexto?.trim()) {
    return NextResponse.json(
      { error: 'Esta carta no tiene contexto, así que no lleva párrafo de apertura.', cuota: await estadoDeCuota(auth.agentId) },
      { status: 400 },
    );
  }

  // A proposito NO se consulta la cuota: el tope mensual es de cartas nuevas,
  // no de retoques (ver CARTA_LIMITE_MENSUAL). Un agente con el tope agotado
  // sigue puliendo, descargando y enviando lo que ya genero.
  //
  // Lo que si hay es un freno de seguridad por carta y por hora. No limita el
  // uso legitimo: existe para que un bucle en la pantalla o un clic pegado no
  // dispare cientos de llamadas sin que nadie lo note.
  const freno = await puedeRegenerar(carta.id);
  if (!freno.permitido) {
    console.error(`[cartas] freno de regeneracion | carta=${carta.id} | ${freno.usadas} en la ultima hora`);
    return NextResponse.json(
      {
        error: 'Has regenerado esta carta muchas veces seguidas. Espera unos minutos y vuelve a intentarlo.',
        code: 'demasiadas_regeneraciones',
        cuota: await estadoDeCuota(auth.agentId),
      },
      { status: 429 },
    );
  }

  // Se regenera con los datos de HOY, no con los congelados de datosUsados:
  // si el agente cargo inmuebles desde que creo la carta, el parrafo nuevo
  // tiene que poder reflejarlo.
  const datos = await recolectarDatosDeAgente(auth.agentId);
  if (!datos) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  const bloquesActuales = bloquesDeCarta(carta.bloques);
  const muestrasDeEstilo = await recolectarMuestrasDeEstilo(auth.agentId).catch(() => []);

  // La misma condicion que al crear la carta. Si no se recalculara aqui, un
  // parrafo rehecho perderia el permiso de invitar al perfil y la carta
  // quedaria con la mitad de los bloques hablando del perfil y la otra no.
  const miniSitio = await prisma.miniSitio.findUnique({
    where: { agentId: auth.agentId },
    select: { activo: true },
  });

  const resultado = await regenerarBloque({
    datos,
    destinatarioTipo: carta.destinatarioTipo as CartaDestinatarioTipo,
    destinatarioNombre: carta.destinatarioNombre,
    destinatarioCargo: carta.destinatarioCargo,
    contexto: carta.contexto,
    muestrasDeEstilo,
    bloque,
    bloquesActuales,
    conPerfilPublico: Boolean(miniSitio?.activo) && carta.incluirMiniSitio,
  });

  // Sin proveedor no se cobra cuota ni se registra consumo: no hubo llamada.
  if (resultado.sinProveedor) {
    return NextResponse.json(
      {
        error: 'La regeneración de párrafos necesita el generador de texto configurado. Puedes editar el párrafo a mano.',
        code: 'sin_proveedor',
        cuota: await estadoDeCuota(auth.agentId),
      },
      { status: 503 },
    );
  }

  await registrarGeneracion({
    agentId: auth.agentId,
    tipo: 'bloque',
    cartaId: carta.id,
    modelo: resultado.modelo,
    tokensEntrada: resultado.tokensEntrada,
    tokensSalida: resultado.tokensSalida,
  });

  // La auditoria rechazo lo que propuso el modelo, dos veces. El agente conserva
  // su parrafo: mejor el que tenia que uno que afirma algo que no es cierto.
  if (resultado.rechazado) {
    return NextResponse.json(
      {
        error: 'El párrafo propuesto afirmaba datos que no están en tu perfil, así que no se aplicó. Intenta de nuevo o edítalo a mano.',
        code: 'rechazado_por_auditoria',
        cuota: await estadoDeCuota(auth.agentId),
      },
      { status: 422 },
    );
  }

  if (!resultado.texto) {
    return NextResponse.json(
      { error: 'No se pudo regenerar el párrafo. Intenta de nuevo.', cuota: await estadoDeCuota(auth.agentId) },
      { status: 502 },
    );
  }

  const bloques = { ...bloquesActuales, [bloque]: resultado.texto };
  // Cambia el texto, cae la revision: el agente tiene que volver a leer lo
  // que va a salir con su nombre (punto 3.5).
  const actualizada = await prisma.carta.update({ where: { id }, data: { bloques, revisadaAt: null } });

  return NextResponse.json({
    bloque,
    texto: resultado.texto,
    carta: { ...actualizada, bloques: bloquesDeCarta(actualizada.bloques) },
    cuota: await estadoDeCuota(auth.agentId),
  });
}

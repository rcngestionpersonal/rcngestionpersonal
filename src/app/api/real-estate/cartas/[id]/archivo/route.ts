import { NextRequest, NextResponse } from 'next/server';
import { agenteConCartas, bloquesDeCarta, cartaDelAgente, aplicarPreferenciaMiniSitio, construirEncabezado, nombreArchivoCarta } from '@/lib/real-estate/cartas/servidor';
import { fechaLarga, renderCarta, type CartaFormato } from '@/lib/real-estate/cartas/render';
import { CARTA_PALETAS, type CartaPaleta } from '@/lib/real-estate/cartas/tipos';

// Genera y sirve el PDF/PNG de la carta. Node runtime: usa las fuentes
// embebidas y los binarios nativos de sharp/@resvg/resvg-js, igual que la
// ficha (ver outputFileTracingIncludes en next.config.js).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vista previa en vivo mientras el agente edita (punto 3.4). Es el MISMO
// render que la descarga, no una aproximacion en HTML: lo que ve es
// exactamente lo que va a bajar.
const FORMATOS: CartaFormato[] = ['pdf', 'png'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConCartas(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const carta = await cartaDelAgente(id, auth.agentId);
  if (!carta) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 });

  const url = new URL(request.url);
  const formato = (url.searchParams.get('formato') ?? 'pdf') as CartaFormato;
  const paletaParam = url.searchParams.get('paleta');
  const paleta = (CARTA_PALETAS as readonly string[]).includes(paletaParam ?? '')
    ? (paletaParam as CartaPaleta)
    : (carta.paleta as CartaPaleta);
  if (!FORMATOS.includes(formato)) return NextResponse.json({ error: 'Formato no válido.' }, { status: 400 });

  // "previa=1" es la vista previa en vivo del editor y NO exige revision: es
  // justamente la pantalla donde el agente revisa. Cualquier otra salida
  // (la descarga real) si la exige (punto 3.5).
  const esPrevia = url.searchParams.get('previa') === '1';
  if (!esPrevia && !carta.revisadaAt) {
    return NextResponse.json(
      { error: 'Revisa y confirma la carta antes de descargarla.', code: 'sin_revisar' },
      { status: 409 },
    );
  }

  const encabezadoBase = await construirEncabezado(auth.agentId, carta.imagenTipo);
  const encabezado = encabezadoBase ? aplicarPreferenciaMiniSitio(encabezadoBase, carta.incluirMiniSitio) : null;
  if (!encabezado) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  const render = await renderCarta({
    formato,
    paleta,
    encabezado,
    destinatario: { nombre: carta.destinatarioNombre, cargo: carta.destinatarioCargo },
    bloques: bloquesDeCarta(carta.bloques),
    fecha: fechaLarga(carta.createdAt),
  });

  return new NextResponse(new Uint8Array(render.buffer), {
    headers: {
      'Content-Type': render.contentType,
      'Content-Disposition': `${esPrevia ? 'inline' : 'attachment'}; filename="${nombreArchivoCarta(encabezado.nombre, carta.destinatarioNombre, render.extension)}"`,
      'Cache-Control': 'no-store',
    },
  });
}

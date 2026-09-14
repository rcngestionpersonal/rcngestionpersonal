import { NextRequest, NextResponse } from 'next/server';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { A4, renderReporte } from '@/lib/real-estate/reportes/render';
import { agenteConReportes, encabezadoDelAgente, fechaImpresa, nombreArchivoReporte } from '@/lib/real-estate/reportes/servidor';
import { leerEntrada, prepararTasacion } from '@/lib/real-estate/reportes/tasacion';
import { reporteTasacionPagina } from '@/lib/real-estate/reportes/tasacion-plantilla';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';

// Descarga del reporte de tasacion. Con menos de 5 cierres en el sector NO se
// genera ningun archivo (punto 1.2): la ruta responde 422 con el mensaje, aunque
// alguien arme la URL a mano.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;

  const q = request.nextUrl.searchParams;
  const parsed = leerEntrada(Object.fromEntries(q));
  if (!parsed.success) return NextResponse.json({ error: 'Datos del inmueble incompletos.' }, { status: 400 });

  const r = await prepararTasacion(parsed.data, auth.agentId);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!r.resultado.disponible) {
    return NextResponse.json({ error: r.resultado.mensaje, code: 'muestra_insuficiente', cierres: r.resultado.cierres }, { status: 422 });
  }

  const formato = q.get('formato') === 'png' ? 'png' : 'pdf';
  const pedida = q.get('paleta');
  const paleta = esPaleta(pedida) ? pedida : 'clara';
  const encabezado = await encabezadoDelAgente(auth.agentId);
  if (!encabezado) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  try {
    const palette = FICHA_PALETTES[paleta];
    const node = reporteTasacionPagina({ encabezado, datos: r.resultado.datos, emitidoEl: fechaImpresa(new Date()), palette, width: A4.width, height: A4.height });
    const render = await renderReporte(node, { formato, palette, titulo: 'Reporte de tasación - Redinmo.io' });
    const nombre = nombreArchivoReporte('Tasacion', r.resultado.datos.inmueble.titulo, new Date(), render.extension);
    return new NextResponse(new Uint8Array(render.buffer), {
      headers: {
        'Content-Type': render.contentType,
        'Content-Disposition': `${q.get('previa') === '1' ? 'inline' : 'attachment'}; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[reportes] fallo el render de tasacion', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo generar el reporte.', code: 'render_failed' }, { status: 500 });
  }
}

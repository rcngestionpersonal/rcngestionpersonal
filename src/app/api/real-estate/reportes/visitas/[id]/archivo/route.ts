import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { A4, renderReporte } from '@/lib/real-estate/reportes/render';
import { agenteConReportes, faltaClaveDeCifrado, encabezadoDelAgente, nombreArchivoReporte } from '@/lib/real-estate/reportes/servidor';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';
import { reporteVisitaPagina } from '@/lib/real-estate/reportes/visita-plantilla';
import { visitaDelAgente, visitaImpresa } from '@/lib/real-estate/reportes/visitas';

// Descarga del reporte de visita en PDF o PNG (punto 0.4).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const sinClave = faltaClaveDeCifrado();
  if (sinClave) return sinClave;
  const { id } = await params;

  const reporte = await visitaDelAgente(id, auth.agentId);
  if (!reporte) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });

  const q = request.nextUrl.searchParams;
  const formato = q.get('formato') === 'png' ? 'png' : 'pdf';
  const paletaPedida = q.get('paleta');
  const paleta = esPaleta(paletaPedida) ? paletaPedida : esPaleta(reporte.paleta) ? reporte.paleta : 'clara';
  const previa = q.get('previa') === '1';

  const encabezado = await encabezadoDelAgente(auth.agentId);
  if (!encabezado) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });

  // La paleta elegida se recuerda en el reporte: el envio por correo sale igual
  // que lo que el agente vio.
  if (paleta !== reporte.paleta) {
    await prisma.reporteVisita.update({ where: { id }, data: { paleta } }).catch(() => {});
  }

  try {
    const palette = FICHA_PALETTES[paleta];
    const node = reporteVisitaPagina({ encabezado, visita: await visitaImpresa(reporte), palette, width: A4.width, height: A4.height });
    const render = await renderReporte(node, { formato, palette, titulo: 'Reporte de visita - Redinmo.io' });
    const nombre = nombreArchivoReporte('Visita', reporte.listing.title, reporte.visitadaAt, render.extension);
    return new NextResponse(new Uint8Array(render.buffer), {
      headers: {
        'Content-Type': render.contentType,
        'Content-Disposition': `${previa ? 'inline' : 'attachment'}; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[reportes] fallo el render de la visita', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo generar el reporte.', code: 'render_failed' }, { status: 500 });
  }
}

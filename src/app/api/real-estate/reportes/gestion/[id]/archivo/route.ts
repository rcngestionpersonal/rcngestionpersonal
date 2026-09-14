import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FICHA_PALETTES } from '@/lib/real-estate/ficha/palettes';
import { gestionDelAgente, gestionImpresa } from '@/lib/real-estate/reportes/gestion';
import { reporteGestionPagina } from '@/lib/real-estate/reportes/gestion-plantilla';
import { A4, renderReporte } from '@/lib/real-estate/reportes/render';
import { agenteConReportes, encabezadoDelAgente, nombreArchivoReporte } from '@/lib/real-estate/reportes/servidor';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';

// Descarga del reporte de gestion en PDF o PNG.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  const g = await gestionDelAgente(id, auth.agentId);
  if (!g) return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });

  const q = request.nextUrl.searchParams;
  const formato = q.get('formato') === 'png' ? 'png' : 'pdf';
  const pedida = q.get('paleta');
  const paleta = esPaleta(pedida) ? pedida : esPaleta(g.paleta) ? g.paleta : 'clara';
  const previa = q.get('previa') === '1';

  const encabezado = await encabezadoDelAgente(auth.agentId);
  if (!encabezado) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
  if (paleta !== g.paleta) await prisma.reporteGestion.update({ where: { id }, data: { paleta } }).catch(() => {});

  try {
    const palette = FICHA_PALETTES[paleta];
    const node = reporteGestionPagina({ encabezado, gestion: gestionImpresa(g), palette, width: A4.width, height: A4.height });
    const render = await renderReporte(node, { formato, palette, titulo: 'Reporte de gestión - Redinmo.io' });
    const nombre = nombreArchivoReporte('Gestion', g.listing.title, g.periodoHasta, render.extension);
    return new NextResponse(new Uint8Array(render.buffer), {
      headers: {
        'Content-Type': render.contentType,
        'Content-Disposition': `${previa ? 'inline' : 'attachment'}; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[reportes] fallo el render de gestion', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo generar el reporte.', code: 'render_failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { nombreArchivoTasacion } from '@/lib/real-estate/reportes/archivo';
import { documentoGuardado } from '@/lib/real-estate/reportes/documento';
import { agenteConReportes } from '@/lib/real-estate/reportes/servidor';
import { renderTasacionGuardada, tasacionDelAgente } from '@/lib/real-estate/reportes/tasacion-guardada';
import { esPaleta } from '@/lib/real-estate/reportes/tipos';

// Descarga de una tasacion ya enviada. El PDF es el del envio; el PNG se dibuja
// con las cifras guardadas, nunca con las de hoy.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConReportes(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  const t = await tasacionDelAgente(id, auth.agentId);
  if (!t) return NextResponse.json({ error: 'Tasación no encontrada.' }, { status: 404 });

  const q = request.nextUrl.searchParams;
  const formato = q.get('formato') === 'png' ? 'png' : 'pdf';
  const disposicion = q.get('previa') === '1' ? 'inline' : 'attachment';

  if (formato === 'pdf') {
    const guardado = await documentoGuardado('tasacion', id);
    if (guardado) {
      return new NextResponse(new Uint8Array(guardado.buffer), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${disposicion}; filename="${guardado.nombreArchivo}"`, 'Cache-Control': 'private, no-store' },
      });
    }
  }

  const pedida = q.get('paleta');
  const paleta = esPaleta(pedida) ? pedida : esPaleta(t.paleta) ? t.paleta : 'clara';
  try {
    const render = await renderTasacionGuardada(t, auth.agentId, formato, paleta);
    return new NextResponse(new Uint8Array(render.buffer), {
      headers: {
        'Content-Type': render.contentType,
        'Content-Disposition': `${disposicion}; filename="${nombreArchivoTasacion(t.sector, t.createdAt, render.extension)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[reportes] fallo el render de una tasacion guardada', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo generar el reporte.', code: 'render_failed' }, { status: 500 });
  }
}

import type { DocumentoPdf, MetaDocumento } from './documento';

// Entrega de un reporte por correo: el orden de los pasos es la regla.
//
//   1. El PDF que se envia es el guardado. Si no hay, se genera y se guarda
//      ANTES de enviar: el primer envio lo congela.
//   2. Si generar o guardar falla, el correo NO sale (punto 5.1). Mejor que el
//      agente reintente a que el propietario reciba un correo sin su documento.
//   3. Si el PDF supera el limite, NO se envia sin adjunto en silencio (punto
//      4.3): se avisa y se ofrece mandar un enlace de descarga.
//
// Las dependencias entran por parametro para poder probar cada falla sin base
// de datos ni proveedor de correo.

export type ModoEntrega = 'adjunto' | 'enlace';

export type ResultadoEntrega =
  | { ok: true; documento: MetaDocumento; modo: ModoEntrega; reenvio: boolean }
  | { ok: false; status: number; code: 'pdf_fallido' | 'pdf_muy_grande' | 'envio_fallido'; error: string; bytes?: number };

export type DependenciasEntrega = {
  buscarGuardado: () => Promise<DocumentoPdf | null>;
  generarPdf: () => Promise<{ buffer: Buffer; paleta: string; nombreArchivo: string }>;
  guardar: (pdf: { buffer: Buffer; paleta: string; nombreArchivo: string }) => Promise<DocumentoPdf>;
  enviar: (documento: DocumentoPdf, modo: ModoEntrega) => Promise<{ delivered: boolean; error?: string }>;
  limiteBytes: number;
  modo: ModoEntrega;
  registrarError: (mensaje: string) => void;
};

// "2 MB", "2,4 MB": sin decimal cuando es redondo.
function mb(bytes: number): string {
  const valor = bytes / (1024 * 1024);
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace('.', ',');
}

export function meta(d: DocumentoPdf): MetaDocumento {
  return { nombreArchivo: d.nombreArchivo, paleta: d.paleta, bytes: d.bytes, creadoAt: d.createdAt.toISOString() };
}

export async function entregarReporte(deps: DependenciasEntrega): Promise<ResultadoEntrega> {
  let documento = await deps.buscarGuardado();
  const reenvio = Boolean(documento);

  if (!documento) {
    try {
      const pdf = await deps.generarPdf();
      documento = await deps.guardar(pdf);
    } catch (error) {
      deps.registrarError(`no se pudo generar o guardar el PDF: ${error instanceof Error ? error.message : String(error)}`);
      return {
        ok: false,
        status: 500,
        code: 'pdf_fallido',
        error: 'No se pudo generar el PDF del reporte, así que el correo no se envió. Intenta de nuevo en un momento.',
      };
    }
  }

  if (documento.bytes > deps.limiteBytes && deps.modo === 'adjunto') {
    deps.registrarError(`PDF de ${documento.bytes} bytes supera el limite de ${deps.limiteBytes}: no se envio`);
    return {
      ok: false,
      status: 413,
      code: 'pdf_muy_grande',
      bytes: documento.bytes,
      error: `El PDF pesa ${mb(documento.bytes)} MB y muchos correos rechazan adjuntos de más de ${mb(deps.limiteBytes)} MB, así que no se envió. Puedes enviar un enlace de descarga en su lugar.`,
    };
  }

  const envio = await deps.enviar(documento, deps.modo);
  if (!envio.delivered) {
    deps.registrarError(`el proveedor de correo rechazo el envio: ${envio.error ?? 'sin detalle'}`);
    return { ok: false, status: 502, code: 'envio_fallido', error: 'No se pudo enviar el correo. Intenta de nuevo.' };
  }

  return { ok: true, documento: meta(documento), modo: deps.modo, reenvio };
}

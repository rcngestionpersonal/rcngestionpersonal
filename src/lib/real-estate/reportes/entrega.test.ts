import { describe, expect, it, vi } from 'vitest';
import { nombreArchivoGestion, nombreArchivoTasacion, nombreArchivoVisita } from './archivo';
import type { DocumentoPdf } from './documento';
import { entregarReporte, type DependenciasEntrega } from './entrega';

function doc(bytes: number, id = 'doc1'): DocumentoPdf {
  return { id, buffer: Buffer.alloc(bytes, 1), nombreArchivo: 'Visita-La-Carolina-2026-09-12.pdf', paleta: 'clara', bytes, createdAt: new Date('2026-09-12T15:00:00Z') };
}

function deps(parcial: Partial<DependenciasEntrega>): DependenciasEntrega {
  return {
    buscarGuardado: async () => null,
    generarPdf: async () => ({ buffer: Buffer.alloc(1000), paleta: 'clara', nombreArchivo: 'x.pdf' }),
    guardar: async (pdf) => doc(pdf.buffer.length),
    enviar: async () => ({ delivered: true }),
    limiteBytes: 2 * 1024 * 1024,
    modo: 'adjunto',
    registrarError: () => {},
    ...parcial,
  };
}

describe('entrega de reportes por correo', () => {
  it('si la generación del PDF falla, el correo NO sale', async () => {
    const enviar = vi.fn();
    const registrarError = vi.fn();
    const r = await entregarReporte(deps({ generarPdf: async () => { throw new Error('resvg reventó'); }, enviar, registrarError }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('pdf_fallido');
    expect(enviar).not.toHaveBeenCalled();
    expect(registrarError).toHaveBeenCalled();
  });

  it('si guardar el PDF falla, tampoco sale: sin documento congelado no hay reenvío idéntico', async () => {
    const enviar = vi.fn();
    const r = await entregarReporte(deps({ guardar: async () => { throw new Error('base caída'); }, enviar }));
    expect(r.ok).toBe(false);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('el primer envío genera y guarda; el reenvío usa el guardado, sin regenerar', async () => {
    const generarPdf = vi.fn(async () => ({ buffer: Buffer.alloc(500), paleta: 'clara', nombreArchivo: 'x.pdf' }));
    const guardado = doc(500);
    const enviados: DocumentoPdf[] = [];
    const enviar = async (d: DocumentoPdf) => {
      enviados.push(d);
      return { delivered: true };
    };

    const primero = await entregarReporte(deps({ generarPdf, guardar: async () => guardado, enviar }));
    const segundo = await entregarReporte(deps({ generarPdf, buscarGuardado: async () => guardado, enviar }));

    expect(generarPdf).toHaveBeenCalledTimes(1);
    expect(primero.ok && !primero.reenvio).toBe(true);
    expect(segundo.ok && segundo.reenvio).toBe(true);
    expect(enviados[0].buffer.equals(enviados[1].buffer)).toBe(true);
  });

  it('un PDF sobre el límite no se envía sin adjunto en silencio: avisa y ofrece enlace', async () => {
    const enviar = vi.fn();
    const r = await entregarReporte(deps({ generarPdf: async () => ({ buffer: Buffer.alloc(3_000_000), paleta: 'clara', nombreArchivo: 'x.pdf' }), enviar }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('pdf_muy_grande');
      expect(r.error).toContain('enlace de descarga');
    }
    expect(enviar).not.toHaveBeenCalled();
  });

  it('con el agente eligiendo enlace, el PDF grande sí sale como enlace', async () => {
    const enviar = vi.fn(async () => ({ delivered: true }));
    const r = await entregarReporte(deps({ generarPdf: async () => ({ buffer: Buffer.alloc(3_000_000), paleta: 'clara', nombreArchivo: 'x.pdf' }), enviar, modo: 'enlace' }));
    expect(r.ok && r.modo === 'enlace').toBe(true);
    expect(enviar).toHaveBeenCalledWith(expect.anything(), 'enlace');
  });

  it('si el proveedor rechaza, se informa y el documento queda congelado igual', async () => {
    const guardar = vi.fn(async () => doc(800));
    const r = await entregarReporte(deps({ guardar, enviar: async () => ({ delivered: false, error: 'rate limit' }) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('envio_fallido');
    expect(guardar).toHaveBeenCalledTimes(1);
  });
});

describe('nombres de archivo', () => {
  const fecha = new Date('2026-09-12T15:00:00Z');

  it('visita: tipo, sector y fecha, sin tildes ni espacios', () => {
    expect(nombreArchivoVisita('La Carolina', fecha)).toBe('Visita-La-Carolina-2026-09-12.pdf');
    expect(nombreArchivoVisita('Cumbayá-Tumbaco', fecha)).toBe('Visita-Cumbaya-Tumbaco-2026-09-12.pdf');
    expect(nombreArchivoVisita('Iñaquito', fecha, 'png')).toBe('Visita-Inaquito-2026-09-12.png');
  });

  it('gestión: con el período', () => {
    expect(nombreArchivoGestion('La Carolina', new Date('2026-09-05T15:00:00Z'), fecha)).toBe('Gestion-La-Carolina-2026-09-05-al-2026-09-12.pdf');
  });

  it('tasación', () => {
    expect(nombreArchivoTasacion('Centro-Norte', fecha)).toBe('Tasacion-Centro-Norte-2026-09-12.pdf');
  });

  it('la fecha es la de Ecuador: una visita a las 21:00 no pasa al día siguiente', () => {
    expect(nombreArchivoVisita('Norte', new Date('2026-09-13T02:00:00Z'))).toBe('Visita-Norte-2026-09-12.pdf');
  });
});

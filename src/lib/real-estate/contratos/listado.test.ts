import { describe, expect, it, vi } from 'vitest';
import { filasTolerantes, type ContratoFila } from './listado';
import { CONTRATO_DEFINICION } from './tipos';

// Lo que se vigila: un registro problemático se degrada y queda registrado,
// pero NUNCA tumba la lista entera. Un contrato viejo o mal formado no puede
// dejar sin módulo a todo el agente.

function contrato(extra: Partial<ContratoFila> = {}): ContratoFila {
  return {
    id: `c-${Math.random().toString(36).slice(2, 8)}`,
    tipo: 'CORRETAJE',
    estado: 'BORRADOR',
    codigoVerificacion: 'ABCDE-FGHJK',
    firmantes: [],
    ...extra,
  };
}

describe('filas del listado de contratos', () => {
  it('resuelve la etiqueta de cada tipo conocido, legados incluidos', () => {
    const tipos = Object.keys(CONTRATO_DEFINICION);
    const filas = filasTolerantes(
      tipos.map((tipo) => contrato({ tipo })),
      () => {},
    );
    expect(filas).toHaveLength(tipos.length);
    for (const fila of filas) {
      expect(fila.tipoConocido).toBe(true);
      expect(fila.tipoEtiqueta).not.toBe('Documento');
      expect(fila.ilegible).toBeUndefined();
    }
  });

  // El corretaje legado es el caso real: existe en la base, ya no se ofrece, y
  // su definición sigue viva justo para que estas filas se dibujen.
  it('el corretaje legado se muestra normal, no degradado', () => {
    const [fila] = filasTolerantes([contrato({ tipo: 'CORRETAJE' })], () => {});
    expect(fila.tipoConocido).toBe(true);
    expect(fila.tipoEtiqueta).toBe('Contrato de corretaje');
    expect(fila.ilegible).toBeUndefined();
  });

  it('un tipo que este despliegue no conoce se muestra con nombre genérico', () => {
    const [fila] = filasTolerantes([contrato({ tipo: 'TIPO_DEL_FUTURO' })], () => {});
    expect(fila.tipoEtiqueta).toBe('Documento');
    expect(fila.tipoConocido).toBe(false);
    // No es ilegible: se leyó bien, solo que no sabemos cómo se llama.
    expect(fila.ilegible).toBeUndefined();
    expect(fila.tipo).toBe('TIPO_DEL_FUTURO');
  });

  it('una fila rota no impide que las demás se muestren', () => {
    const avisar = vi.fn();
    const filas = filasTolerantes(
      [contrato({ tipo: 'ARRENDAMIENTO' }), null, contrato({ tipo: 'RESERVA_ARRIENDO' })],
      avisar,
    );
    expect(filas).toHaveLength(3);
    expect(filas[0].tipoConocido).toBe(true);
    expect(filas[1].ilegible).toBe(true);
    expect(filas[2].tipoConocido).toBe(true);
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it('la fila degradada trae todos los campos que la pantalla lee', () => {
    const [fila] = filasTolerantes([undefined], () => {});
    for (const clave of ['id', 'tipo', 'estado', 'codigoVerificacion', 'createdAt', 'firmantes', 'tipoEtiqueta']) {
      expect(fila[clave], clave).toBeDefined();
    }
    expect(Array.isArray(fila.firmantes)).toBe(true);
    expect(fila.ilegible).toBe(true);
  });

  it('cada fallo se reporta con el error real, para que quede en el log', () => {
    const avisar = vi.fn();
    filasTolerantes([{ tipo: 'CORRETAJE' } as ContratoFila], avisar);
    expect(avisar).toHaveBeenCalledTimes(1);
    const [, error] = avisar.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('identificador');
  });

  it('una lista vacía es una lista vacía, no un fallo', () => {
    const avisar = vi.fn();
    expect(filasTolerantes([], avisar)).toEqual([]);
    expect(avisar).not.toHaveBeenCalled();
  });
});

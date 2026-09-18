import { afterEach, describe, expect, it } from 'vitest';
import { MENSAJE_CAMBIOS_SIN_GUARDAR, confirmarSalida, hayCambiosSinGuardar, registrarCambiosSinGuardar } from './cambios-sin-guardar';

const quitar: Array<() => void> = [];
afterEach(() => {
  while (quitar.length) quitar.pop()!();
});

describe('confirmarSalida', () => {
  it('sin cambios, sale sin preguntar', () => {
    let pregunto = false;
    expect(confirmarSalida(() => ((pregunto = true), false))).toBe(true);
    expect(pregunto).toBe(false);
  });

  it('con cambios, pregunta con el mensaje pedido y respeta la respuesta', () => {
    quitar.push(registrarCambiosSinGuardar());
    const preguntas: string[] = [];
    expect(confirmarSalida((m) => (preguntas.push(m), false))).toBe(false);
    expect(confirmarSalida((m) => (preguntas.push(m), true))).toBe(true);
    expect(preguntas).toEqual([MENSAJE_CAMBIOS_SIN_GUARDAR, MENSAJE_CAMBIOS_SIN_GUARDAR]);
    expect(MENSAJE_CAMBIOS_SIN_GUARDAR).toBe('Tienes cambios sin guardar. ¿Salir sin guardar?');
  });

  it('usa el mensaje traducido que pasa el formulario', () => {
    quitar.push(registrarCambiosSinGuardar('You have unsaved changes. Leave without saving?'));
    let visto = '';
    confirmarSalida((m) => ((visto = m), true));
    expect(visto).toBe('You have unsaved changes. Leave without saving?');
  });

  it('al guardar o desmontarse el formulario, deja de preguntar', () => {
    const fuera = registrarCambiosSinGuardar();
    expect(hayCambiosSinGuardar()).toBe(true);
    fuera();
    expect(hayCambiosSinGuardar()).toBe(false);
    expect(confirmarSalida(() => false)).toBe(true);
  });

  it('con dos formularios montados, pregunta mientras quede alguno con cambios', () => {
    const a = registrarCambiosSinGuardar();
    quitar.push(registrarCambiosSinGuardar());
    a();
    expect(confirmarSalida(() => false)).toBe(false);
  });
});

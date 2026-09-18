import { describe, expect, it } from 'vitest';
import { decidirVuelta, type ContextoVuelta } from './volver';

const APP = 'https://redinmo.io';
const base: ContextoVuelta = {
  referrer: '',
  origen: APP,
  urlActual: `${APP}/ayuda/explicar-el-contrato`,
  largoHistorial: 2,
  navegoDentro: false,
};

describe('decidirVuelta', () => {
  it('vuelve en el historial si llegó desde otra pantalla de la app', () => {
    expect(decidirVuelta({ ...base, referrer: `${APP}/?tab=contratos&contrato=c1` })).toBe('historial');
  });

  it('entrada directa (sin referrer y sin navegar dentro): va al padre', () => {
    expect(decidirVuelta(base)).toBe('padre');
  });

  it('nunca retrocede hacia otro sitio', () => {
    expect(decidirVuelta({ ...base, referrer: 'https://www.google.com/' })).toBe('padre');
    expect(decidirVuelta({ ...base, referrer: 'https://pay.payphonetodoesposible.com/' })).toBe('padre');
  });

  it('pestaña nueva o app recién abierta en esta pantalla: no hay nada atrás', () => {
    expect(decidirVuelta({ ...base, largoHistorial: 1, referrer: `${APP}/` })).toBe('padre');
    expect(decidirVuelta({ ...base, largoHistorial: 1, navegoDentro: true })).toBe('padre');
  });

  it('una recarga (referrer igual a la URL actual) no cuenta como pantalla anterior', () => {
    expect(decidirVuelta({ ...base, referrer: base.urlActual })).toBe('padre');
  });

  it('navegó dentro del documento sin referrer de la app: vuelve, con respaldo al padre', () => {
    expect(decidirVuelta({ ...base, navegoDentro: true })).toBe('historial-con-respaldo');
    expect(decidirVuelta({ ...base, navegoDentro: true, referrer: 'https://www.google.com/' })).toBe('historial-con-respaldo');
  });

  it('un referrer ilegible se ignora', () => {
    expect(decidirVuelta({ ...base, referrer: 'no es una url' })).toBe('padre');
  });
});

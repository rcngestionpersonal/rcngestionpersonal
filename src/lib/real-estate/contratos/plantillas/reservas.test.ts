import { describe, expect, it } from 'vitest';
import { prepararDocumento, type EntradaDocumento } from '../documento';
import type { BloqueFinal } from '../clausulas';
import { plantillaActual } from './index';
import { CONTRATO_DEFINICION, CONTRATO_MENU, PARTES_POR_TIPO, camposFaltantes } from '../tipos';

// Las dos reservas, de vuelta con aprobación de borrador. Datos inventados:
// ningún nombre, cédula, RUC ni dirección de este archivo corresponde a una
// persona o compañía real.

type TipoReserva = 'RESERVA_COMPRAVENTA' | 'RESERVA_ARRIENDO';

const BASE: Record<TipoReserva, Record<string, string>> = {
  RESERVA_COMPRAVENTA: {
    vendedor_nombre: 'Vendedora Ficticia',
    vendedor_cedula: '1700000021',
    vendedor_estadoCivil: 'casada',
    vendedor_correo: 'vendedora@ejemplo.test',
    vendedor_telefono: '+593 99 000 0021',
    vendedor_direccion: 'Calle Inventada 21',
    comprador_nombre: 'Comprador Ficticio',
    comprador_cedula: '1700000022',
    comprador_correo: 'comprador@ejemplo.test',
    comprador_telefono: '+593 99 000 0022',
    comprador_direccion: 'Calle Inventada 22',
    precioTotal: '185000',
    montoReserva: '5000',
    fechaEntrega: '2026-09-20',
    plazoEscrituraDias: '60',
    siDesisteComprador: 'SE_PIERDE',
    siDesisteVendedor: 'DEVUELVE_DOBLE',
  },
  RESERVA_ARRIENDO: {
    interesado_nombre: 'Interesada Ficticia',
    interesado_cedula: '1700000023',
    interesado_correo: 'interesada@ejemplo.test',
    interesado_telefono: '+593 99 000 0023',
    interesado_direccion: 'Calle Inventada 23',
    montoReserva: '400',
    fechaEntrega: '2026-09-20',
    siNoSeConcreta: 'DEVOLUCION_TOTAL',
  },
};

function datos(tipo: TipoReserva, extra: Record<string, string> = {}): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const c of CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos)) if (c.porDefecto) defaults[c.clave] = c.porDefecto;
  return { ...defaults, ...BASE[tipo], ...extra };
}

function doc(tipo: TipoReserva, extra: Record<string, string> = {}) {
  const entrada: EntradaDocumento = {
    tipo,
    version: plantillaActual(tipo),
    datos: datos(tipo, extra),
    agente: {
      nombre: 'Agente de Prueba',
      cedula: '1700000001',
      ruc: null,
      licencia: 'LIC-0001',
      direccion: 'Calle Ficticia 1, Quito',
      telefono: '+593 99 000 0001',
      correo: 'agente@ejemplo.test',
      ciudad: 'Quito',
    },
    inmueble: { descripcion: 'un departamento de prueba', ubicacion: 'Quito', caracteristicas: '' },
    fecha: new Date('2026-09-16T12:00:00Z'),
  };
  return prepararDocumento(entrada);
}

type Clausula = Extract<BloqueFinal, { tipo: 'clausula' }>;
const clausula = (bloques: BloqueFinal[], clave: string) => bloques.find((b): b is Clausula => b.tipo === 'clausula' && b.clave === clave)!;

describe.each(['RESERVA_COMPRAVENTA', 'RESERVA_ARRIENDO'] as const)('%s', (tipo) => {
  const d = doc(tipo);

  it('está en el selector, con su línea de cuándo usarla', () => {
    expect(CONTRATO_MENU.map((e) => e.tipo)).toContain(tipo);
    expect(CONTRATO_DEFINICION[tipo].descripcion).toMatch(/^Cuando /);
  });

  it('con los datos completos no falta nada para enviar', () => {
    expect(camposFaltantes(tipo, datos(tipo))).toEqual([]);
  });

  it('no deja marcas sin resolver ni menciona la firma electrónica retirada', () => {
    expect(d.texto).not.toContain('{{');
    expect(d.texto).not.toContain('undefined');
    expect(d.texto).not.toContain('[ POR COMPLETAR ]');
    expect(d.texto.toLowerCase()).not.toContain('constancia de firma');
    expect(d.texto.toLowerCase()).not.toContain('firma electrónica');
    expect(d.texto.toLowerCase()).not.toContain('redinmo');
  });

  it('no escribe cuentas bancarias', () => {
    expect(d.texto).not.toMatch(/n[úu]mero de cuenta|cuenta (corriente|de ahorros)/i);
  });

  it('el agente comparece pero no aprueba: aprueban las partes de la operación', () => {
    const aprobadores = PARTES_POR_TIPO[tipo].filter((p) => !p.esAgente).map((p) => p.rol);
    expect(aprobadores).toEqual(tipo === 'RESERVA_COMPRAVENTA' ? ['vendedor', 'comprador'] : ['interesado']);
    expect(PARTES_POR_TIPO[tipo].some((p) => p.esAgente)).toBe(true);
  });

  it('una compañía comparece con su representante legal', () => {
    const rol = tipo === 'RESERVA_COMPRAVENTA' ? 'comprador' : 'interesado';
    const conCompania = doc(tipo, {
      [`${rol}_tipoPersona`]: 'JURIDICA',
      [`${rol}_razonSocial`]: 'Compañía Ficticia S.A.',
      [`${rol}_ruc`]: '1790000000021',
      [`${rol}_representante`]: 'Representante Ficticio',
      [`${rol}_representanteCedula`]: '1700000024',
    });
    expect(conCompania.texto).toContain('la compañía Compañía Ficticia S.A., con RUC N.º 1790000000021, debidamente representada por Representante Ficticio');
    expect(camposFaltantes(tipo, datos(tipo, { [`${rol}_tipoPersona`]: 'JURIDICA' }))).toContain('Razón social');
  });
});

describe('reserva de compraventa', () => {
  it('advierte arriba que no es una promesa de compraventa', () => {
    const bloques = doc('RESERVA_COMPRAVENTA').bloques;
    expect(bloques[0].tipo).toBe('titulo');
    expect(bloques[1]).toMatchObject({ tipo: 'aviso' });
    expect((bloques[1] as { texto: string }).texto).toContain('no una promesa de compraventa');
  });

  it('calcula el saldo en la ficha', () => {
    const ficha = doc('RESERVA_COMPRAVENTA').bloques.find((b) => b.tipo === 'ficha');
    const saldo = ficha && 'filas' in ficha ? ficha.filas.find((f) => f.etiqueta === 'Saldo')?.valor : '';
    expect(saldo).toContain('180.000,00');
  });

  it('quien devuelve o entrega el dinero es quien lo tiene', () => {
    const conVendedora = clausula(doc('RESERVA_COMPRAVENTA', { reservaEntregadaA: 'VENDEDOR' }).bloques, 'penalidad').texto;
    expect(conVendedora).toContain('que ya lo tiene en su poder');
    expect(conVendedora).not.toContain('el Corredor');
    const conCorredor = clausula(doc('RESERVA_COMPRAVENTA', { reservaEntregadaA: 'CORREDOR' }).bloques, 'penalidad').texto;
    expect(conCorredor).toContain('el Corredor lo entregará a la Parte Vendedora');
    expect(conCorredor).toContain('simple depositario');
  });

  it('la referencia a la penalidad sigue a su cláusula', () => {
    const d = doc('RESERVA_COMPRAVENTA', { reservaEntregadaA: 'CORREDOR' });
    const numeroPenalidad = clausula(d.bloques, 'penalidad').encabezado.split('.—')[0].replace('CLÁUSULA ', '').toLowerCase();
    expect(clausula(d.bloques, 'entrega-reserva').texto).toContain(`conforme a la cláusula ${numeroPenalidad}`);
  });

  it('el financiamiento solo aparece si hay crédito', () => {
    expect(clausula(doc('RESERVA_COMPRAVENTA').bloques, 'precio').texto).not.toContain('crédito será tramitado');
    expect(clausula(doc('RESERVA_COMPRAVENTA', { formaPagoSaldo: 'CREDITO', entidadFinanciera: 'Banco de Prueba' }).bloques, 'precio').texto).toContain(
      'El crédito será tramitado ante Banco de Prueba',
    );
  });

  it('firman tres: vendedora, compradora y corredor', () => {
    const firmas = doc('RESERVA_COMPRAVENTA').bloques.find((b) => b.tipo === 'firmas');
    const calidades = firmas && 'partes' in firmas ? firmas.partes.map((p) => p.calidad) : [];
    expect(calidades).toEqual(['PARTE VENDEDORA', 'PARTE COMPRADORA', 'CORREDOR DE BIENES RAÍCES']);
  });

  it('el estado civil se imprime para personas, no para compañías', () => {
    expect(doc('RESERVA_COMPRAVENTA').texto).toContain('de estado civil casada');
    expect(doc('RESERVA_COMPRAVENTA', { vendedor_tipoPersona: 'JURIDICA', vendedor_razonSocial: 'Compañía Ficticia S.A.' }).texto).not.toContain(
      'de estado civil casada',
    );
  });
});

describe('reserva de arrendamiento', () => {
  it('quien devuelve el dinero es quien lo tiene', () => {
    const agente = clausula(doc('RESERVA_ARRIENDO', { reservaEntregadaA: 'AGENTE', siNoSeConcreta: 'SE_PIERDE' }).bloques, 'no-concreta').texto;
    expect(agente).toContain('el Agente lo entregará al arrendador');
    const arrendador = clausula(doc('RESERVA_ARRIENDO', { reservaEntregadaA: 'ARRENDADOR', siNoSeConcreta: 'SE_PIERDE' }).bloques, 'no-concreta').texto;
    expect(arrendador).toContain('que ya lo tiene en su poder');
  });

  it('el valor se imputa a lo que se eligió', () => {
    expect(clausula(doc('RESERVA_ARRIENDO', { destinoValor: 'GARANTIA' }).bloques, 'imputacion').texto).toContain('la garantía o depósito');
    expect(clausula(doc('RESERVA_ARRIENDO').bloques, 'imputacion').texto).toContain('el primer canon');
  });

  it('las notificaciones remiten a la comparecencia', () => {
    expect(clausula(doc('RESERVA_ARRIENDO').bloques, 'notificaciones').texto).toContain('indicados en la comparecencia');
  });
});

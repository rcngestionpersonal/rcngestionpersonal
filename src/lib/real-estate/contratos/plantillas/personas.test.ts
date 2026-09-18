import { describe, expect, it } from 'vitest';
import { prepararDocumento, type EntradaDocumento } from '../documento';
import { plantillaActual } from './index';
import { CONTRATO_DEFINICION, CONTRATO_MENU, camposFaltantes, listaDeNombres, nombresDeEtapa, personasEnLado, type ContratoTipo } from '../tipos';

// Varias personas en un mismo lado (cónyuges, copropietarios): comparecen
// juntas, firman una línea cada una y todas aprueban. Con una sola persona el
// documento es exactamente el de siempre. Datos inventados.

function datosDe(tipo: ContratoTipo, extra: Record<string, string> = {}): Record<string, string> {
  const d: Record<string, string> = {};
  for (const c of CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos)) {
    d[c.clave] =
      c.porDefecto ??
      (c.tipo === 'cedula'
        ? '1700000009'
        : c.tipo === 'correo'
          ? 'parte@ejemplo.test'
          : c.tipo === 'telefono'
            ? '0990000009'
            : c.tipo === 'dinero'
              ? '1500'
              : c.tipo === 'numero'
                ? '12'
                : c.tipo === 'fecha'
                  ? '2026-10-01'
                  : (c.opciones?.[0]?.valor ?? `dato ${c.etiqueta.toLowerCase()}`));
  }
  return { ...d, ...extra };
}

function doc(tipo: ContratoTipo, extra: Record<string, string> = {}) {
  const entrada: EntradaDocumento = {
    tipo,
    version: plantillaActual(tipo),
    datos: datosDe(tipo, extra),
    agente: {
      nombre: 'Agente de Prueba',
      cedula: '1700000001',
      ruc: null,
      licencia: 'LIC-0001',
      direccion: 'Calle Ficticia 1',
      telefono: '0990000001',
      correo: 'agente@ejemplo.test',
      ciudad: 'Quito',
    },
    inmueble: { descripcion: 'un inmueble de prueba', ubicacion: 'Quito', caracteristicas: '' },
    fecha: new Date('2026-09-16T12:00:00Z'),
  };
  return prepararDocumento(entrada);
}

const CONYUGE = {
  vendedor_personas: '2',
  vendedor_2_nombre: 'Conyuge Ficticio',
  vendedor_2_cedula: '1700000077',
  vendedor_2_estadoCivil: 'casado',
  vendedor_2_telefono: '0990000077',
};

describe('personas adicionales en un lado', () => {
  it('con una persona, la comparecencia no cambia: "a quien en adelante se denominará"', () => {
    const texto = doc('RESERVA_COMPRAVENTA').texto;
    expect(texto).toContain('a quien en adelante se denominará "la Parte Vendedora"');
    expect(texto).not.toContain('a quienes en adelante');
  });

  it('con dos, comparecen juntas bajo la misma denominación', () => {
    const texto = doc('RESERVA_COMPRAVENTA', CONYUGE).texto;
    expect(texto).toContain(
      '; y Conyuge Ficticio, portador de la cédula N.º 1700000077, de estado civil casado, con domicilio en dato domicilio, correo electrónico parte@ejemplo.test, teléfono 0990000077, a quienes en adelante se denominará conjuntamente "la Parte Vendedora"',
    );
  });

  it('cada persona firma en su propia línea', () => {
    const firmas = doc('RESERVA_COMPRAVENTA', CONYUGE).bloques.find((b) => b.tipo === 'firmas');
    const lineas = firmas && 'partes' in firmas ? firmas.partes.map((p) => `${p.calidad}:${p.nombre}`) : [];
    expect(lineas).toEqual([
      'PARTE VENDEDORA:dato nombre completo',
      'PARTE VENDEDORA:Conyuge Ficticio',
      'PARTE COMPRADORA:dato nombre completo',
      'CORREDOR DE BIENES RAÍCES:Agente de Prueba',
    ]);
  });

  it('los datos de la segunda persona se exigen solo si se la agrega, y dicen de quién faltan', () => {
    expect(camposFaltantes('RESERVA_COMPRAVENTA', datosDe('RESERVA_COMPRAVENTA', { vendedor_2_nombre: '' }))).not.toContain(
      'Parte vendedora · segunda persona: Nombre completo',
    );
    expect(
      camposFaltantes('RESERVA_COMPRAVENTA', datosDe('RESERVA_COMPRAVENTA', { vendedor_personas: '2', vendedor_2_nombre: '' })),
    ).toContain('Parte vendedora · segunda persona: Nombre completo');
  });

  it('una compañía comparece sola, por su representante', () => {
    expect(personasEnLado('RESERVA_COMPRAVENTA', datosDe('RESERVA_COMPRAVENTA', { ...CONYUGE, vendedor_tipoPersona: 'JURIDICA' }), 'vendedor')).toBe(1);
  });

  it('todos los tipos vivos admiten varias personas en los lados que aprueban', () => {
    for (const { tipo } of CONTRATO_MENU) {
      const claves = CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos.map((c) => c.clave));
      expect(claves.some((c) => c.endsWith('_personas')), tipo).toBe(true);
    }
  });

  it('el correo es opcional, pero si se escribe tiene que ser válido', () => {
    expect(camposFaltantes('RESERVA_COMPRAVENTA', datosDe('RESERVA_COMPRAVENTA', { comprador_correo: '' }))).toEqual([]);
    expect(camposFaltantes('RESERVA_COMPRAVENTA', datosDe('RESERVA_COMPRAVENTA', { comprador_correo: 'no-es-correo' }))).toContain(
      'Correo electrónico (formato no válido)',
    );
  });
});

// "Enviar a Juan Pérez": el botón, el correo al agente y la alerta nombran a
// quienes reciben, con todas las personas de su lado.
describe('a quién se envía cada etapa', () => {
  const datos = datosDe('RESERVA_COMPRAVENTA', {
    vendedor_nombre: 'Vendedora Ficticia',
    comprador_nombre: 'Comprador Ficticio',
    comprador_personas: '2',
    comprador_2_nombre: 'Compradora Ficticia',
  });

  it('por defecto, primero el vendedor y después el comprador con todas sus personas', () => {
    expect(nombresDeEtapa('RESERVA_COMPRAVENTA', null, datos, 'PRINCIPAL')).toEqual(['Vendedora Ficticia']);
    expect(listaDeNombres(nombresDeEtapa('RESERVA_COMPRAVENTA', null, datos, 'CONTRAPARTE'))).toBe('Comprador Ficticio y Compradora Ficticia');
  });

  it('si el agente representa al comprador, la otra parte es el vendedor', () => {
    expect(nombresDeEtapa('RESERVA_COMPRAVENTA', 'COMPRADOR', datos, 'CONTRAPARTE')).toEqual(['Vendedora Ficticia']);
  });

  it('por una compañía recibe su representante', () => {
    const compania = { ...datos, vendedor_tipoPersona: 'JURIDICA', vendedor_razonSocial: 'Inmobiliaria Ficticia S.A.', vendedor_representante: 'Representante Ficticio' };
    expect(nombresDeEtapa('RESERVA_COMPRAVENTA', null, compania, 'PRINCIPAL')).toEqual(['Representante Ficticio']);
  });

  it('el corretaje no tiene otra parte', () => {
    expect(nombresDeEtapa('CORRETAJE', null, datosDe('CORRETAJE'), 'CONTRAPARTE')).toEqual([]);
  });

  it('une los nombres como se dicen', () => {
    expect(listaDeNombres([])).toBe('');
    expect(listaDeNombres(['Ana'])).toBe('Ana');
    expect(listaDeNombres(['Ana', 'Luis'])).toBe('Ana y Luis');
    expect(listaDeNombres(['Ana', 'Luis', 'Eva'])).toBe('Ana, Luis y Eva');
  });
});

import { describe, expect, it } from 'vitest';
import { textoPlano } from './clausulas';
import { prepararDocumento, type EntradaDocumento } from './documento';
import {
  MARCA_DATO_CONTRAPARTE,
  contraparteHabilitada,
  datosConContraparteTapada,
  enlaceWhatsApp,
  estadoDelContrato,
  etapaCompleta,
  indicadorEtapas,
  mensajeParaCompartir,
  parteHabilitada,
  primeraEtapa,
  type ParteEnFlujo,
  type VersionEnFlujo,
} from './flujo';
import { plantillaActual } from './plantillas';
import {
  CONTRATO_DEFINICION,
  estadoVigente,
  etiquetasEtapas,
  partesDocumento,
  rolesPorEtapa,
  type ContratoTipo,
} from './tipos';

// El flujo secuencial: primero aprueba el cliente del agente, después la
// contraparte, y el contrato solo queda listo cuando las dos etapas aprobaron la
// misma versión. Datos inventados: ningún nombre ni cédula de este archivo
// corresponde a una persona real.

const MAÑANA = new Date(Date.now() + 24 * 3600_000);
const AYER = new Date(Date.now() - 24 * 3600_000);

function version(extra: Partial<VersionEnFlujo> = {}): VersionEnFlujo {
  return {
    estado: 'EN_APROBACION',
    requierePrincipal: true,
    requiereContraparte: true,
    principalHeredadaDe: null,
    simultanea: false,
    contraparteEnviadaAt: null,
    ...extra,
  };
}

const parte = (etapa: 'PRINCIPAL' | 'CONTRAPARTE', estado: string, expiraAt: Date = MAÑANA): ParteEnFlujo => ({ etapa, estado, expiraAt });

describe('flujo: etapas por tipo de contrato', () => {
  it('por defecto el agente representa al propietario', () => {
    expect(rolesPorEtapa('RESERVA_COMPRAVENTA', null)).toEqual({ PRINCIPAL: ['vendedor'], CONTRAPARTE: ['comprador'] });
    expect(rolesPorEtapa('ARRENDAMIENTO_RESIDENCIAL', null)).toEqual({ PRINCIPAL: ['arrendador'], CONTRAPARTE: ['arrendatario'] });
    expect(rolesPorEtapa('CORRETAJE', null)).toEqual({ PRINCIPAL: ['propietario'], CONTRAPARTE: [] });
  });

  it('si lo contrató el comprador, el comprador revisa primero', () => {
    expect(rolesPorEtapa('RESERVA_COMPRAVENTA', 'COMPRADOR')).toEqual({ PRINCIPAL: ['comprador'], CONTRAPARTE: ['vendedor'] });
    expect(etiquetasEtapas('RESERVA_COMPRAVENTA', 'COMPRADOR')).toEqual({ PRINCIPAL: 'Comprador', CONTRAPARTE: 'Vendedor' });
  });

  it('un lado que no comparece no tiene etapa: la reserva de arriendo va directo al interesado', () => {
    expect(primeraEtapa('RESERVA_ARRIENDO', null)).toBe('CONTRAPARTE');
    expect(etiquetasEtapas('RESERVA_ARRIENDO', null)).toEqual({ PRINCIPAL: null, CONTRAPARTE: 'Interesado' });
    expect(primeraEtapa('RESERVA_ARRIENDO', 'INTERESADO')).toBe('PRINCIPAL');
  });

  it('un valor de representación desconocido cae al de por defecto', () => {
    expect(rolesPorEtapa('RESERVA_COMPRAVENTA', 'NOTARIO')).toEqual({ PRINCIPAL: ['vendedor'], CONTRAPARTE: ['comprador'] });
  });

  it('los estados del flujo anterior se leen como su equivalente', () => {
    expect(estadoVigente('EN_APROBACION')).toBe('EN_REVISION_PRINCIPAL');
    expect(estadoVigente('APROBADO')).toBe('APROBADO_FINAL');
    expect(estadoVigente('FIRMADO')).toBe('APROBADO_FINAL');
    expect(estadoVigente('PENDIENTE_FIRMA')).toBe('VENCIDO');
    expect(estadoVigente('APROBADO_PRINCIPAL')).toBe('APROBADO_PRINCIPAL');
  });
});

describe('flujo: estado del contrato', () => {
  it('recién enviada a la principal: en revisión por la principal', () => {
    expect(estadoDelContrato(version(), [parte('PRINCIPAL', 'ENVIADO')])).toBe('EN_REVISION_PRINCIPAL');
  });

  it('la principal aprueba: queda aprobado por la principal, sin enviarse solo a la contraparte', () => {
    expect(estadoDelContrato(version(), [parte('PRINCIPAL', 'APROBADO')])).toBe('APROBADO_PRINCIPAL');
  });

  it('con cónyuges o copropietarios, TODOS aprueban antes de pasar de etapa', () => {
    const partes = [parte('PRINCIPAL', 'APROBADO'), parte('PRINCIPAL', 'ABIERTO')];
    expect(estadoDelContrato(version(), partes)).toBe('EN_REVISION_PRINCIPAL');
    expect(etapaCompleta(version(), partes, 'PRINCIPAL')).toBe(false);
    expect(estadoDelContrato(version(), [parte('PRINCIPAL', 'APROBADO'), parte('PRINCIPAL', 'APROBADO')])).toBe('APROBADO_PRINCIPAL');
  });

  it('enviada a la contraparte: en revisión por la contraparte; con su aprobación, final', () => {
    const v = version({ contraparteEnviadaAt: new Date() });
    expect(estadoDelContrato(v, [parte('PRINCIPAL', 'APROBADO'), parte('CONTRAPARTE', 'ENVIADO')])).toBe('EN_REVISION_CONTRAPARTE');
    expect(estadoDelContrato(v, [parte('PRINCIPAL', 'APROBADO'), parte('CONTRAPARTE', 'APROBADO')])).toBe('APROBADO_FINAL');
  });

  it('pedir cambios lleva al lateral de la etapa de quien los pidió', () => {
    const rechazada = version({ estado: 'RECHAZADA' });
    expect(estadoDelContrato(rechazada, [parte('PRINCIPAL', 'RECHAZADO')])).toBe('CAMBIOS_SOLICITADOS_PRINCIPAL');
    expect(estadoDelContrato(rechazada, [parte('PRINCIPAL', 'APROBADO'), parte('CONTRAPARTE', 'RECHAZADO')])).toBe(
      'CAMBIOS_SOLICITADOS_CONTRAPARTE',
    );
  });

  it('un enlace pendiente vencido deja el contrato en VENCIDO; uno ya decidido no', () => {
    expect(estadoDelContrato(version(), [parte('PRINCIPAL', 'ENVIADO', AYER)])).toBe('VENCIDO');
    expect(estadoDelContrato(version(), [parte('PRINCIPAL', 'APROBADO', AYER)])).toBe('APROBADO_PRINCIPAL');
  });

  it('corrección menor: la aprobación de la principal se conserva y basta con la contraparte', () => {
    const v = version({ principalHeredadaDe: 2, contraparteEnviadaAt: new Date() });
    expect(estadoDelContrato(v, [parte('CONTRAPARTE', 'ENVIADO')])).toBe('EN_REVISION_CONTRAPARTE');
    expect(estadoDelContrato(v, [parte('CONTRAPARTE', 'APROBADO')])).toBe('APROBADO_FINAL');
  });

  it('un documento sin contraparte queda final con la aprobación de la principal', () => {
    expect(estadoDelContrato(version({ requiereContraparte: false }), [parte('PRINCIPAL', 'APROBADO')])).toBe('APROBADO_FINAL');
  });

  it('envío simultáneo: la contraparte puede aprobar primero, pero no es final sin la principal', () => {
    const v = version({ simultanea: true, contraparteEnviadaAt: new Date() });
    expect(estadoDelContrato(v, [parte('PRINCIPAL', 'ENVIADO'), parte('CONTRAPARTE', 'APROBADO')])).toBe('EN_REVISION_PRINCIPAL');
    expect(estadoDelContrato(v, [parte('PRINCIPAL', 'APROBADO'), parte('CONTRAPARTE', 'APROBADO')])).toBe('APROBADO_FINAL');
  });

  it('anulada', () => {
    expect(estadoDelContrato(version({ estado: 'ANULADA' }), [])).toBe('ANULADO');
    expect(estadoDelContrato(null, [])).toBe('BORRADOR');
  });
});

describe('flujo: la contraparte no ve nada antes de tiempo', () => {
  it('sin aprobación de la principal, la contraparte no está habilitada aunque tenga una fila', () => {
    const v = version({ contraparteEnviadaAt: new Date() });
    const partes = [parte('PRINCIPAL', 'ENVIADO'), parte('CONTRAPARTE', 'ENVIADO')];
    expect(contraparteHabilitada(v, partes)).toBe(false);
    expect(parteHabilitada({ etapa: 'CONTRAPARTE' }, v, partes)).toBe(false);
    expect(parteHabilitada({ etapa: 'PRINCIPAL' }, v, partes)).toBe(true);
  });

  it('con la principal aprobada pero sin que el agente la envíe, tampoco', () => {
    expect(contraparteHabilitada(version(), [parte('PRINCIPAL', 'APROBADO'), parte('CONTRAPARTE', 'ENVIADO')])).toBe(false);
  });

  it('aprobada por la principal y enviada por el agente, sí', () => {
    expect(contraparteHabilitada(version({ contraparteEnviadaAt: new Date() }), [parte('PRINCIPAL', 'APROBADO')])).toBe(true);
  });

  it('el envío simultáneo la habilita desde el principio: es la decisión que el agente tomó a sabiendas', () => {
    expect(contraparteHabilitada(version({ simultanea: true }), [parte('PRINCIPAL', 'ENVIADO')])).toBe(true);
  });
});

describe('flujo: indicador de etapas', () => {
  const etiquetas = { PRINCIPAL: 'Vendedor', CONTRAPARTE: 'Comprador' };
  const estados = (e: Parameters<typeof indicadorEtapas>[0]['estado'], principalCompleta = false) =>
    indicadorEtapas({ etiquetas, estado: e, principalCompleta }).map((p) => `${p.etiqueta}:${p.estado}`);

  it('"1. Vendedor → 2. Comprador → Listo para notaría"', () => {
    expect(estados('BORRADOR')).toEqual(['Vendedor:pendiente', 'Comprador:pendiente', 'Listo para notaría:pendiente']);
    expect(estados('EN_REVISION_PRINCIPAL')).toEqual(['Vendedor:actual', 'Comprador:pendiente', 'Listo para notaría:pendiente']);
    expect(estados('APROBADO_PRINCIPAL')).toEqual(['Vendedor:hecho', 'Comprador:actual', 'Listo para notaría:pendiente']);
    expect(estados('APROBADO_FINAL')).toEqual(['Vendedor:hecho', 'Comprador:hecho', 'Listo para notaría:hecho']);
    expect(estados('VENCIDO', true)).toEqual(['Vendedor:hecho', 'Comprador:actual', 'Listo para notaría:pendiente']);
  });
});

// "1. Vendedor: aprobado" · "2. Comprador: en espera", como lo ve el agente en
// Seguimiento.
describe('flujo: cómo va cada paso, en palabras', () => {
  const etiquetas = { PRINCIPAL: 'Vendedor', CONTRAPARTE: 'Comprador' };
  const pasos = (v: VersionEnFlujo | null, partes: ParteEnFlujo[], e: Parameters<typeof indicadorEtapas>[0]['estado'] = 'EN_REVISION_PRINCIPAL', et = etiquetas) =>
    indicadorEtapas({ etiquetas: et, estado: e, principalCompleta: false, version: v, partes })
      .filter((p) => p.clave !== 'NOTARIA')
      .map((p) => `${p.etiqueta}: ${p.situacion?.replace('_', ' ')}`);

  it('sin enviar: el vendedor pendiente y el comprador en espera', () => {
    expect(pasos(null, [], 'BORRADOR')).toEqual(['Vendedor: pendiente', 'Comprador: en espera']);
  });

  it('primero el vendedor; el comprador espera hasta que el agente se la envíe', () => {
    expect(pasos(version(), [parte('PRINCIPAL', 'ABIERTO')])).toEqual(['Vendedor: pendiente', 'Comprador: en espera']);
    expect(pasos(version(), [parte('PRINCIPAL', 'APROBADO')], 'APROBADO_PRINCIPAL')).toEqual(['Vendedor: aprobado', 'Comprador: en espera']);
    const enviada = version({ contraparteEnviadaAt: new Date() });
    expect(pasos(enviada, [parte('PRINCIPAL', 'APROBADO'), parte('CONTRAPARTE', 'ENVIADO')], 'EN_REVISION_CONTRAPARTE')).toEqual([
      'Vendedor: aprobado',
      'Comprador: enviado',
    ]);
    expect(pasos(enviada, [parte('PRINCIPAL', 'APROBADO'), parte('CONTRAPARTE', 'APROBADO')], 'APROBADO_FINAL')).toEqual([
      'Vendedor: aprobado',
      'Comprador: aprobado',
    ]);
  });

  it('los cambios pedidos se ven en el paso de quien los pidió', () => {
    const rechazada = version({ estado: 'RECHAZADA' });
    expect(pasos(rechazada, [parte('PRINCIPAL', 'RECHAZADO')], 'CAMBIOS_SOLICITADOS_PRINCIPAL')).toEqual([
      'Vendedor: cambios pedidos',
      'Comprador: en espera',
    ]);
    const desdeComprador = version({ estado: 'RECHAZADA', contraparteEnviadaAt: new Date() });
    expect(
      pasos(desdeComprador, [parte('PRINCIPAL', 'APROBADO'), parte('CONTRAPARTE', 'RECHAZADO')], 'CAMBIOS_SOLICITADOS_CONTRAPARTE'),
    ).toEqual(['Vendedor: aprobado', 'Comprador: cambios pedidos']);
  });

  it('la versión nueva tras los cambios del comprador vuelve primero al vendedor', () => {
    expect(pasos(version(), [parte('PRINCIPAL', 'ENVIADO')])).toEqual(['Vendedor: pendiente', 'Comprador: en espera']);
  });

  it('con "Enviar a ambos a la vez", el comprador ya la tiene', () => {
    const simultanea = version({ simultanea: true, contraparteEnviadaAt: new Date() });
    expect(pasos(simultanea, [parte('PRINCIPAL', 'ENVIADO'), parte('CONTRAPARTE', 'ENVIADO')])).toEqual([
      'Vendedor: pendiente',
      'Comprador: enviado',
    ]);
  });

  it('con una sola parte, un solo paso', () => {
    expect(pasos(version({ requiereContraparte: false }), [parte('PRINCIPAL', 'ENVIADO')], 'EN_REVISION_PRINCIPAL', { PRINCIPAL: 'Propietario', CONTRAPARTE: null } as never)).toEqual([
      'Propietario: pendiente',
    ]);
    // Reserva de arrendamiento: solo revisa el interesado, que es el paso 1.
    const soloInteresado = version({ requierePrincipal: false, contraparteEnviadaAt: new Date() });
    const et = { PRINCIPAL: null, CONTRAPARTE: 'Interesado' } as never;
    expect(pasos(soloInteresado, [parte('CONTRAPARTE', 'ENVIADO')], 'EN_REVISION_CONTRAPARTE', et)).toEqual(['Interesado: pendiente']);
    expect(pasos(soloInteresado, [parte('CONTRAPARTE', 'APROBADO')], 'APROBADO_FINAL', et)).toEqual(['Interesado: aprobado']);
  });
});

describe('flujo: corrección menor comprobada por huella', () => {
  const agente = {
    nombre: 'Agente de Prueba',
    cedula: '1700000001',
    ruc: null,
    licencia: 'LIC-0001',
    direccion: 'Calle Ficticia 1, Quito',
    telefono: '+593 99 000 0001',
    correo: 'agente@ejemplo.test',
    ciudad: 'Quito',
  };

  function datosBase(tipo: ContratoTipo): Record<string, string> {
    const d: Record<string, string> = {};
    for (const c of CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos)) if (c.porDefecto) d[c.clave] = c.porDefecto;
    return {
      ...d,
      vendedor_nombre: 'Vendedora Ficticia',
      vendedor_cedula: '1700000021',
      vendedor_telefono: '0990000021',
      vendedor_direccion: 'Calle Inventada 21',
      comprador_nombre: 'Comprador Ficticio',
      comprador_cedula: '1700000022',
      comprador_telefono: '0990000022',
      comprador_direccion: 'Calle Inventada 22',
      precioTotal: '185000',
      montoReserva: '5000',
      fechaEntrega: '2026-09-20',
      siDesisteComprador: 'SE_PIERDE',
      siDesisteVendedor: 'DEVUELVE_DOBLE',
    };
  }

  const huella = (datos: Record<string, string>) => {
    const entrada: EntradaDocumento = {
      tipo: 'RESERVA_COMPRAVENTA',
      version: plantillaActual('RESERVA_COMPRAVENTA'),
      datos: datosConContraparteTapada('RESERVA_COMPRAVENTA', 'VENDEDOR', datos),
      agente,
      inmueble: { descripcion: 'un departamento de prueba', ubicacion: 'Quito', caracteristicas: '' },
      fecha: new Date('2026-09-16T12:00:00Z'),
    };
    return textoPlano(prepararDocumento(entrada).bloques);
  };

  const base = datosBase('RESERVA_COMPRAVENTA');

  it('corregir la cédula, el domicilio o agregar el correo del comprador no cambia las condiciones', () => {
    expect(huella({ ...base, comprador_cedula: '1700000099', comprador_direccion: 'Otra Calle 1', comprador_correo: 'nuevo@ejemplo.test' })).toBe(
      huella(base),
    );
    expect(huella(base)).toContain(MARCA_DATO_CONTRAPARTE);
  });

  it('cambiar un monto, una cláusula o los datos del vendedor sí cambia las condiciones', () => {
    expect(huella({ ...base, precioTotal: '190000' })).not.toBe(huella(base));
    expect(huella({ ...base, vendedor_cedula: '1700000098' })).not.toBe(huella(base));
    expect(huella({ ...base, siDesisteComprador: 'DEVOLUCION_TOTAL' })).not.toBe(huella(base));
    expect(huella({ ...base, __clausulas: JSON.stringify({ textos: { objeto: { titulo: 'OBJETO', texto: 'Otro texto.' } }, activas: {}, nuevas: [] }) })).not.toBe(
      huella(base),
    );
  });

  it('convertir al comprador en compañía o sumarle una persona no es una corrección menor', () => {
    expect(huella({ ...base, comprador_tipoPersona: 'JURIDICA' })).not.toBe(huella(base));
    expect(huella({ ...base, comprador_personas: '2' })).not.toBe(huella(base));
  });

  it('la otra persona del lado aprobador también aprueba y firma', () => {
    const conConyuge = { ...base, vendedor_personas: '2', vendedor_2_nombre: 'Conyuge Ficticio', vendedor_2_cedula: '1700000031', vendedor_2_telefono: '0990000031' };
    expect(partesDocumento('RESERVA_COMPRAVENTA', conConyuge).map((p) => p.rol)).toEqual(['vendedor', 'vendedor_2', 'comprador', 'corredor']);
  });
});

describe('flujo: mensaje para compartir', () => {
  it('neutro, sin marca, con el primer nombre y el enlace', () => {
    const m = mensajeParaCompartir({
      nombre: 'Vendedora Ficticia',
      tipoDocumento: 'reserva de compraventa',
      referencia: '"Departamento de prueba"',
      enlace: 'https://ejemplo.test/aprobar/abc',
    });
    expect(m).toBe(
      'Hola Vendedora, te comparto el borrador de reserva de compraventa del inmueble "Departamento de prueba" para tu revisión. Por favor revísalo y apruébalo o indícame cambios: https://ejemplo.test/aprobar/abc',
    );
    expect(m.toLowerCase()).not.toContain('redinmo');
  });

  it('WhatsApp con el número en formato internacional, o sin destinatario si no se puede leer', () => {
    expect(enlaceWhatsApp('0990000021', 'hola')).toBe('https://wa.me/593990000021?text=hola');
    expect(enlaceWhatsApp('+593 99 000 0021', 'hola que tal')).toBe('https://wa.me/593990000021?text=hola%20que%20tal');
    expect(enlaceWhatsApp('', 'hola')).toBe('https://wa.me/?text=hola');
  });
});

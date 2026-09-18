import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { prepararDocumento, type EntradaDocumento } from './documento';
import { generarDocx } from './docx';
import { CLAVE_EDICION, type BloqueFinal } from './clausulas';
import { AVISO_APROBACION, camposFaltantes, identidadParte } from './tipos';

// El documento de trabajo completo: plantilla viva, personas naturales y
// jurídicas, ediciones de cláusulas y exportación a Word. Sin base de datos.
//
// Todos los datos son inventados. Ningún nombre, cédula, RUC ni correo de este
// archivo corresponde a una persona o compañía real.

const AGENTE = {
  nombre: 'Agente de Prueba',
  cedula: '1700000001',
  ruc: null,
  licencia: 'LIC-0001',
  direccion: 'Calle Ficticia 123, Quito',
  telefono: '+593 99 000 0001',
  correo: 'agente@ejemplo.test',
  ciudad: 'Quito',
};

const BASE: Record<string, string> = {
  propietario_nombre: 'Propietaria de Prueba',
  propietario_tipoDocumento: 'CEDULA',
  propietario_cedula: '1700000002',
  propietario_correo: 'propietaria@ejemplo.test',
  propietario_telefono: '+593 99 000 0002',
  propietario_direccion: 'Avenida Inventada 45, Quito',
  exclusividad: 'CON',
  rotuloAutorizado: 'SI',
  honorariosPorcentaje: '3',
  honorariosPlazoDias: '8',
  documentosPlazoDias: '15',
  vigenciaMeses: '6',
  prorrogaAvisoDias: '15',
  renunciaAvisoDias: '15',
  inmuebleDescripcion:
    'Departamento de prueba en el tercer piso de un edificio inventado, con 95 m² de construcción, tres dormitorios, dos baños, un parqueadero cubierto y bodega, en buen estado de conservación.',
  precio: '185000',
  propiedadDireccion: 'Avenida Inventada 45',
  propiedadCiudad: 'Quito',
  propiedadProvincia: 'Pichincha',
};

const COMPANIA: Record<string, string> = {
  propietario_tipoPersona: 'JURIDICA',
  propietario_razonSocial: 'Inmobiliaria Ficticia S.A.',
  propietario_ruc: '1790000000001',
  propietario_representante: 'Representante Ficticio',
  propietario_representanteCedula: '1700000003',
};

function entrada(datos: Record<string, string> = {}): EntradaDocumento {
  return {
    tipo: 'CORRETAJE',
    version: 'corretaje-v3-2026-09',
    datos: { ...BASE, ...datos },
    agente: AGENTE,
    inmueble: { descripcion: 'un departamento de prueba', ubicacion: 'Quito', caracteristicas: '' },
    fecha: new Date('2026-09-16T12:00:00Z'),
  };
}

type Clausula = Extract<BloqueFinal, { tipo: 'clausula' }>;
const clausula = (bloques: BloqueFinal[], clave: string) => bloques.find((b): b is Clausula => b.tipo === 'clausula' && b.clave === clave)!;
const firmas = (bloques: BloqueFinal[]) => bloques.find((b): b is Extract<BloqueFinal, { tipo: 'firmas' }> => b.tipo === 'firmas')!;

describe('personas naturales y jurídicas', () => {
  it('una persona comparece con su nombre y su cédula', () => {
    const { bloques } = prepararDocumento(entrada());
    const texto = clausula(bloques, 'comparecientes').texto;
    expect(texto).toContain('Propietaria de Prueba, portador de la cédula N.º 1700000002');
    expect(texto).not.toContain('la compañía');
  });

  it('una compañía comparece con razón social, RUC y su representante legal', () => {
    const { bloques } = prepararDocumento(entrada(COMPANIA));
    const texto = clausula(bloques, 'comparecientes').texto;
    expect(texto).toContain(
      'la compañía Inmobiliaria Ficticia S.A., con RUC N.º 1790000000001, debidamente representada por Representante Ficticio, portador de la cédula N.º 1700000003, en su calidad de representante legal',
    );
    // Los datos de la persona natural, aunque queden guardados, no se imprimen.
    expect(texto).not.toContain('Propietaria de Prueba');
  });

  it('una compañía entrega además el nombramiento de su representante', () => {
    expect(clausula(prepararDocumento(entrada(COMPANIA)).bloques, 'documentos').texto).toContain('nombramiento vigente');
    expect(clausula(prepararDocumento(entrada()).bloques, 'documentos').texto).not.toContain('nombramiento');
  });

  it('en la línea de firma, el representante firma por la compañía', () => {
    const [propietario] = firmas(prepararDocumento(entrada(COMPANIA)).bloques).partes;
    expect(propietario).toEqual({
      calidad: 'PROPIETARIO',
      nombre: 'Representante Ficticio',
      documento: '1700000003',
      tipoDocumento: 'C.I.',
      enRepresentacionDe: { razonSocial: 'Inmobiliaria Ficticia S.A.', ruc: '1790000000001' },
    });
  });

  it('el corredor puede comparecer por su empresa, con su propia persona como representante', () => {
    const { bloques } = prepararDocumento(
      entrada({ corredor_tipoPersona: 'JURIDICA', corredor_razonSocial: 'Corredora Ficticia Cía. Ltda.', corredor_ruc: '1790000000002' }),
    );
    expect(clausula(bloques, 'comparecientes').texto).toContain(
      'la compañía Corredora Ficticia Cía. Ltda., con RUC N.º 1790000000002, debidamente representada por Agente de Prueba',
    );
    const corredor = firmas(bloques).partes.find((p) => p.calidad === 'CORREDOR')!;
    expect(corredor.enRepresentacionDe?.razonSocial).toBe('Corredora Ficticia Cía. Ltda.');
  });

  it('quien aprueba por una compañía es su representante, con su cédula', () => {
    const identidad = identidadParte('CORRETAJE', { ...BASE, ...COMPANIA }, 'propietario');
    expect(identidad.aprobador).toEqual({ nombre: 'Representante Ficticio', cedula: '1700000003' });
    expect(identidad.nombre).toBe('Inmobiliaria Ficticia S.A.');
  });

  it('a una compañía se le piden sus datos, y no los de una persona', () => {
    const faltan = camposFaltantes('CORRETAJE', { ...BASE, propietario_tipoPersona: 'JURIDICA', propietario_nombre: '', propietario_cedula: '' });
    expect(faltan).toEqual(expect.arrayContaining(['Razón social', 'RUC', 'Representante legal', 'Cédula del representante']));
    expect(faltan).not.toContain('Nombre completo');
    expect(camposFaltantes('CORRETAJE', BASE)).toEqual([]);
  });

  it('la ciudad escrita a mano solo se pide si la jurisdicción es "Otra"', () => {
    expect(camposFaltantes('CORRETAJE', { ...BASE, jurisdiccionCiudad: 'QUITO' })).toEqual([]);
    expect(camposFaltantes('CORRETAJE', { ...BASE, jurisdiccionCiudad: 'OTRA' })).toContain('Escribe la ciudad');
  });
});

describe('ediciones sobre el corretaje', () => {
  it('las referencias del corretaje se resuelven a su cláusula', () => {
    const { bloques } = prepararDocumento(entrada());
    expect(clausula(bloques, 'exclusividad').texto).toContain('pactados en la cláusula tercera');
  });

  it('una cláusula agregada antes de los honorarios corre la referencia', () => {
    const edicion = {
      textos: {},
      activas: {},
      nuevas: [{ id: 'nueva-visita1', titulo: 'VISITAS', texto: 'Las visitas se coordinan con dos días de aviso.', despuesDe: 'rotulo' }],
    };
    const { bloques } = prepararDocumento(entrada({ [CLAVE_EDICION]: JSON.stringify(edicion) }));
    expect(clausula(bloques, 'nueva-visita1').encabezado).toBe('CLÁUSULA TERCERA.— VISITAS');
    expect(clausula(bloques, 'exclusividad').texto).toContain('pactados en la cláusula cuarta');
  });

  it('un tipo retirado ignora las ediciones: se reimprime como se generó', () => {
    const edicion = { textos: { 'pos-0': { titulo: 'X', texto: 'Texto cambiado' } }, activas: {}, nuevas: [] };
    const legado: EntradaDocumento = { ...entrada({ [CLAVE_EDICION]: JSON.stringify(edicion) }), tipo: 'ARRENDAMIENTO', version: 'arrendamiento-v3-2026-09' };
    expect(prepararDocumento(legado).texto).not.toContain('Texto cambiado');
    expect(prepararDocumento(legado).admiteEdicion).toBe(false);
  });

  it('ningún aviso de la plataforma entra al cuerpo del contrato', () => {
    const texto = prepararDocumento(entrada(COMPANIA)).texto;
    expect(texto).not.toContain(AVISO_APROBACION);
    expect(texto.toLowerCase()).not.toContain('redinmo');
    expect(texto.toLowerCase()).not.toContain('firma electrónica');
  });
});

describe('exportación a Word', () => {
  const doc = prepararDocumento(entrada(COMPANIA));
  const archivo = generarDocx({ bloques: doc.bloques, nombreDocumento: doc.nombreDocumento, ciudad: 'Quito', fechaLarga: '16 de septiembre de 2026' });
  const partes = unzipSync(archivo);
  const xml = strFromU8(partes['word/document.xml']);

  it('es un paquete .docx con sus partes obligatorias', () => {
    for (const nombre of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) {
      expect(partes[nombre], nombre).toBeDefined();
    }
  });

  it('trae el texto con los datos ya rellenados', () => {
    expect(xml).toContain('CLÁUSULA PRIMERA.— COMPARECIENTES');
    expect(xml).toContain('Inmobiliaria Ficticia S.A.');
    expect(xml).toContain('1790000000001');
  });

  it('no lleva la marca de la plataforma en ninguna de sus partes, metadatos incluidos', () => {
    for (const [nombre, contenido] of Object.entries(partes)) {
      expect(strFromU8(contenido).toLowerCase(), nombre).not.toContain('redinmo');
    }
  });

  it('el XML queda bien formado: todo párrafo y toda tabla se cierran', () => {
    const cuenta = (re: RegExp) => (xml.match(re) ?? []).length;
    expect(cuenta(/<w:p>/g)).toBe(cuenta(/<\/w:p>/g));
    expect(cuenta(/<w:tbl>/g)).toBe(cuenta(/<\/w:tbl>/g));
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  MARCA_REFERENCIA_ROTA,
  compararDocumentos,
  diffPalabras,
  aplicarEdicion,
  clausulasParaEditor,
  compararVersiones,
  documentoFinal,
  edicionVacia,
  leerEdicion,
  ordinal,
  sinCambios,
  textoPlano,
  type BloqueFinal,
  type EdicionClausulas,
} from './clausulas';
import type { BloqueDocumento } from './plantillas/base';

// El editor de cláusulas: lo que el agente activa, reescribe o agrega se aplica
// sobre la plantilla y recién después se numera. Lo que se vigila es que la
// numeración y las referencias entre cláusulas salgan siempre correctas.

const NOTA = 'Esta cláusula es de uso frecuente pero su validez puede discutirse.';

// Una plantilla mínima con una opcional en medio y referencias cruzadas.
const MODELO: BloqueDocumento[] = [
  { tipo: 'titulo', texto: 'CONTRATO DE PRUEBA' },
  { tipo: 'clausula', clave: 'antecedentes', titulo: 'ANTECEDENTES', texto: '{{n}}.1. Primer antecedente.\n{{n}}.2. Segundo.' },
  { tipo: 'clausula', clave: 'plazo', titulo: 'PLAZO', texto: 'Doce meses.' },
  { tipo: 'clausula', clave: 'renuncia', titulo: 'RENUNCIA', texto: 'Texto discutible.', opcional: { activaPorDefecto: false, nota: NOTA } },
  { tipo: 'clausula', clave: 'terminacion', titulo: 'TERMINACIÓN', texto: 'Por vencer el plazo de la cláusula {{ref:plazo}}.' },
  { tipo: 'firmas' },
  { tipo: 'ficha', titulo: 'FICHA', filas: [{ etiqueta: 'Precio', valor: '100' }] },
];

const FIRMAS = { leyenda: null, partes: [] };

function documento(edicion: EdicionClausulas = edicionVacia()): BloqueFinal[] {
  return documentoFinal(aplicarEdicion(MODELO, edicion), 'ordinal', FIRMAS);
}

function clausulas(edicion?: EdicionClausulas) {
  return documento(edicion).filter((b): b is Extract<BloqueFinal, { tipo: 'clausula' }> => b.tipo === 'clausula');
}

describe('ordinales', () => {
  it('escribe los ordinales como los contratos del país', () => {
    expect([1, 2, 3, 7, 10, 11, 13, 18, 20, 21, 29].map(ordinal)).toEqual([
      'primera',
      'segunda',
      'tercera',
      'séptima',
      'décima',
      'décima primera',
      'décima tercera',
      'décima octava',
      'vigésima',
      'vigésima primera',
      'vigésima novena',
    ]);
  });
});

describe('numeración y referencias', () => {
  it('numera correlativo y encabeza cada cláusula con su ordinal', () => {
    expect(clausulas().map((c) => c.encabezado)).toEqual([
      'CLÁUSULA PRIMERA.— ANTECEDENTES',
      'CLÁUSULA SEGUNDA.— PLAZO',
      'CLÁUSULA TERCERA.— TERMINACIÓN',
    ]);
  });

  it('una opcional desactivada por defecto no sale ni ocupa número', () => {
    const textos = clausulas().map((c) => c.titulo);
    expect(textos).not.toContain('RENUNCIA');
  });

  it('al activarla, las siguientes se renumeran solas', () => {
    const conRenuncia = clausulas({ ...edicionVacia(), activas: { renuncia: true } });
    expect(conRenuncia.map((c) => c.encabezado)).toEqual([
      'CLÁUSULA PRIMERA.— ANTECEDENTES',
      'CLÁUSULA SEGUNDA.— PLAZO',
      'CLÁUSULA TERCERA.— RENUNCIA',
      'CLÁUSULA CUARTA.— TERMINACIÓN',
    ]);
  });

  it('las subnumeraciones siguen el número de su cláusula', () => {
    const [antecedentes] = clausulas({
      ...edicionVacia(),
      nuevas: [{ id: 'nueva-aaaa1', titulo: 'PREVIA', texto: 'Algo.', despuesDe: 'antecedentes' }],
    });
    expect(antecedentes.texto).toBe('1.1. Primer antecedente.\n1.2. Segundo.');
  });

  it('una referencia sigue a la cláusula aunque cambie de número', () => {
    const terminacion = (e?: EdicionClausulas) => clausulas(e).find((c) => c.clave === 'terminacion')!.texto;
    expect(terminacion()).toBe('Por vencer el plazo de la cláusula segunda.');
    const conNueva = terminacion({
      ...edicionVacia(),
      nuevas: [{ id: 'nueva-bbbb1', titulo: 'OBJETO', texto: 'El objeto.', despuesDe: 'antecedentes' }],
    });
    expect(conNueva).toBe('Por vencer el plazo de la cláusula tercera.');
  });

  it('una referencia a una cláusula que no va sale marcada, nunca con un número falso', () => {
    const modelo: BloqueDocumento[] = [
      { tipo: 'clausula', clave: 'a', titulo: 'A', texto: 'Ver la cláusula {{ref:opcional}}.' },
      { tipo: 'clausula', clave: 'opcional', titulo: 'B', texto: 'x', opcional: { activaPorDefecto: false } },
    ];
    const [a] = documentoFinal(aplicarEdicion(modelo, edicionVacia()), 'ordinal', FIRMAS) as Array<
      Extract<BloqueFinal, { tipo: 'clausula' }>
    >;
    expect(a.texto).toBe(`Ver la cláusula ${MARCA_REFERENCIA_ROTA}.`);
  });

  it('las plantillas retiradas siguen encabezando en romanos', () => {
    const bloques = documentoFinal(aplicarEdicion(MODELO, edicionVacia()), 'romano', FIRMAS);
    const primera = bloques.find((b) => b.tipo === 'clausula');
    expect(primera && 'encabezado' in primera ? primera.encabezado : '').toBe('I. ANTECEDENTES:');
  });
});

describe('ediciones del agente', () => {
  it('un texto reescrito reemplaza al modelo y queda marcado', () => {
    const edicion = { ...edicionVacia(), textos: { plazo: { titulo: 'PLAZO', texto: 'Veinticuatro meses.' } } };
    expect(clausulas(edicion).find((c) => c.clave === 'plazo')!.texto).toBe('Veinticuatro meses.');
    const editor = clausulasParaEditor(aplicarEdicion(MODELO, edicion), 'ordinal').find((c) => c.clave === 'plazo')!;
    expect(editor.modificada).toBe(true);
    expect(editor.textoOriginal).toBe('Doce meses.');
  });

  it('restaurar es quitar la edición: vuelve el texto del modelo', () => {
    expect(clausulas().find((c) => c.clave === 'plazo')!.texto).toBe('Doce meses.');
  });

  it('una cláusula agregada va donde se indicó, y las encadenadas detrás', () => {
    const edicion: EdicionClausulas = {
      ...edicionVacia(),
      nuevas: [
        { id: 'nueva-segu2', titulo: 'SEGUNDA NUEVA', texto: 'b', despuesDe: 'nueva-prim1' },
        { id: 'nueva-prim1', titulo: 'PRIMERA NUEVA', texto: 'a', despuesDe: 'plazo' },
      ],
    };
    expect(clausulas(edicion).map((c) => c.titulo)).toEqual(['ANTECEDENTES', 'PLAZO', 'PRIMERA NUEVA', 'SEGUNDA NUEVA', 'TERMINACIÓN']);
  });

  it('una agregada al final, o sin cláusula de referencia, queda antes de las firmas', () => {
    const edicion: EdicionClausulas = {
      ...edicionVacia(),
      nuevas: [
        { id: 'nueva-fin01', titulo: 'AL FINAL', texto: 'x', despuesDe: null },
        { id: 'nueva-perd1', titulo: 'HUÉRFANA', texto: 'y', despuesDe: 'clausula-que-ya-no-existe' },
      ],
    };
    const tipos = documento(edicion).map((b) => (b.tipo === 'clausula' ? b.titulo : b.tipo));
    expect(tipos).toEqual(['titulo', 'ANTECEDENTES', 'PLAZO', 'TERMINACIÓN', 'AL FINAL', 'HUÉRFANA', 'firmas', 'ficha']);
  });

  it('una cadena circular no cuelga ni duplica', () => {
    const edicion: EdicionClausulas = {
      ...edicionVacia(),
      nuevas: [
        { id: 'nueva-ciclo1', titulo: 'C1', texto: 'x', despuesDe: 'nueva-ciclo2' },
        { id: 'nueva-ciclo2', titulo: 'C2', texto: 'y', despuesDe: 'nueva-ciclo1' },
      ],
    };
    const titulos = clausulas(edicion).map((c) => c.titulo);
    expect(titulos.filter((t) => t === 'C1')).toHaveLength(1);
    expect(titulos.filter((t) => t === 'C2')).toHaveLength(1);
  });

  it('el editor lista también las opcionales apagadas, con su nota y sin número', () => {
    const renuncia = clausulasParaEditor(aplicarEdicion(MODELO, edicionVacia()), 'ordinal').find((c) => c.clave === 'renuncia')!;
    expect(renuncia.activa).toBe(false);
    expect(renuncia.numero).toBeNull();
    expect(renuncia.opcional).toEqual({ activaPorDefecto: false, nota: NOTA });
  });

  it('una edición guardada corrupta no rompe el documento', () => {
    expect(leerEdicion({ __clausulas: '{no es json' })).toEqual(edicionVacia());
    expect(leerEdicion({ __clausulas: JSON.stringify({ textos: { a: 3 }, activas: { b: 'si' }, nuevas: [{ id: 1 }] }) })).toEqual(
      edicionVacia(),
    );
  });
});

describe('comparación entre versiones', () => {
  it('detecta lo modificado, lo agregado y lo retirado, por nombre de cláusula', () => {
    const v1 = documento();
    const v2 = documento({
      textos: { plazo: { titulo: 'PLAZO', texto: 'Seis meses.' } },
      activas: { renuncia: true },
      nuevas: [{ id: 'nueva-gara1', titulo: 'GARANTÍA', texto: 'Un mes.', despuesDe: 'plazo' }],
    });
    const cambios = compararVersiones(v1, v2);
    // TERMINACIÓN no cambia: su referencia al plazo sigue siendo la segunda.
    expect(cambios.modificadas).toEqual(['PLAZO']);
    expect(cambios.agregadas).toEqual(['GARANTÍA', 'RENUNCIA']);
    expect(cambios.retiradas).toEqual([]);
    expect(compararVersiones(v2, v1).retiradas).toEqual(['GARANTÍA', 'RENUNCIA']);
  });

  it('dos versiones con el mismo texto no tienen cambios', () => {
    expect(sinCambios(compararVersiones(documento(), documento()))).toBe(true);
  });

  it('un cambio en la ficha también cuenta, aunque las cláusulas sean iguales', () => {
    const otra = documento().map((b) => (b.tipo === 'ficha' ? { ...b, filas: [{ etiqueta: 'Precio', valor: '200' }] } : b));
    const cambios = compararVersiones(documento(), otra);
    expect(cambios.otros).toBe(true);
    expect(sinCambios(cambios)).toBe(false);
  });

  it('el texto plano incluye la ficha y a quién le toca firmar', () => {
    const bloques = documentoFinal(aplicarEdicion(MODELO, edicionVacia()), 'ordinal', {
      leyenda: null,
      partes: [
        {
          calidad: 'ARRENDADOR',
          nombre: 'Representante de Prueba',
          documento: '0000000000',
          tipoDocumento: 'C.I.',
          enRepresentacionDe: { razonSocial: 'Compañía de Prueba S.A.', ruc: '0000000000001' },
        },
      ],
    });
    const texto = textoPlano(bloques);
    expect(texto).toContain('Precio: 100');
    expect(texto).toContain('Compañía de Prueba S.A. (RUC 0000000000001)');
    expect(texto).toContain('ARRENDADOR');
  });
});

describe('comparación palabra por palabra', () => {
  it('marca lo agregado y lo quitado sin tocar lo que sigue igual', () => {
    const tramos = diffPalabras('El plazo es de 60 días calendario.', 'El plazo es de 90 días calendario.');
    expect(tramos.filter((t) => t.tipo !== 'igual')).toEqual([
      { tipo: 'quitado', texto: '60' },
      { tipo: 'agregado', texto: '90' },
    ]);
    expect(tramos.filter((t) => t.tipo !== 'quitado').map((t) => t.texto).join('')).toBe('El plazo es de 90 días calendario.');
    expect(tramos.filter((t) => t.tipo !== 'agregado').map((t) => t.texto).join('')).toBe('El plazo es de 60 días calendario.');
  });

  it('un texto igual es un solo tramo', () => {
    expect(diffPalabras('igual', 'igual')).toEqual([{ tipo: 'igual', texto: 'igual' }]);
  });

  it('empareja cláusulas por clave, no por número, y lista las retiradas', () => {
    const c = (clave: string, texto: string, encabezado = 'CLÁUSULA') => ({ tipo: 'clausula' as const, clave, encabezado, titulo: clave.toUpperCase(), texto });
    const antes = [c('objeto', 'Texto A.'), c('plazo', 'Sesenta días.'), c('multa', 'Sin multa.')];
    const despues = [c('objeto', 'Texto A.'), c('garantia', 'Nueva garantía.'), c('plazo', 'Noventa días.')];
    const r = compararDocumentos(antes, despues);
    expect(r.bloques.map((b) => b.estado)).toEqual(['igual', 'agregado', 'modificado']);
    expect(r.retiradas).toEqual(['MULTA']);
  });

  it('en la ficha marca solo las filas que cambiaron', () => {
    const ficha = (valor: string) => ({ tipo: 'ficha' as const, titulo: 'FICHA', filas: [{ etiqueta: 'Precio', valor }, { etiqueta: 'Plazo', valor: '60 días' }] });
    const r = compararDocumentos([ficha('USD 100')], [ficha('USD 120')]);
    expect(r.bloques[0].estado).toBe('modificado');
    expect(Object.keys(r.filas[0])).toEqual(['Precio']);
  });
});

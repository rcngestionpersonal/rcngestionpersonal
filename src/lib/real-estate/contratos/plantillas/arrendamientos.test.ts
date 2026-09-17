import { describe, expect, it } from 'vitest';
import { prepararDocumento, type EntradaDocumento } from '../documento';
import { CLAVE_EDICION, type BloqueFinal } from '../clausulas';
import { plantillaActual } from './index';
import {
  CONTRATO_DEFINICION,
  CONTRATO_MENU,
  NOTA_CLAUSULA_DISCUTIBLE,
  camposFaltantes,
  type ContratoTipo,
} from '../tipos';

// Los tres arrendamientos. Datos inventados: ningún nombre, cédula, RUC ni
// dirección de este archivo corresponde a una persona o compañía real.

const TIPOS = ['ARRENDAMIENTO_RESIDENCIAL', 'ARRENDAMIENTO_COMERCIAL', 'ARRENDAMIENTO_INDUSTRIAL'] as const;
type TipoArriendo = (typeof TIPOS)[number];

const RENUNCIAS = ['renuncia-canon', 'renuncia-desahucio', 'desalojo', 'titulo-ejecutivo'];

// Un valor plausible por campo, respetando los valores por defecto.
function datosDe(tipo: ContratoTipo): Record<string, string> {
  const datos: Record<string, string> = {};
  for (const campo of CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos)) {
    if (campo.porDefecto) {
      datos[campo.clave] = campo.porDefecto;
      continue;
    }
    datos[campo.clave] =
      campo.tipo === 'correo'
        ? 'parte@ejemplo.test'
        : campo.tipo === 'cedula'
          ? '1700000009'
          : campo.tipo === 'telefono'
            ? '+593 99 000 0009'
            : campo.tipo === 'dinero'
              ? '1500'
              : campo.tipo === 'porcentaje'
                ? '4'
                : campo.tipo === 'numero'
                  ? '2'
                  : campo.tipo === 'fecha'
                    ? '2026-10-01'
                    : campo.tipo === 'opcion' || campo.tipo === 'opcionExplicada'
                      ? (campo.opciones?.[0]?.valor ?? '')
                      : `Valor de prueba para ${campo.etiqueta.toLowerCase()}`;
  }
  return datos;
}

function entrada(tipo: TipoArriendo, extra: Record<string, string> = {}, activas: Record<string, boolean> = {}): EntradaDocumento {
  const datos: Record<string, string> = { ...datosDe(tipo), ...extra };
  if (Object.keys(activas).length > 0) datos[CLAVE_EDICION] = JSON.stringify({ textos: {}, activas, nuevas: [] });
  return {
    tipo,
    version: plantillaActual(tipo),
    datos,
    agente: {
      nombre: 'Agente de Prueba',
      cedula: '1700000001',
      ruc: null,
      licencia: 'LIC-0001',
      direccion: 'Calle Ficticia 1',
      telefono: '+593 99 000 0001',
      correo: 'agente@ejemplo.test',
      ciudad: 'Quito',
    },
    inmueble: { descripcion: 'un inmueble de prueba', ubicacion: 'Quito', caracteristicas: '' },
    fecha: new Date('2026-09-16T12:00:00Z'),
  };
}

type Clausula = Extract<BloqueFinal, { tipo: 'clausula' }>;
const clausulas = (bloques: BloqueFinal[]) => bloques.filter((b): b is Clausula => b.tipo === 'clausula');
const clausula = (bloques: BloqueFinal[], clave: string) => clausulas(bloques).find((c) => c.clave === clave);

describe('arrendamientos: selector', () => {
  it('se ofrecen los tres, cada uno con su línea de cuándo usarlo', () => {
    const tipos = CONTRATO_MENU.map((e) => e.tipo);
    for (const tipo of TIPOS) {
      expect(tipos, tipo).toContain(tipo);
      expect(CONTRATO_DEFINICION[tipo].descripcion, tipo).toMatch(/^Cuando /);
    }
  });

  it('con los datos completos no falta nada para enviar', () => {
    for (const tipo of TIPOS) expect(camposFaltantes(tipo, datosDe(tipo)), tipo).toEqual([]);
  });
});

describe.each(TIPOS)('%s', (tipo) => {
  const base = prepararDocumento(entrada(tipo));

  it('no deja marcas sin resolver, campos vacíos ni referencias rotas', () => {
    expect(base.texto).not.toContain('{{');
    expect(base.texto).not.toContain('undefined');
    expect(base.texto).not.toContain('[ POR COMPLETAR ]');
    expect(base.texto).not.toContain('[ cláusula no incluida ]');
  });

  it('no lleva marca de la plataforma, cuentas bancarias ni citas de artículos', () => {
    const texto = base.texto.toLowerCase();
    expect(texto).not.toContain('redinmo');
    expect(texto).not.toMatch(/n[úu]mero de cuenta|banco /);
    expect(texto).not.toMatch(/art[íi]culo \d/);
  });

  it('el modelo no trae datos fijos de nadie: sin formulario no hay cédulas, correos ni teléfonos', () => {
    const vacio = prepararDocumento({ ...entrada(tipo), datos: {} }).texto;
    expect(vacio).not.toMatch(/\d{9,}/);
    expect(vacio).not.toContain('@');
  });

  it('las cuatro renuncias discutibles existen, apagadas y con la nota de abogado', () => {
    for (const clave of RENUNCIAS) {
      const editable = base.clausulas.find((c) => c.clave === clave);
      expect(editable, clave).toBeDefined();
      expect(editable?.activa, clave).toBe(false);
      expect(editable?.opcional?.activaPorDefecto, clave).toBe(false);
      expect(editable?.opcional?.nota, clave).toBe(NOTA_CLAUSULA_DISCUTIBLE);
      expect(clausula(base.bloques, clave), clave).toBeUndefined();
    }
    const texto = base.texto.toLowerCase();
    expect(texto).not.toContain('desahucio');
    expect(texto).not.toContain('título ejecutivo');
    expect(texto).not.toContain('acción civil o penal');
  });

  it('al activarlas entran al documento y la numeración sigue correlativa', () => {
    const activas = Object.fromEntries(RENUNCIAS.map((c) => [c, true]));
    const conRenuncias = prepararDocumento(entrada(tipo, {}, activas));
    const lista = clausulas(conRenuncias.bloques);
    expect(lista.length).toBe(clausulas(base.bloques).length + RENUNCIAS.length);
    for (const clave of RENUNCIAS) expect(clausula(conRenuncias.bloques, clave), clave).toBeDefined();
    lista.forEach((c) => expect(c.encabezado, c.clave).toMatch(/^CLÁUSULA \S/));
    // Ningún número se repite.
    const encabezados = lista.map((c) => c.encabezado.split('.—')[0]);
    expect(new Set(encabezados).size).toBe(encabezados.length);
  });

  it('las subnumeraciones siguen el número de su cláusula', () => {
    for (const c of clausulas(base.bloques)) {
      const numeros = [...c.texto.matchAll(/^(\d+)\.\d+\. /gm)].map((m) => m[1]);
      expect(new Set(numeros).size, c.clave).toBeLessThanOrEqual(1);
    }
  });
});

describe('arrendamiento residencial', () => {
  it('tiene doce cláusulas de base', () => {
    expect(clausulas(prepararDocumento(entrada('ARRENDAMIENTO_RESIDENCIAL')).bloques)).toHaveLength(12);
  });

  it('la alícuota cambia según quién la paga', () => {
    const texto = (alicuota: string) =>
      clausula(prepararDocumento(entrada('ARRENDAMIENTO_RESIDENCIAL', { alicuota })).bloques, 'alicuotas')!.texto;
    expect(texto('ARRENDATARIO')).toContain('será de cuenta de EL ARRENDATARIO');
    expect(texto('INCLUIDA')).toContain('está incluida en el canon');
    expect(texto('NO_APLICA')).not.toContain('alícuota');
  });

  it('desocupar antes solo cuesta una indemnización si se pactó', () => {
    const plazo = (n: string) =>
      clausula(prepararDocumento(entrada('ARRENDAMIENTO_RESIDENCIAL', { indemnizacionCanones: n })).bloques, 'plazo')!.texto;
    expect(plazo('')).not.toContain('indemnización');
    expect(plazo('0')).not.toContain('indemnización');
    expect(plazo('1')).toContain('1 canon mensual');
  });

  it('una casa sin edificio no pide reglamento interno', () => {
    const doc = prepararDocumento(entrada('ARRENDAMIENTO_RESIDENCIAL', { inmuebleEdificio: '', alicuota: 'NO_APLICA' }));
    expect(doc.texto).not.toContain('reglamento interno');
  });
});

describe('arrendamiento comercial', () => {
  const doc = prepararDocumento(entrada('ARRENDAMIENTO_COMERCIAL'));

  it('conserva las dieciocho cláusulas de la muestra', () => {
    expect(clausulas(doc.bloques)).toHaveLength(18);
  });

  it('corrige el 11.2: quien no tiene reembolso por mejoras es el arrendatario', () => {
    expect(clausula(doc.bloques, 'mejoras')!.texto).toContain('sin derecho a reembolso, indemnización ni retención alguna a favor de EL ARRENDATARIO');
  });

  it('el plazo termina al vencer, sin la renuncia al desahucio en la base', () => {
    const plazo = clausula(doc.bloques, 'plazo')!.texto;
    expect(plazo).toContain('fecha en la cual el contrato terminará.');
    expect(plazo).not.toContain('desahucio');
  });

  it('las referencias entre cláusulas siguen a su cláusula al activar una opcional', () => {
    expect(clausula(doc.bloques, 'plazo')!.texto).toContain('cláusula décima tercera');
    expect(clausula(doc.bloques, 'terminacion')!.texto).toContain('cláusula décima segunda');
    const conDesahucio = prepararDocumento(entrada('ARRENDAMIENTO_COMERCIAL', {}, { 'renuncia-desahucio': true }));
    expect(clausula(conDesahucio.bloques, 'plazo')!.texto).toContain('cláusula décima cuarta');
    expect(clausula(conDesahucio.bloques, 'terminacion')!.texto).toContain('cláusula décima tercera');
  });

  it('la actividad gastronómica es opcional, apagada y sin nota de abogado', () => {
    const gastronomica = doc.clausulas.find((c) => c.clave === 'actividad-gastronomica')!;
    expect(gastronomica.activa).toBe(false);
    expect(gastronomica.opcional?.nota).toBeNull();
    expect(doc.texto).not.toContain('trampas de grasa');
  });

  it('regula las alícuotas que su título nombra', () => {
    expect(clausula(doc.bloques, 'servicios')!.texto).toMatch(/\d+\.3\. Las alícuotas ordinarias/);
  });

  it('la fuerza mayor remite a la ley, sin citar artículos', () => {
    const texto = clausula(doc.bloques, 'fuerza-mayor')!.texto;
    expect(texto).toContain('conforme a la ley');
    expect(texto).not.toMatch(/Código Civil/);
  });
});

describe('arrendamiento industrial', () => {
  const doc = prepararDocumento(entrada('ARRENDAMIENTO_INDUSTRIAL'));

  it('tiene catorce cláusulas de base', () => {
    expect(clausulas(doc.bloques)).toHaveLength(14);
  });

  it('por defecto comparecen dos compañías con su representante legal', () => {
    for (const rol of ['arrendador', 'arrendatario']) {
      const campo = CONTRATO_DEFINICION.ARRENDAMIENTO_INDUSTRIAL.secciones.flatMap((s) => s.campos).find((c) => c.clave === `${rol}_tipoPersona`);
      expect(campo?.porDefecto, rol).toBe('JURIDICA');
    }
    const comparecencia = doc.bloques.find((b) => b.tipo === 'parrafo');
    const texto = comparecencia && 'texto' in comparecencia ? comparecencia.texto : '';
    expect(texto.match(/la compañía/g)).toHaveLength(2);
    expect(texto).toContain('"LA ARRENDADORA"');
    expect(texto).toContain('"LA ARRENDATARIA"');
  });

  it('trae la descripción técnica, el rubro aparte del canon y la insolvencia como causal', () => {
    expect(clausula(doc.bloques, 'objeto')!.texto).toContain('área total cubierta');
    expect(clausula(doc.bloques, 'rubros')!.texto).toContain('por concepto de guardianía, limpieza');
    expect(clausula(doc.bloques, 'terminacion')!.texto).toContain('concurso preventivo');
    expect(clausula(doc.bloques, 'uso')!.texto).toContain('sustancias inflamables o explosivas');
  });

  it('la fuerza mayor tiene sus cinco supuestos', () => {
    const texto = clausula(doc.bloques, 'fuerza-mayor')!.texto;
    for (const letra of ['a)', 'b)', 'c)', 'd)', 'e)']) expect(texto, letra).toContain(`\n${letra} `);
  });

  it('el ingreso de interesados ya no depende de un aviso de desahucio', () => {
    expect(clausula(doc.bloques, 'inspeccion')!.texto).not.toContain('desahucio');
  });

  it('el título y el tribunal arbitral siguen al formulario', () => {
    const galpon = prepararDocumento(entrada('ARRENDAMIENTO_INDUSTRIAL', { tipoInmueble: 'GALPON', numeroArbitros: 'TRES' }));
    const titulo = galpon.bloques.find((b) => b.tipo === 'titulo');
    expect(titulo && 'texto' in titulo ? titulo.texto : '').toBe('CONTRATO DE ARRENDAMIENTO DE GALPÓN');
    expect(clausula(galpon.bloques, 'controversias')!.texto).toContain('con tres árbitros designados');
    const jueces = prepararDocumento(entrada('ARRENDAMIENTO_INDUSTRIAL', { viaControversias: 'JUECES' }));
    expect(clausula(jueces.bloques, 'controversias')!.texto).toContain('jueces competentes');
  });

  it('sin rubro aparte, la cláusula solo habla de los consumos', () => {
    const sinRubro = prepararDocumento(entrada('ARRENDAMIENTO_INDUSTRIAL', { rubroAdicional: '' }));
    expect(clausula(sinRubro.bloques, 'rubros')!.titulo).toBe('SERVICIOS');
  });
});

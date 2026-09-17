import type { BloqueDocumento, OpcionClausula } from './plantillas/base';

// El documento tal como se lee, se imprime y se congela en cada versión, y la
// mecánica del editor de cláusulas que lo produce.
//
// El recorrido es siempre el mismo:
//   plantilla  →  ediciones del agente  →  numeración  →  documento final
//
// La plantilla produce las cláusulas con su texto modelo. Encima se aplica lo
// que el agente decidió: qué opcionales activa, qué textos reescribe, qué
// cláusulas agrega y dónde. Recién entonces se numera, así la numeración y las
// referencias cruzadas salen siempre correlativas, se active o se quite lo que
// se quiera.
//
// Sin imports de servidor: el editor del agente usa estos mismos tipos.

// ---------------------------------------------------------------------------
// Documento final
// ---------------------------------------------------------------------------

// Una línea de firma manuscrita. En una compañía firma su representante, "por"
// la compañía.
export type LineaFirma = {
  calidad: string;
  nombre: string;
  documento: string;
  tipoDocumento: string;
  enRepresentacionDe: { razonSocial: string; ruc: string } | null;
};

export type BloqueFinal =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'aviso'; texto: string }
  // "texto" puede traer varios párrafos separados por salto de línea.
  | { tipo: 'clausula'; clave: string; encabezado: string; titulo: string; texto: string }
  | { tipo: 'ficha'; titulo: string; filas: Array<{ etiqueta: string; valor: string }> }
  | { tipo: 'firmas'; leyenda: string | null; partes: LineaFirma[] };

// Cómo se encabeza una cláusula. Las plantillas retiradas numeraban en romanos y
// así se siguen imprimiendo; las vivas usan ordinales, que es como las nombran
// sus propias referencias ("la cláusula décima tercera").
export type EstiloNumeracion = 'romano' | 'ordinal';

// ---------------------------------------------------------------------------
// Ediciones del agente
// ---------------------------------------------------------------------------

// Se guarda cifrada dentro de los datos del contrato, bajo CLAVE_EDICION.
export type EdicionClausulas = {
  // Texto reescrito por el agente, por clave de cláusula. Queda literal: ya no
  // sigue los cambios del formulario hasta que se restaure.
  textos: Record<string, { titulo: string; texto: string }>;
  // Opcionales que el agente activó o desactivó. Lo que no está aquí usa el
  // valor por defecto de la plantilla.
  activas: Record<string, boolean>;
  // Cláusulas agregadas. "despuesDe" es la clave de la cláusula a continuación
  // de la cual van (puede ser otra agregada); null, al final.
  nuevas: Array<{ id: string; titulo: string; texto: string; despuesDe: string | null }>;
};

export const CLAVE_EDICION = '__clausulas';

export function edicionVacia(): EdicionClausulas {
  return { textos: {}, activas: {}, nuevas: [] };
}

export function hayEdiciones(edicion: EdicionClausulas): boolean {
  return Object.keys(edicion.textos).length > 0 || Object.keys(edicion.activas).length > 0 || edicion.nuevas.length > 0;
}

// Lectura tolerante: un valor corrupto o de otra forma no rompe el documento,
// simplemente no aplica ediciones.
export function leerEdicion(datos: Record<string, string>): EdicionClausulas {
  const bruto = datos[CLAVE_EDICION];
  if (!bruto) return edicionVacia();
  try {
    const e = JSON.parse(bruto) as Partial<EdicionClausulas>;
    const textos: EdicionClausulas['textos'] = {};
    for (const [clave, valor] of Object.entries(e.textos ?? {})) {
      if (valor && typeof valor.titulo === 'string' && typeof valor.texto === 'string') textos[clave] = valor;
    }
    const activas: EdicionClausulas['activas'] = {};
    for (const [clave, valor] of Object.entries(e.activas ?? {})) {
      if (typeof valor === 'boolean') activas[clave] = valor;
    }
    const nuevas = (Array.isArray(e.nuevas) ? e.nuevas : []).filter(
      (n) => n && typeof n.id === 'string' && typeof n.titulo === 'string' && typeof n.texto === 'string',
    );
    return { textos, activas, nuevas };
  } catch {
    return edicionVacia();
  }
}

export function nuevaClaveClausula(): string {
  return `nueva-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Aplicar ediciones
// ---------------------------------------------------------------------------

type ClausulaTrabajo = {
  clase: 'clausula';
  clave: string;
  tituloOriginal: string;
  textoOriginal: string;
  titulo: string;
  texto: string;
  modificada: boolean;
  opcional: OpcionClausula | null;
  activa: boolean;
  nueva: boolean;
};

type ItemTrabajo = { clase: 'bloque'; bloque: Exclude<BloqueDocumento, { tipo: 'clausula' }> } | ClausulaTrabajo;

export function aplicarEdicion(bloques: BloqueDocumento[], edicion: EdicionClausulas): ItemTrabajo[] {
  const usadas = new Set<string>();

  const agregadaComoItem = (n: EdicionClausulas['nuevas'][number]): ClausulaTrabajo => {
    const reescrita = edicion.textos[n.id];
    return {
      clase: 'clausula',
      clave: n.id,
      tituloOriginal: n.titulo,
      textoOriginal: n.texto,
      titulo: reescrita?.titulo ?? n.titulo,
      texto: reescrita?.texto ?? n.texto,
      modificada: false,
      opcional: null,
      activa: true,
      nueva: true,
    };
  };

  // Inserta en "destino" las agregadas que van tras "ancla", y en cadena las que
  // van tras cada una de ellas. "usadas" evita ciclos y duplicados.
  const agregarTras = (ancla: string, destino: ItemTrabajo[]) => {
    for (const n of edicion.nuevas) {
      if (n.despuesDe !== ancla || usadas.has(n.id)) continue;
      usadas.add(n.id);
      destino.push(agregadaComoItem(n));
      agregarTras(n.id, destino);
    }
  };

  const salida: ItemTrabajo[] = [];
  let posicion = 0;
  let trasUltimaClausula = -1;
  for (const b of bloques) {
    if (b.tipo !== 'clausula') {
      salida.push({ clase: 'bloque', bloque: b });
      continue;
    }
    // Las plantillas anteriores al editor no traen clave: se identifican por
    // posición, que en ellas no varía.
    const clave = b.clave ?? `pos-${posicion}`;
    posicion += 1;
    const reescrita = edicion.textos[clave];
    salida.push({
      clase: 'clausula',
      clave,
      tituloOriginal: b.titulo,
      textoOriginal: b.texto,
      titulo: reescrita?.titulo ?? b.titulo,
      texto: reescrita?.texto ?? b.texto,
      modificada: Boolean(reescrita),
      opcional: b.opcional ?? null,
      activa: b.opcional ? (edicion.activas[clave] ?? b.opcional.activaPorDefecto) : true,
      nueva: false,
    });
    agregarTras(clave, salida);
    trasUltimaClausula = salida.length;
  }

  // Las que van al final, o cuya cláusula de referencia ya no existe: tras la
  // última cláusula, antes de las firmas y la ficha.
  const huerfanas: ItemTrabajo[] = [];
  for (const n of edicion.nuevas) {
    if (usadas.has(n.id)) continue;
    usadas.add(n.id);
    huerfanas.push(agregadaComoItem(n));
    agregarTras(n.id, huerfanas);
  }
  if (huerfanas.length > 0) {
    const indice = trasUltimaClausula >= 0 ? trasUltimaClausula : salida.length;
    salida.splice(indice, 0, ...huerfanas);
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Numeración
// ---------------------------------------------------------------------------

const ORDINAL_UNIDADES = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena'];
const ORDINAL_DECENAS = ['', 'décima', 'vigésima', 'trigésima', 'cuadragésima'];

// "décima primera" y no "undécima": es como lo escriben los contratos que se
// usan en el país.
export function ordinal(n: number): string {
  if (n < 10) return ORDINAL_UNIDADES[n] ?? String(n);
  const decena = ORDINAL_DECENAS[Math.floor(n / 10)];
  if (!decena) return String(n);
  const unidad = n % 10;
  return unidad === 0 ? decena : `${decena} ${ORDINAL_UNIDADES[unidad]}`;
}

export function romano(n: number): string {
  const tabla: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let resto = n;
  let salida = '';
  for (const [valor, simbolo] of tabla) {
    while (resto >= valor) {
      salida += simbolo;
      resto -= valor;
    }
  }
  return salida;
}

export const MARCA_REFERENCIA_ROTA = '[ cláusula no incluida ]';

function resolverMarcas(texto: string, propio: number | null, numeros: Map<string, number>): string {
  return texto
    .replace(/\{\{n\}\}/g, propio === null ? '—' : String(propio))
    .replace(/\{\{ref:([\w-]+)\}\}/g, (_, clave: string) => {
      const numero = numeros.get(clave);
      return numero ? ordinal(numero) : MARCA_REFERENCIA_ROTA;
    });
}

function encabezado(estilo: EstiloNumeracion, numero: number, titulo: string): string {
  return estilo === 'ordinal'
    ? `CLÁUSULA ${ordinal(numero).toUpperCase()}.— ${titulo.trim().toUpperCase()}`
    : `${romano(numero)}. ${titulo}:`;
}

function numerosDe(items: ItemTrabajo[]): Map<string, number> {
  const numeros = new Map<string, number>();
  let n = 0;
  for (const item of items) {
    if (item.clase === 'clausula' && item.activa) {
      n += 1;
      numeros.set(item.clave, n);
    }
  }
  return numeros;
}

export function documentoFinal(
  items: ItemTrabajo[],
  estilo: EstiloNumeracion,
  firmas: { leyenda: string | null; partes: LineaFirma[] },
): BloqueFinal[] {
  const numeros = numerosDe(items);
  const salida: BloqueFinal[] = [];
  for (const item of items) {
    if (item.clase === 'clausula') {
      if (!item.activa) continue;
      const numero = numeros.get(item.clave) as number;
      salida.push({
        tipo: 'clausula',
        clave: item.clave,
        encabezado: encabezado(estilo, numero, item.titulo),
        titulo: item.titulo,
        texto: resolverMarcas(item.texto, numero, numeros),
      });
      continue;
    }
    const b = item.bloque;
    if (b.tipo === 'firmas') salida.push({ tipo: 'firmas', leyenda: firmas.leyenda, partes: firmas.partes });
    else if (b.tipo === 'ficha') salida.push({ tipo: 'ficha', titulo: b.titulo, filas: b.filas });
    else salida.push({ tipo: b.tipo, texto: b.texto });
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export type ClausulaEditable = {
  clave: string;
  // null si está desactivada: no ocupa número.
  numero: number | null;
  encabezado: string | null;
  titulo: string;
  texto: string;
  tituloOriginal: string;
  textoOriginal: string;
  modificada: boolean;
  nueva: boolean;
  activa: boolean;
  opcional: { activaPorDefecto: boolean; nota: string | null } | null;
};

export function clausulasParaEditor(items: ItemTrabajo[], estilo: EstiloNumeracion): ClausulaEditable[] {
  const numeros = numerosDe(items);
  return items
    .filter((i): i is ClausulaTrabajo => i.clase === 'clausula')
    .map((c) => {
      const numero = c.activa ? (numeros.get(c.clave) ?? null) : null;
      return {
        clave: c.clave,
        numero,
        encabezado: numero ? encabezado(estilo, numero, c.titulo) : null,
        titulo: c.titulo,
        texto: resolverMarcas(c.texto, numero, numeros),
        tituloOriginal: c.tituloOriginal,
        textoOriginal: resolverMarcas(c.textoOriginal, numero, numeros),
        modificada: c.modificada,
        nueva: c.nueva,
        activa: c.activa,
        opcional: c.opcional ? { activaPorDefecto: c.opcional.activaPorDefecto, nota: c.opcional.nota ?? null } : null,
      };
    });
}

// ---------------------------------------------------------------------------
// Texto plano y comparación entre versiones
// ---------------------------------------------------------------------------

// Texto plano del documento completo. Es sobre lo que se calcula la huella de
// cada versión: incluye la ficha y las líneas de firma, porque si cambiara el
// precio de la ficha o quién comparece, tiene que cambiar la huella.
export function textoPlano(bloques: BloqueFinal[]): string {
  const partes: string[] = [];
  for (const b of bloques) {
    if (b.tipo === 'titulo' || b.tipo === 'subtitulo') partes.push(b.texto.toUpperCase());
    else if (b.tipo === 'parrafo' || b.tipo === 'aviso') partes.push(b.texto);
    else if (b.tipo === 'ficha') partes.push(`${b.titulo.toUpperCase()}\n${b.filas.map((f) => `${f.etiqueta}: ${f.valor}`).join('\n')}`);
    else if (b.tipo === 'clausula') partes.push(`${b.encabezado}\n${b.texto}`);
    else if (b.tipo === 'firmas') {
      partes.push(
        b.partes
          .map((p) =>
            [p.enRepresentacionDe ? `${p.enRepresentacionDe.razonSocial} (RUC ${p.enRepresentacionDe.ruc})` : null, `${p.nombre}, ${p.tipoDocumento} ${p.documento}`, p.calidad]
              .filter(Boolean)
              .join(' · '),
          )
          .join('\n'),
      );
    }
  }
  return partes.join('\n\n');
}

export type CambiosEntreVersiones = {
  modificadas: string[];
  agregadas: string[];
  retiradas: string[];
  // Cambió algo fuera de las cláusulas: la ficha del inmueble o las partes.
  otros: boolean;
};

// Qué cambió de una versión a la siguiente, cláusula por cláusula. Se compara
// por clave y por contenido, no por número: activar una opcional corre la
// numeración de las siguientes, y eso no es un cambio de su texto.
export function compararVersiones(anterior: BloqueFinal[], actual: BloqueFinal[]): CambiosEntreVersiones {
  type C = Extract<BloqueFinal, { tipo: 'clausula' }>;
  const clausulas = (b: BloqueFinal[]) => new Map(b.filter((x): x is C => x.tipo === 'clausula').map((c) => [c.clave, c]));
  const antes = clausulas(anterior);
  const ahora = clausulas(actual);
  const nombre = (c: C) => c.titulo.trim();

  const modificadas: string[] = [];
  const agregadas: string[] = [];
  for (const [clave, c] of ahora) {
    const previa = antes.get(clave);
    if (!previa) agregadas.push(nombre(c));
    else if (previa.titulo !== c.titulo || previa.texto !== c.texto) modificadas.push(nombre(c));
  }
  const retiradas = [...antes.entries()].filter(([clave]) => !ahora.has(clave)).map(([, c]) => nombre(c));

  const resto = (b: BloqueFinal[]) => JSON.stringify(b.filter((x) => x.tipo !== 'clausula'));
  return { modificadas, agregadas, retiradas, otros: resto(anterior) !== resto(actual) };
}

export function sinCambios(c: CambiosEntreVersiones): boolean {
  return c.modificadas.length === 0 && c.agregadas.length === 0 && c.retiradas.length === 0 && !c.otros;
}

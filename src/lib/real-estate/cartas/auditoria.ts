import {
  CARTA_UMBRAL_CIERRES,
  CARTA_UMBRAL_INMUEBLES,
  cierresMencionables,
  inventarioMencionable,
  type CartaBloques,
  type CartaDatosAgente,
} from './tipos';
import type { TratoDestinatario } from './saludo';

// Red de seguridad contra la invención, DESPUÉS del modelo.
//
// El prompt pide no inventar. Eso no basta: un prompt es una petición, no una
// garantía, y el caso que más duele es justo el más tentador para el modelo,
// el agente que todavía no tiene nada que presumir. Una carta que le atribuya
// "amplia trayectoria" a quien lleva dos cierres es peor que no tener la
// función: el destinatario puede comprobarlo y el que queda expuesto es el
// agente, con su nombre en el papel.
//
// Esto NO reescribe ni censura. Devuelve hallazgos. Quien llama decide, y hoy
// la decisión es darle al modelo una segunda oportunidad y, si insiste, caer al
// borrador de plantilla, que es determinista y no puede inventar nada.
//
// DE DÓNDE SALE CADA CIFRA. Cada número se valida contra SU fuente, no contra
// una bolsa común de números permitidos. La versión anterior usaba una bolsa, y
// eso dejaba pasar "3 años de experiencia" solo porque el agente tenía 3
// cierres. Hay tres fuentes y no son intercambiables:
//   - Plataforma: cierres, inmuebles activos, años en Redinmo. Los mide Redinmo.
//   - Declarado: años de experiencia en el sector. Lo escribió el agente en su
//     carnet y Redinmo NO lo verifica. Se admite porque es la palabra de quien
//     firma, pero solo el número exacto: ni "más de", ni redondeos.
//   - Nada: clientes atendidos, proyectos, premios. No existen en los datos,
//     así que cualquier cifra de esas es inventada.

// Adjetivos y frases que afirman una trayectoria. Se buscan siempre: ninguno
// de estos es un dato que el agente entregue, así que ninguno puede salir de
// los hechos verificables.
const FRASES_DE_TRAYECTORIA = [
  'amplia trayectoria',
  'amplia experiencia',
  'vasta experiencia',
  'larga trayectoria',
  'larga experiencia',
  'extensa experiencia',
  'consolidad', // consolidado, consolidada
  'reconocid', // reconocido, reconocida
  'prestigios',
  'referente',
  'líder del mercado',
  'lider del mercado',
  'el mejor',
  'la mejor',
  'número uno',
  'numero uno',
  'cientos de',
  'miles de',
  'premiad',
  'galardon',
  'certific', // certificado, certificacion, certificaciones
  'experto en',
  'especialista reconocido',
  'trayectoria comprobada',
  'probada trayectoria',
  'exitos',
  'éxitos',
  // Años sin cifra: afirman experiencia larga sin decir cuánta, así que ni
  // siquiera con años declarados tienen respaldo.
  'muchos años',
  'varios años',
  'década',
  'decada',
  'larga data',
];

// Palabras que anuncian un número de volumen. Solo se usan para los números
// que no quedaron ligados a un sustantivo, y solo para no marcar un teléfono o
// un código postal.
const CONTEXTO_DE_VOLUMEN = ['inmueble', 'propiedad', 'cierre', 'venta', 'operacion', 'cliente', 'transacc', 'proyecto', 'unidad', 'cartera'];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ---- Números escritos en letras ----------------------------------------------
// "quince años" o "tres cierres" son exactamente igual de afirmativos que "15
// años" o "3 cierres". Un auditor que solo mira dígitos no los ve, y el modelo
// escribe cifras en letras con mucha frecuencia.
const UNIDADES: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, cien: 100,
};
const DECENAS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };

type Categoria = 'anios' | 'cierres' | 'inmuebles' | 'sin_fuente';

const SUSTANTIVOS: Array<[RegExp, Categoria]> = [
  [/^(anos?|anios?)$/, 'anios'],
  [/^(cierres?|operaciones|operacion|transacciones|transaccion|negociaciones|negociacion|ventas?)$/, 'cierres'],
  [
    /^(inmuebles?|propiedades|propiedad|departamentos?|casas?|oficinas?|locales|local|terrenos?|bodegas?|suites?|unidades|unidad|lotes?|galpones|galpon|edificios?|consultorios?)$/,
    'inmuebles',
  ],
  [/^(clientes?|familias?|compradores?|propietarios?|inversionistas?|proyectos?|urbanizaciones|desarrollos?)$/, 'sin_fuente'],
];

const VERBOS_DE_POSESION = new Set([
  'tengo', 'manejo', 'cuento', 'dispongo', 'represento', 'registrado', 'cerrado', 'concretado', 'realizado', 'logrado',
  'llevo', 'administro', 'gestiono', 'vendido', 'sumo', 'acumulo',
]);

// Palabras que, delante de la cifra, la inflan aunque el número sea el real.
const INFLADORES = new Set(['mas', 'casi', 'cerca', 'alrededor', 'aproximadamente', 'unos', 'unas', 'hasta', 'superior', 'mayor']);

type Cantidad = { valor: number; categoria: Categoria; inflada: boolean; posicion: number };

function extraerCantidades(texto: string): Cantidad[] {
  const tokens = [...texto.matchAll(/[a-z0-9ñ]+/g)].map((m) => ({ t: m[0], i: m.index ?? 0 }));
  const salida: Cantidad[] = [];

  for (let k = 0; k < tokens.length; k += 1) {
    const { t, i } = tokens[k];
    let valor: number | null = null;
    let fin = k;

    if (/^\d{1,6}$/.test(t)) {
      valor = Number(t);
    } else if (t in DECENAS) {
      valor = DECENAS[t];
      // "treinta y un cierres"
      if (tokens[k + 1]?.t === 'y' && tokens[k + 2] && tokens[k + 2].t in UNIDADES && UNIDADES[tokens[k + 2].t] < 10) {
        valor += UNIDADES[tokens[k + 2].t];
        fin = k + 2;
      }
    } else if (t in UNIDADES) {
      // "Un" y "una" casi siempre son articulos: "la venta de una propiedad" no
      // declara nada. Solo cuentan como cifra detras de un verbo que afirma lo
      // que el agente tiene o hizo: "cuento con un cierre", "llevo un año".
      if (t === 'un' || t === 'una' || t === 'uno') {
        const antes = tokens.slice(Math.max(0, k - 3), k).map((x) => x.t);
        if (!antes.some((p) => VERBOS_DE_POSESION.has(p))) continue;
      }
      valor = UNIDADES[t];
    }
    if (valor === null) continue;

    // El sustantivo va pegado a la cifra en castellano: "15 años", "tres
    // cierres". Mirar más lejos liga números que no tienen nada que ver ("desde
    // 2023 trabajo con inmuebles").
    const siguiente = tokens[fin + 1]?.t;
    if (!siguiente) continue;
    const categoria = SUSTANTIVOS.find(([patron]) => patron.test(siguiente))?.[1];
    if (!categoria) continue;

    const previas = tokens.slice(Math.max(0, k - 2), k).map((x) => x.t);
    salida.push({ valor, categoria, inflada: previas.some((p) => INFLADORES.has(p)), posicion: i });
    k = fin;
  }
  return salida;
}

export type ContextoAuditoria = {
  // Lo que escribió el agente sobre cómo conoce al destinatario. Sin él, la
  // carta no puede aludir a ningún encuentro previo.
  contexto?: string | null;
  trato?: TratoDestinatario;
  nombreDestinatario?: string;
};

export type Hallazgo = string;

export function auditarInvencion(bloques: CartaBloques, datos: CartaDatosAgente, ctx: ContextoAuditoria = {}): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const conCierres = cierresMencionables(datos);
  const conInventario = inventarioMencionable(datos);
  const declarados = datos.aniosExperienciaDeclarados;
  const tieneContexto = Boolean(ctx.contexto?.trim());

  for (const [clave, original] of Object.entries(bloques)) {
    const texto = normalizar(original);
    if (!texto.trim()) continue;

    for (const frase of FRASES_DE_TRAYECTORIA) {
      if (texto.includes(normalizar(frase))) {
        hallazgos.push(`${clave}: afirmación de trayectoria no respaldada ("${frase}")`);
      }
    }

    // ---- Cifras ligadas a un sustantivo, cada una contra su fuente ----
    const ligadas = new Set<number>();
    for (const c of extraerCantidades(texto)) {
      ligadas.add(c.posicion);
      const cita = `"${c.valor}"`;

      if (c.categoria === 'anios') {
        // Solo la misma frase corta: en "15 años de experiencia en el sector y
        // tres cierres en la plataforma", la plataforma es de los cierres, no
        // de los años. Se corta en la coma, el punto y la "y". El punto solo
        // cuando termina una frase: el de "Redinmo.io" no corta nada.
        const corte = /[,;]|\.(?:\s|$)| y /;
        const antes = texto.slice(Math.max(0, c.posicion - 40), c.posicion).split(corte).pop() ?? '';
        const despues = texto.slice(c.posicion, c.posicion + 45).split(corte)[0];
        const hablaDeRedinmo = /redinmo|plataforma/.test(antes + ' ' + despues);
        if (hablaDeRedinmo) {
          if (c.valor !== datos.aniosEnRedinmo || datos.aniosEnRedinmo < 1) {
            hallazgos.push(`${clave}: cifra de años en Redinmo ${cita} no coincide con los datos de la plataforma (${datos.aniosEnRedinmo})`);
          }
        } else if (declarados === null) {
          hallazgos.push(`${clave}: cifra de años de experiencia ${cita} sin respaldo: el agente no declaró años de experiencia`);
        } else if (c.valor !== declarados) {
          hallazgos.push(`${clave}: cifra de años de experiencia ${cita} no coincide con los ${declarados} que declaró el agente`);
        }
      } else if (c.categoria === 'cierres') {
        if (!conCierres) {
          hallazgos.push(`${clave}: menciona ${cita} cierres u operaciones; por debajo de ${CARTA_UMBRAL_CIERRES} la cifra no respalda y no se menciona`);
        } else if (c.valor !== datos.cierresRegistrados) {
          hallazgos.push(`${clave}: cifra de cierres ${cita} no coincide con los ${datos.cierresRegistrados} registrados`);
        }
      } else if (c.categoria === 'inmuebles') {
        const reales = new Set([datos.inmueblesActivos, ...datos.composicionInventario.map((x) => x.cantidad)]);
        if (!conInventario) {
          hallazgos.push(`${clave}: menciona ${cita} inmuebles; por debajo de ${CARTA_UMBRAL_INMUEBLES} la cartera no se cuantifica`);
        } else if (!reales.has(c.valor)) {
          hallazgos.push(`${clave}: cifra de inmuebles ${cita} no viene de la cartera real`);
        }
      } else {
        hallazgos.push(`${clave}: cifra ${cita} de clientes o proyectos; ese dato no existe en la plataforma`);
      }

      // El número puede ser el real y aun así estar inflado.
      if (c.inflada) {
        hallazgos.push(`${clave}: infla la cifra ${cita} con "más de", "casi" o similar; se escribe el número exacto o nada`);
      }
    }

    // ---- Años de experiencia sin cifra ----
    if (declarados === null && /\banos de experiencia\b|\bexperiencia de anos\b/.test(texto)) {
      hallazgos.push(`${clave}: habla de años de experiencia y el agente no los declaró`);
    }

    // ---- Números sueltos en contexto de volumen ----
    // Red más gruesa para lo que no quedó ligado a un sustantivo ("mi cartera
    // suma 30"). Aquí sí sirve una lista de permitidos, porque el número no
    // dice a qué se refiere.
    const permitidas = new Set<number>([datos.anioIngreso, new Date().getFullYear()]);
    // La licencia es un identificador, no una cifra de volumen: "licencia
    // número 3156" cerca de la palabra "ventas" no afirma 3156 ventas.
    for (const m of (datos.licencia ?? '').matchAll(/\d+/g)) permitidas.add(Number(m[0]));
    if (datos.aniosEnRedinmo >= 1) permitidas.add(datos.aniosEnRedinmo);
    if (declarados !== null) permitidas.add(declarados);
    if (conCierres) permitidas.add(datos.cierresRegistrados);
    if (conInventario) {
      permitidas.add(datos.inmueblesActivos);
      for (const c of datos.composicionInventario) permitidas.add(c.cantidad);
    }
    for (const m of texto.matchAll(/\b(\d{1,6})\b/g)) {
      if (ligadas.has(m.index ?? -1)) continue;
      const valor = Number(m[1]);
      if (permitidas.has(valor)) continue;
      const desde = Math.max(0, (m.index ?? 0) - 40);
      const ventana = texto.slice(desde, (m.index ?? 0) + m[1].length + 40);
      if (CONTEXTO_DE_VOLUMEN.some((p) => ventana.includes(p))) {
        hallazgos.push(`${clave}: cifra "${valor}" no viene de los datos entregados`);
      }
    }

    // ---- Volumen bajo dicho sin cifras ----
    // Decir "no manejo inmuebles activos" o "cuento con cierres registrados" es
    // tan revelador como decir la cifra: el destinatario saca la misma
    // conclusión.
    if (!conCierres) {
      const CIERRES_ESCASOS: Array<[RegExp, string]> = [
        [/\bcierres?\s+registrados?\b/, 'menciona cierres registrados'],
        [/\bcierres?\s+en\s+(la\s+plataforma|redinmo)\b/, 'menciona sus cierres en la plataforma'],
        [/\b(he|ha)\s+(registrado|concretado|cerrado|realizado)\b[^.]{0,40}\b(cierres?|operaciones|ventas|transacciones)\b/, 'declara sus cierres'],
        [/\b(varios|varias|algunos|algunas|pocos|pocas|numerosos|numerosas|multiples|diversas)\s+(cierres|operaciones|ventas|transacciones)\b/, 'cuantifica sus cierres sin cifra'],
        [/\bnivel\s+(inicial|basico|principiante)\b/, 'declara un nivel bajo'],
        [/\b(estoy|voy)\s+(comenzando|empezando|iniciando)\b/, 'se presenta como principiante'],
      ];
      for (const [patron, motivo] of CIERRES_ESCASOS) {
        if (patron.test(texto)) hallazgos.push(`${clave}: ${motivo}, con menos de ${CARTA_UMBRAL_CIERRES} cierres no se menciona`);
      }
      // El nivel de la plataforma ("Agente Activo") solo significa algo
      // dentro de Redinmo; afuera se lee como un rango inflado.
      // Solo niveles de dos palabras o mas: "Inicial" suelto aparece en frases
      // que no tienen nada que ver ("una reunion inicial").
      const nivel = normalizar(datos.nivel).trim();
      if (nivel.includes(' ') && texto.includes(nivel)) {
        hallazgos.push(`${clave}: menciona el nivel de la plataforma ("${datos.nivel}")`);
      }
    }

    if (!conInventario) {
      // "Represento su propiedad" o "un manejo profesional de su inmueble"
      // hablan del inmueble DEL DESTINATARIO, no de la cartera del agente. Sin
      // esta excepcion, casi toda carta a un propietario caia a la plantilla.
      const DECLARA_CARTERA =
        /\b(cuento con|tengo|manejo|represento|mi cartera)\b([^.]{0,60}?)\b(inmuebles?|propiedad|propiedades|unidades|departamentos?|casas?|oficinas?|locales?|terrenos?)\b/g;
      for (const m of texto.matchAll(DECLARA_CARTERA)) {
        const delDestinatario = /\b(su|sus|suya|suyo|usted|ustedes)\b/.test(m[2]);
        const esSustantivo = /\b(un|el|del|buen)\s+$/.test(texto.slice(Math.max(0, (m.index ?? 0) - 6), m.index));
        if (!delDestinatario && !esSustantivo) {
          hallazgos.push(`${clave}: declara su cartera, con menos de ${CARTA_UMBRAL_INMUEBLES} inmuebles no se menciona`);
          break;
        }
      }
      const INVENTARIO_ESCASO: Array<[RegExp, string]> = [
        [/\b(no|sin)\s+(manejo|tengo|cuento con|dispongo de)\b/, 'niega tener cartera'],
        [/\binmuebles?\s+activos?\b/, 'menciona inmuebles activos'],
        [/\bcartera\s+(esta\s+)?(pequena|chica|reducida|limitada|compuesta)\b/, 'describe el tamaño de su cartera'],
        [/\b(varios|varias|algunos|algunas|pocos|pocas|numerosos|numerosas|diversos|diversas)\s+(inmuebles|propiedades|departamentos|casas|oficinas|locales)\b/, 'cuantifica su cartera sin cifra'],
      ];
      for (const [patron, motivo] of INVENTARIO_ESCASO) {
        if (patron.test(texto)) hallazgos.push(`${clave}: ${motivo}, con menos de ${CARTA_UMBRAL_INMUEBLES} inmuebles no se menciona`);
      }
    }

    // ---- Tercera persona ----
    // La carta la firma el agente. "Daniela Ordóñez se dedica a..." la
    // convierte en una ficha escrita por otro.
    const nombreAgente = normalizar(datos.nombre).trim();
    if (nombreAgente && new RegExp(`\\b${escaparRegex(nombreAgente)}\\s+(se\\s+dedica|es\\s|opera|trabaja|cuenta|forma\\s+parte|ofrece)`).test(texto)) {
      hallazgos.push(`${clave}: habla del agente en tercera persona; la carta la firma el propio agente`);
    }

    // ---- Encuentro previo inventado ----
    if (!tieneContexto) {
      const ENCUENTRO = /\bnuestra\s+(conversacion|reunion|charla|llamada)\b|\b(como|segun lo)\s+(conversamos|hablamos|quedamos|acordamos)\b|\bnos\s+conocimos\b|\b(tuvimos|mantuvimos)\s+(la\s+oportunidad|una\s+conversacion|una\s+reunion)\b|\bnuestro\s+(encuentro|contacto)\b|\bvolver\s+a\s+saludarl/;
      if (ENCUENTRO.test(texto)) {
        hallazgos.push(`${clave}: alude a un encuentro previo que el agente no escribió en el contexto`);
      }
    }

    // ---- Concordancia con el saludo ----
    // Si la carta abre con "Estimada", no puede seguir con "acompañarlo".
    if (ctx.trato) {
      const femenino = /\b(saludarla|acompanarla|atenderla)\b/.test(texto);
      const masculino = /\b(saludarlo|acompanarlo|atenderlo)\b/.test(texto);
      const choca =
        (ctx.trato === 'femenino' && masculino) ||
        (ctx.trato === 'masculino' && femenino) ||
        ((ctx.trato === 'indeterminado' || ctx.trato === 'empresa') && (femenino || masculino));
      if (choca) {
        hallazgos.push(`${clave}: el género del texto no concuerda con el saludo (${ctx.trato})`);
      }
    }
  }

  // ---- Estructura de la apertura ----
  const apertura = bloques.apertura?.trim() ?? '';
  if (!tieneContexto && apertura) {
    hallazgos.push('apertura: tiene texto aunque el agente no escribió contexto; la carta empieza por la presentación');
  }
  for (const clave of ['saludo', 'apertura'] as const) {
    if (/[()]/.test(bloques[clave] ?? '')) {
      hallazgos.push(`${clave}: usa paréntesis; en una carta formal se leen como una nota provisional`);
    }
  }
  for (const clave of ['apertura', 'presentacion'] as const) {
    const inicio = normalizar(bloques[clave] ?? '').trim().slice(0, 60);
    if (!inicio) continue;
    if (/\bestimad/.test(inicio)) {
      hallazgos.push(`${clave}: repite la fórmula de saludo, que ya va en su propia línea`);
      continue;
    }
    // Con una empresa no se mira: "Constructora" al empezar un parrafo no es
    // repetir el saludo.
    const primerNombre =
      ctx.nombreDestinatario && ctx.trato !== 'empresa' ? normalizar(nombreDePila(ctx.nombreDestinatario)) : '';
    if (primerNombre.length >= 3 && new RegExp(`\\b${escaparRegex(primerNombre)}\\b`).test(inicio)) {
      hallazgos.push(`${clave}: vuelve a nombrar al destinatario al empezar; el nombre ya está en el saludo`);
    }
  }

  return [...new Set(hallazgos)];
}

// Los nombres los escribe una persona: un apóstrofo o un paréntesis no pueden
// romper la expresión regular.
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Primer nombre sin títulos: "Ing. Gabriela Muñoz" -> "Gabriela".
function nombreDePila(nombre: string): string {
  const palabras = nombre.replace(/[^\p{L}\s.]/gu, ' ').split(/\s+/).filter(Boolean);
  const sinTitulos = palabras.filter((p) => !p.endsWith('.') && !/^(sr|sra|srta|ing|dr|dra|arq|abg|lcdo|lcda|lic|econ|mgs)$/i.test(p));
  return sinTitulos[0] ?? '';
}

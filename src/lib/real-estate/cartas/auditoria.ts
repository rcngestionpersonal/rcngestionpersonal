import { inventarioEsEscaso, type CartaBloques, type CartaDatosAgente } from './tipos';

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
// la decisión es caer al borrador de plantilla, que es determinista y no puede
// inventar nada.

// Adjetivos y frases que afirman una trayectoria. Se buscan siempre: ninguno
// de estos es un dato que el agente entregue, así que ninguno puede salir de
// los hechos verificables.
const FRASES_DE_TRAYECTORIA = [
  'amplia trayectoria',
  'amplia experiencia',
  'vasta experiencia',
  'larga trayectoria',
  'extensa experiencia',
  'años de experiencia en el mercado',
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
];

// Palabras que anuncian un número de volumen. Solo se miran los números que
// aparecen cerca de estas, para no marcar un código postal o un año.
const CONTEXTO_DE_VOLUMEN = [
  'inmueble',
  'propiedad',
  'cierre',
  'venta',
  'operacion',
  'operación',
  'cliente',
  'transacc',
  'año',
  'anio',
  'proyecto',
  'unidad',
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Los números que el agente SÍ entregó. Cualquier otro número en contexto de
// volumen es una cifra que el modelo se sacó de la manga.
function cifrasPermitidas(datos: CartaDatosAgente): Set<number> {
  const permitidas = new Set<number>([
    datos.inmueblesActivos,
    datos.cierresRegistrados,
    datos.aniosEnRedinmo,
    datos.anioIngreso,
  ]);
  if (datos.aniosDeExperiencia) permitidas.add(datos.aniosDeExperiencia);
  for (const c of datos.composicionInventario) permitidas.add(c.cantidad);
  // El año en curso aparece de forma legítima al fechar la carta.
  permitidas.add(new Date().getFullYear());
  return permitidas;
}

export type Hallazgo = string;

export function auditarInvencion(bloques: CartaBloques, datos: CartaDatosAgente): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const escaso = inventarioEsEscaso(datos);
  const permitidas = cifrasPermitidas(datos);

  for (const [clave, original] of Object.entries(bloques)) {
    const texto = normalizar(original);
    if (!texto.trim()) continue;

    for (const frase of FRASES_DE_TRAYECTORIA) {
      if (texto.includes(normalizar(frase))) {
        hallazgos.push(`${clave}: afirmación de trayectoria no respaldada ("${frase}")`);
      }
    }

    // Cifras en contexto de volumen. Se recorre número a número y se mira la
    // ventana de texto a su alrededor, que es donde estaría la palabra que le
    // da sentido.
    for (const m of texto.matchAll(/\b(\d{1,6})\b/g)) {
      const valor = Number(m[1]);
      if (permitidas.has(valor)) continue;
      const desde = Math.max(0, (m.index ?? 0) - 40);
      const ventana = texto.slice(desde, (m.index ?? 0) + m[1].length + 40);
      if (CONTEXTO_DE_VOLUMEN.some((p) => ventana.includes(normalizar(p)))) {
        hallazgos.push(`${clave}: cifra "${valor}" no viene de los datos entregados`);
      }
    }

    // Con cartera chica, el volumen no se menciona de NINGUNA forma: ni el
    // numero, ni en letras, ni en singular, ni en negativo. Decir "no manejo
    // inmuebles activos" o "cuento con un cierre" es tan revelador como decir
    // la cifra, y el destinatario saca la misma conclusion.
    if (escaso) {
      const VOLUMEN_ESCASO: Array<[RegExp, string]> = [
        [/\b(no|sin)\s+(manejo|tengo|cuento con|dispongo de)\b/, 'niega tener cartera'],
        [/\b(cuento con|tengo|manejo|represento|mi cartera)\b[^.]{0,60}\b(cierre|inmueble|propiedad|unidad)/, 'declara su volumen'],
        [/\b(un|una|dos|tres|1|2|3)\s+(cierre|inmueble|propiedad|departamento|casa|oficina)/, 'da una cantidad concreta'],
        [/\binmuebles?\s+activos?\b/, 'menciona inmuebles activos'],
        [/\bcierres?\s+registrados?\b/, 'menciona cierres registrados'],
        [/\bnivel\s+(inicial|basico|principiante)\b/, 'declara un nivel bajo'],
        [/\b(estoy|voy)\s+(comenzando|empezando|iniciando)\b/, 'se presenta como principiante'],
        [/\bcartera\s+(pequena|chica|reducida|limitada)\b/, 'califica su cartera de pequeña'],
      ];
      for (const [patron, motivo] of VOLUMEN_ESCASO) {
        if (patron.test(texto)) hallazgos.push(`${clave}: ${motivo}, con cartera escasa no se menciona`);
      }
    }
  }

  return [...new Set(hallazgos)];
}

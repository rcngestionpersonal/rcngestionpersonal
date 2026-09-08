// Cartas de presentacion (Fase 4). Tipos y configuracion compartidos entre
// cliente y servidor: sin imports de Prisma ni del SDK del modelo, para que la
// pantalla del agente pueda importar esto sin arrastrar el backend.

export const CARTA_DESTINATARIOS = ['PROPIETARIO', 'COLEGA', 'CONSTRUCTORA', 'EMPRESA'] as const;
export type CartaDestinatarioTipo = (typeof CARTA_DESTINATARIOS)[number];

// Cada destinatario cambia el ENFOQUE del texto, no solo el saludo. El
// `enfoque` viaja al prompt tal cual: es la unica instruccion de contenido que
// distingue una carta de otra, asi que esta escrito como una orden concreta y
// no como una etiqueta.
export const CARTA_DESTINATARIO_CONFIG: Record<
  CartaDestinatarioTipo,
  { titulo: string; descripcion: string; asunto: string; fraseApertura: string; enfoque: string }
> = {
  PROPIETARIO: {
    titulo: 'Propietario',
    descripcion: 'Por qué confiarme la venta de su inmueble.',
    asunto: 'Propuesta para la venta de su inmueble',
    fraseApertura: 'Le escribo para proponerle acompañarlo en la venta de su inmueble.',
    enfoque:
      'El destinatario es el dueño de un inmueble que evalua a quien confiarselo. Argumenta por que este agente es una buena eleccion para gestionarlo: metodo de trabajo, conocimiento de sus zonas y seriedad. No prometas precio ni plazo de venta.',
  },
  COLEGA: {
    titulo: 'Colega o inmobiliaria',
    descripcion: 'Propuesta de colaboración entre profesionales.',
    asunto: 'Propuesta de colaboración profesional',
    fraseApertura: 'Le escribo para proponerle que trabajemos juntos compartiendo cartera y comisión.',
    enfoque:
      'El destinatario es otro agente o una inmobiliaria. Propon colaborar compartiendo cartera y comision. Habla de igual a igual, sin vender servicios: el valor esta en que las carteras se complementen.',
  },
  CONSTRUCTORA: {
    titulo: 'Constructora o promotora',
    descripcion: 'Propuesta para comercializar su proyecto.',
    asunto: 'Propuesta para la comercialización de su proyecto',
    fraseApertura: 'Le escribo para proponerle sumarme a la comercialización de su proyecto.',
    enfoque:
      'El destinatario desarrolla proyectos inmobiliarios. Propon comercializar unidades: capacidad de colocacion, zonas donde ya opera y como trabaja la venta. No inventes volumenes de ventas ni proyectos anteriores.',
  },
  EMPRESA: {
    titulo: 'Empresa',
    descripcion: 'Enfoque en inventario comercial y corporativo.',
    asunto: 'Servicios inmobiliarios corporativos',
    fraseApertura: 'Le escribo para ponerme a disposición de su empresa en la búsqueda de oficinas, locales o bodegas.',
    enfoque:
      'El destinatario es una empresa que necesita oficinas, locales o bodegas. Enfocate en inventario comercial y corporativo y en entender requerimientos de espacio. No hables de vivienda salvo que el inventario real sea solo residencial, en cuyo caso ofrece buscar lo que necesiten.',
  },
};

// Los seis bloques del punto 2.4, en orden. El texto se guarda y se edita por
// bloque para que "regenerar este parrafo" no rehaga la carta entera.
export const CARTA_BLOQUES = ['saludo', 'presentacion', 'experiencia', 'inventario', 'propuesta', 'cierre'] as const;
export type CartaBloqueClave = (typeof CARTA_BLOQUES)[number];

export type CartaBloques = Record<CartaBloqueClave, string>;

// Que se le pide a cada bloque. Va al prompt y tambien describe el bloque en
// la pantalla de edicion, para que el agente sepa que esperar de cada uno.
export const CARTA_BLOQUE_INSTRUCCION: Record<CartaBloqueClave, string> = {
  saludo: 'Una sola linea de saludo formal al destinatario por su nombre. Sin "Estimado/a" generico si tienes el nombre.',
  presentacion: 'Quien es el agente, a que se dedica y en que zonas opera. Dos o tres frases.',
  experiencia:
    'El respaldo verificable: solo los numeros que vienen en los datos. Si un dato es bajo o es cero, NO lo menciones y habla de la especialidad. Dos o tres frases.',
  inventario: 'Que tipo de inmuebles maneja hoy, segun la composicion real de su cartera. Dos frases.',
  propuesta: 'La propuesta concreta para este destinatario, segun el enfoque indicado. Tres o cuatro frases.',
  cierre: 'Cierre breve invitando a conversar. Una o dos frases. Sin firma: la firma la pone el documento.',
};

export const CARTA_PALETAS = ['clara', 'oscura'] as const;
export type CartaPaleta = (typeof CARTA_PALETAS)[number];

export const CARTA_IMAGEN_TIPOS = ['foto', 'logo'] as const;
export type CartaImagenTipo = (typeof CARTA_IMAGEN_TIPOS)[number];

// Tope mensual de llamadas al modelo por agente (punto 2.6). Cuenta tanto la
// generacion de una carta completa como la de un parrafo suelto: las dos
// cuestan tokens, y contar solo las cartas dejaria la puerta abierta a gastar
// el presupuesto regenerando parrafos.
export const CARTA_LIMITE_MENSUAL = 30;

// Umbrales por debajo de los cuales la carta NO habla de volumen y la pantalla
// muestra el aviso del punto 2.3. Son bajos a proposito: el objetivo es que el
// texto nunca suene a trayectoria inflada, no que el agente se sienta juzgado.
export const CARTA_UMBRAL_CIERRES = 3;
export const CARTA_UMBRAL_INMUEBLES = 3;

// Los datos REALES con los que se arma el texto. Es exactamente lo que viaja
// al modelo: si un dato no esta aca, el modelo no puede afirmarlo.
export type CartaDatosAgente = {
  nombre: string;
  empresa: string | null;
  aniosEnRedinmo: number;
  anioIngreso: number;
  nivel: string;
  zonas: string[];
  especialidad: string;
  inmueblesActivos: number;
  composicionInventario: Array<{ tipo: string; cantidad: number }>;
  cierresRegistrados: number;
  aniosDeExperiencia: number | null;
  licencia: string | null;
  verificado: boolean;
};

// Si la cartera todavia es chica, el texto se apoya en especialidad y zonas y
// no menciona volumen (punto 2.3). Se calcula en un solo lugar para que la
// pantalla y el prompt no puedan discrepar.
export function inventarioEsEscaso(datos: Pick<CartaDatosAgente, 'cierresRegistrados' | 'inmueblesActivos'>): boolean {
  return datos.cierresRegistrados < CARTA_UMBRAL_CIERRES || datos.inmueblesActivos < CARTA_UMBRAL_INMUEBLES;
}

export function esDestinatarioValido(valor: unknown): valor is CartaDestinatarioTipo {
  return typeof valor === 'string' && (CARTA_DESTINATARIOS as readonly string[]).includes(valor);
}

export function esBloqueValido(valor: unknown): valor is CartaBloqueClave {
  return typeof valor === 'string' && (CARTA_BLOQUES as readonly string[]).includes(valor);
}

// Normaliza lo que viene de la base (Json) a los seis bloques, sin confiar en
// que el registro guardado tenga exactamente las claves esperadas.
export function normalizarBloques(valor: unknown): CartaBloques {
  const fuente = (valor ?? {}) as Record<string, unknown>;
  const salida = {} as CartaBloques;
  for (const clave of CARTA_BLOQUES) {
    const texto = fuente[clave];
    salida[clave] = typeof texto === 'string' ? texto : '';
  }
  return salida;
}

export function bloquesATexto(bloques: CartaBloques): string {
  return CARTA_BLOQUES.map((c) => bloques[c].trim())
    .filter(Boolean)
    .join('\n\n');
}

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
  {
    titulo: string;
    descripcion: string;
    asunto: string;
    fraseApertura: string;
    // Como sigue la propuesta despues de la apertura, y como cierra la carta.
    // Son del modo plantilla: le dan a cada destinatario un cuerpo propio en
    // vez de una frase generica igual para los cuatro.
    argumento: string;
    cierre: string;
    enfoque: string;
  }
> = {
  PROPIETARIO: {
    titulo: 'Propietario',
    descripcion: 'Por qué confiarme la venta de su inmueble.',
    asunto: 'Propuesta para la venta de su inmueble',
    // "acompañarle" y no "acompañarlo": el destinatario puede ser una mujer, y
    // la carta ya la saludo con "Estimada".
    fraseApertura: 'Le escribo para proponerle acompañarle en la venta de su inmueble.',
    argumento:
      'Trabajo con un número acotado de propiedades a la vez, para poder atender cada una de verdad: fotos y ficha cuidadas, filtro previo de los interesados y un reporte suyo de lo que va pasando. Antes de hablar de precio prefiero ver el inmueble y entender su situación.',
    cierre:
      'Si le interesa, puedo pasar a conocer el inmueble sin ningún compromiso y darle mi lectura del mercado en su sector. Quedo atento.',
    enfoque:
      'El destinatario es el dueño de un inmueble que evalua a quien confiarselo. Argumenta por que este agente es una buena eleccion para gestionarlo: metodo de trabajo, conocimiento de sus zonas y seriedad. No prometas precio ni plazo de venta.',
  },
  COLEGA: {
    titulo: 'Colega o inmobiliaria',
    descripcion: 'Propuesta de colaboración entre profesionales.',
    asunto: 'Propuesta de colaboración profesional',
    fraseApertura: 'Le escribo para proponerle que trabajemos juntos compartiendo cartera y comisión.',
    argumento:
      'La idea es simple: cuando usted tenga un cliente que yo pueda resolver con mi cartera, o al revés, lo trabajamos en conjunto y repartimos la comisión en los términos que acordemos. Cada uno conserva su relación con su cliente.',
    cierre:
      'Si le hace sentido, coordinemos una llamada corta para ver en qué se cruzan nuestras carteras. Quedo atento.',
    enfoque:
      'El destinatario es otro agente o una inmobiliaria. Propon colaborar compartiendo cartera y comision. Habla de igual a igual, sin vender servicios: el valor esta en que las carteras se complementen.',
  },
  CONSTRUCTORA: {
    titulo: 'Constructora o promotora',
    descripcion: 'Propuesta para comercializar su proyecto.',
    asunto: 'Propuesta para la comercialización de su proyecto',
    fraseApertura: 'Le escribo para proponerle sumarme a la comercialización de su proyecto.',
    argumento:
      'Puedo aportar el trabajo de calle que un proyecto necesita: seguimiento uno a uno de cada interesado, coordinación de visitas en obra y reporte periódico de cómo avanza la colocación. Me adapto a las condiciones comerciales que ya tengan definidas.',
    cierre:
      'Si están abiertos a sumar fuerza comercial, me gustaría conocer el proyecto y conversarlo. Quedo atento.',
    enfoque:
      'El destinatario desarrolla proyectos inmobiliarios. Propon comercializar unidades: capacidad de colocacion, zonas donde ya opera y como trabaja la venta. No inventes volumenes de ventas ni proyectos anteriores.',
  },
  EMPRESA: {
    titulo: 'Empresa',
    descripcion: 'Enfoque en inventario comercial y corporativo.',
    asunto: 'Servicios inmobiliarios corporativos',
    fraseApertura: 'Le escribo para ponerme a disposición de su empresa en la búsqueda de oficinas, locales o bodegas.',
    argumento:
      'Entiendo que una búsqueda corporativa no se parece a una residencial: pesan los metros útiles, el acceso, el estacionamiento y los plazos. Trabajo con un requerimiento escrito y le presento solo las opciones que lo cumplen, para no hacerle perder visitas.',
    cierre:
      'Si me comparten lo que están buscando, preparo una primera selección sin costo. Quedo atento.',
    enfoque:
      'El destinatario es una empresa que necesita oficinas, locales o bodegas. Enfocate en inventario comercial y corporativo y en entender requerimientos de espacio. No hables de vivienda salvo que el inventario real sea solo residencial, en cuyo caso ofrece buscar lo que necesiten.',
  },
};

// Los bloques de la carta, en orden. El texto se guarda y se edita por bloque
// para que "regenerar este parrafo" no rehaga la carta entera.
//
// El saludo y la apertura van separados a proposito. Juntos, el modelo los
// fundia en una linea ("Ing. Gabriela Muñoz, un gusto saludarla tras...") y la
// carta perdia la formula de tratamiento. Separados, el saludo lo arma el
// codigo (ver saludo.ts) y la apertura es un parrafo propio que existe solo si
// el agente escribio un contexto.
export const CARTA_BLOQUES = ['saludo', 'apertura', 'presentacion', 'experiencia', 'inventario', 'propuesta', 'cierre'] as const;
export type CartaBloqueClave = (typeof CARTA_BLOQUES)[number];

export type CartaBloques = Record<CartaBloqueClave, string>;

// Los bloques que escribe el modelo. El saludo no esta: tiene reglas fijas y
// lo resuelve el codigo.
export const CARTA_BLOQUES_DEL_MODELO = CARTA_BLOQUES.filter((c) => c !== 'saludo');

// Que se le pide a cada bloque. Va al prompt y tambien describe el bloque en
// la pantalla de edicion, para que el agente sepa que esperar de cada uno.
export const CARTA_BLOQUE_INSTRUCCION: Record<CartaBloqueClave, string> = {
  saludo: 'Linea de saludo con formula de tratamiento. La arma el sistema, no el modelo.',
  apertura:
    'SOLO si hay contexto de la relacion: una o dos frases completas que lo retoman, sin agregar nada que el contexto no diga. Sin parentesis y sin repetir el nombre del destinatario, que ya esta en el saludo. Si NO hay contexto, cadena vacia.',
  presentacion:
    'Quien es el agente, a que se dedica y en que zonas opera. Dos o tres frases. Empieza directamente por la presentacion: sin saludo, sin el nombre del destinatario y sin aludir a un encuentro previo.',
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

// Tope mensual de CARTAS NUEVAS por agente. Vive aca y en ningun otro lado:
// la pantalla, la API y los mensajes lo leen de esta constante.
//
// Regenerar un parrafo NO descuenta de este tope, a proposito: si cada ajuste
// restara, un agente que pule su carta tres veces se quedaria sin cuota antes
// de mandar la segunda, y penalizar el ajuste fino es penalizar justamente al
// que usa bien la herramienta. Las regeneraciones se siguen registrando en
// CartaGeneracion para poder medir el gasto real.
export const CARTA_LIMITE_MENSUAL = 10;

// Umbrales a partir de los cuales una cifra de volumen RESPALDA al agente. Por
// debajo, la carta no la menciona de ninguna forma y la pantalla muestra el
// aviso del punto 2.3.
//
// Antes estaban en 3 y 3, y eso dejo pasar "he registrado tres cierres": para
// la regla, tres ya no era escaso, pero en una carta de presentacion tres
// cierres no suman, delatan. La pregunta no es "tiene algo" sino "esta cifra,
// leida por un desconocido, juega a favor". Se evaluan por separado: quien
// tiene 20 cierres y 2 inmuebles puede citar los cierres y no la cartera.
export const CARTA_UMBRAL_CIERRES = 10;
export const CARTA_UMBRAL_INMUEBLES = 5;

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
  // DECLARADO por el agente en su carnet. Redinmo no lo verifica: solo sabe
  // cuanto lleva el agente EN LA PLATAFORMA (aniosEnRedinmo). Puede citarse en
  // la carta porque es la palabra del propio agente, que firma la carta, pero
  // nunca se deduce, se completa ni se redondea. Vacio = la carta no habla de
  // años de experiencia de ninguna forma.
  aniosExperienciaDeclarados: number | null;
  licencia: string | null;
  verificado: boolean;
};

type Volumen = Pick<CartaDatosAgente, 'cierresRegistrados' | 'inmueblesActivos'>;

// Cada cifra de volumen se habilita por separado. El prompt, la plantilla y la
// auditoria leen estas dos funciones: si discreparan, el modelo podria escribir
// algo que la auditoria deja pasar.
export function cierresMencionables(datos: Volumen): boolean {
  return datos.cierresRegistrados >= CARTA_UMBRAL_CIERRES;
}

export function inventarioMencionable(datos: Volumen): boolean {
  return datos.inmueblesActivos >= CARTA_UMBRAL_INMUEBLES;
}

// Aviso de la pantalla (punto 2.3): basta con que una de las dos cifras no
// alcance para que la carta pierda un argumento, y eso se le dice al agente.
export function inventarioEsEscaso(datos: Volumen): boolean {
  return !cierresMencionables(datos) || !inventarioMencionable(datos);
}

export function esDestinatarioValido(valor: unknown): valor is CartaDestinatarioTipo {
  return typeof valor === 'string' && (CARTA_DESTINATARIOS as readonly string[]).includes(valor);
}

export function esBloqueValido(valor: unknown): valor is CartaBloqueClave {
  return typeof valor === 'string' && (CARTA_BLOQUES as readonly string[]).includes(valor);
}

// Normaliza lo que viene de la base (Json) a todos los bloques, sin confiar en
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

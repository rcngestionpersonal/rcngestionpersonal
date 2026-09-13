// Saludo de la carta.
//
// Lo arma el CODIGO y no el modelo. Con el modelo el saludo salia fundido con
// el contexto en una sola linea y sin formula de tratamiento ("Ing. Gabriela
// Muñoz, un gusto saludarla tras..."). El saludo tiene reglas fijas y no hay
// nada que redactar: pedirselo al modelo solo abre la puerta a que lo haga mal.
//
// REGLAS:
//   - "Estimada" / "Estimado" solo cuando el genero se sabe con certeza. Si no,
//     "Estimado/a". Adivinar mal el genero de un desconocido es peor que la
//     barra.
//   - El titulo profesional va delante del nombre: "Estimada Ing. Gabriela
//     Muñoz,". El CARGO de puesto no: "Estimada Gerente Gabriela Muñoz" no es
//     castellano. El cargo ya se imprime debajo del nombre en el PDF.
//   - Empresa: "Estimados señores de Constructora Andrade S.A.,".
//   - Siempre termina en coma. Nunca dos puntos, nunca sin puntuacion.

export type TratoDestinatario = 'femenino' | 'masculino' | 'indeterminado' | 'empresa';

export type SaludoResuelto = {
  texto: string;
  trato: TratoDestinatario;
  // Como se nombra al destinatario dentro del saludo, ya con titulo y con
  // mayusculas normalizadas.
  tratamiento: string;
};

type Genero = 'f' | 'm' | null;

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function clave(palabra: string): string {
  return sinTildes(palabra).toLowerCase().replace(/[.,:;º°]/g, '');
}

// Titulos que se escriben DELANTE del nombre, con su abreviatura canonica. El
// genero solo cuando el titulo lo marca: "Ing." sirve para los dos.
const TITULOS: Record<string, { abreviatura: string; genero: Genero }> = {
  ing: { abreviatura: 'Ing.', genero: null },
  ingeniero: { abreviatura: 'Ing.', genero: 'm' },
  ingeniera: { abreviatura: 'Ing.', genero: 'f' },
  dr: { abreviatura: 'Dr.', genero: 'm' },
  doctor: { abreviatura: 'Dr.', genero: 'm' },
  dra: { abreviatura: 'Dra.', genero: 'f' },
  doctora: { abreviatura: 'Dra.', genero: 'f' },
  arq: { abreviatura: 'Arq.', genero: null },
  arquitecto: { abreviatura: 'Arq.', genero: 'm' },
  arquitecta: { abreviatura: 'Arq.', genero: 'f' },
  ab: { abreviatura: 'Abg.', genero: null },
  abg: { abreviatura: 'Abg.', genero: null },
  abog: { abreviatura: 'Abg.', genero: null },
  abogado: { abreviatura: 'Abg.', genero: 'm' },
  abogada: { abreviatura: 'Abg.', genero: 'f' },
  lic: { abreviatura: 'Lic.', genero: null },
  lcdo: { abreviatura: 'Lcdo.', genero: 'm' },
  licdo: { abreviatura: 'Lcdo.', genero: 'm' },
  licenciado: { abreviatura: 'Lcdo.', genero: 'm' },
  lcda: { abreviatura: 'Lcda.', genero: 'f' },
  licda: { abreviatura: 'Lcda.', genero: 'f' },
  licenciada: { abreviatura: 'Lcda.', genero: 'f' },
  econ: { abreviatura: 'Econ.', genero: null },
  economista: { abreviatura: 'Econ.', genero: null },
  mgs: { abreviatura: 'Mgs.', genero: null },
  mgtr: { abreviatura: 'Mgs.', genero: null },
  magister: { abreviatura: 'Mgs.', genero: null },
  msc: { abreviatura: 'MSc.', genero: null },
  sr: { abreviatura: 'Sr.', genero: 'm' },
  senor: { abreviatura: 'Sr.', genero: 'm' },
  sra: { abreviatura: 'Sra.', genero: 'f' },
  senora: { abreviatura: 'Sra.', genero: 'f' },
  srta: { abreviatura: 'Srta.', genero: 'f' },
  senorita: { abreviatura: 'Srta.', genero: 'f' },
};

// Nombres de pila frecuentes en Ecuador. SOLO se decide el genero si el nombre
// esta en una de estas listas: no se deduce por la terminacion, porque "-a" no
// es garantia (Luca, Borja) y "-o" tampoco (Rosario, Consuelo). Un nombre que
// no esta aqui sale con "Estimado/a", que es correcto siempre.
const FEMENINOS = new Set(
  `abigail adriana agustina alba alejandra alexandra alicia amparo ana anabel andrea angela angelica antonella aracely ariana
  aurora azucena barbara beatriz belen betty blanca camila carina carla carmen carolina catalina cecilia celia cinthia clara
  claudia consuelo cristina cynthia daniela dayana delia denisse diana dolores domenica doris edith elena elisa elizabeth elsa elvia emilia emma
  enma erika esperanza estefania estela esther eugenia eva evelyn fabiola fanny fatima fernanda flor francisca gabriela gina irma janina jhoanna magaly marcia milena nadia nathalia nicole noelia paulina thalia yessenia
  geovanna giovanna gisela gladys gloria grace graciela hilda ines irene isabel isabela isabella ivonne jackeline jacqueline
  janet janeth jazmin jeanneth jennifer jenny jessica jimena johanna josefina juana judith julia juliana karen karina karla
  katherine laura leonor lidia ligia liliana lisbeth lizbeth lorena lourdes lucia lucy luisa ma magdalena maira marcela
  margarita maria mariana maribel marisol maritza marlene marta martha martina mayra melina melissa mercedes micaela michelle
  miriam mirian monica myriam nancy narcisa natalia nataly nathaly nelly noemi nora norma olga olivia pamela paola patricia
  paula piedad pilar priscila raquel rebeca renata rita rocio rosa rosalba rosana roxana ruth sabrina samantha sandra sara
  selena sheyla shirley silvana silvia sofia soledad sonia stefania susana sylvia tamara tania tatiana teresa ursula valentina
  valeria vanessa veronica victoria vilma violeta viviana wendy ximena yadira yajaira yesenia yolanda zoila zulema`.split(/\s+/),
);

const MASCULINOS = new Set(
  `aaron abel adolfo adrian agustin alberto alejandro alexander alfonso alfredo alvaro andres angel anibal anthony antonio
  armando arturo augusto benjamin gabriel joseph steven
  bernardo bolivar bruno bryan byron camilo carlos cesar christian clemente cristhian cristian cristobal dario darwin daniel
  david diego domingo edgar edison edmundo eduardo edwin efrain elias eloy emiliano emilio emmanuel enrique eric erick ernesto
  esteban ezequiel fabian fausto felipe felix fernando fidel flavio francisco franklin freddy fredy galo genaro geovanny
  gerardo german gilberto gino giovanni gonzalo gregorio guillermo gustavo hector henry heriberto hernan holger homero hugo
  humberto ignacio isaac ismael israel ivan jacinto jaime jairo javier jefferson jeronimo jesus jhon jhonny joaquin joel john
  johnny jonathan jordy jorge jose josue juan julian julio kevin kleber lautaro leandro lenin leonardo leonel lino lorenzo
  lucas luciano luis manuel marcelo marco marcos mario marlon martin mateo matias mauricio maximiliano maximo medardo miguel
  milton moises napoleon nelson neptali nestor nicolas octavio oliver omar orlando oscar osvaldo oswaldo pablo pascual patricio
  paul pedro rafael ramiro ramon raul reinaldo renato rene reynaldo ricardo richard rigoberto robert roberto rodolfo rodrigo
  rolando ronald ruben salvador samuel santiago saul sebastian segundo sergio silvio simon stalin stalyn telmo teodoro thiago
  tiago tito tomas ulises valentin vicente victor wagner walter washington wilmer william wilson wladimir xavier`.split(/\s+/),
);

// Nombres que se usan para los dos generos. Estan aparte a proposito: si alguien
// los agrega a una de las listas de arriba, este conjunto sigue ganando.
const AMBIGUOS = new Set(['alex', 'ariel', 'cruz', 'guadalupe', 'rosario', 'trinidad', 'sasha', 'noa', 'dani', 'francis', 'jordan', 'reyes', 'yael', 'paris']);

function generoDelNombre(nombre: string): Genero {
  const k = clave(nombre);
  if (!k || AMBIGUOS.has(k)) return null;
  if (FEMENINOS.has(k)) return 'f';
  if (MASCULINOS.has(k)) return 'm';
  return null;
}

// Señales de que el "nombre" es una razon social y no una persona. La forma
// juridica (S.A., Cía. Ltda.) es la mas fiable; el resto son palabras que no
// forman parte del nombre de nadie.
const PALABRAS_DE_EMPRESA = new Set([
  'sa', 'sas', 'ca', 'cia', 'ltda', 'corp', 'inc', 'llc', 'compania', 'corporacion', 'grupo', 'group', 'constructora',
  'inmobiliaria', 'promotora', 'consorcio', 'holding', 'fideicomiso', 'banco', 'cooperativa', 'fundacion', 'asociados',
  'industrias', 'distribuidora', 'empresa', 'urbanizadora', 'desarrolladora', 'propiedades', 'realty', 'partners', 'hijos',
]);

function esEmpresa(nombre: string): boolean {
  if (/&/.test(nombre)) return true;
  // "S.A." y "C.A." se parten en letras sueltas al quitar los puntos: se
  // juntan antes de mirar las palabras.
  const compacto = nombre.replace(/\b([A-Za-z])\.\s?([A-Za-z])\.(?:\s?([A-Za-z])\.)?/g, (_m, a, b, c) => `${a}${b}${c ?? ''}`);
  return compacto
    .split(/[\s,]+/)
    .map(clave)
    .some((p) => PALABRAS_DE_EMPRESA.has(p));
}

const ABREVIATURAS_FINALES = new Set(['ltda', 'cia', 'inc', 'corp', 'sa', 'ca', 'sas']);

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'di', 'van', 'von']);

// "ING. GABRIELA MUÑOZ" o "gabriela muñoz" -> "Gabriela Muñoz". Si el agente
// ya escribio con mayusculas y minusculas mezcladas, se respeta tal cual: puede
// ser a proposito ("María José de la Torre", "McKenzie").
function normalizarMayusculas(texto: string): string {
  const letras = texto.replace(/[^\p{L}]/gu, '');
  const todoIgual = letras === letras.toUpperCase() || letras === letras.toLowerCase();
  if (!letras || !todoIgual) return texto;
  return texto
    .toLowerCase()
    .split(' ')
    .map((palabra, i) => {
      if (i > 0 && PARTICULAS.has(palabra)) return palabra;
      return palabra
        .split('-')
        .map((parte) => (parte ? parte[0].toUpperCase() + parte.slice(1) : parte))
        .join('-');
    })
    .join(' ');
}

// Separa los titulos que el agente escribio delante del nombre.
function separarTitulos(nombre: string): { titulos: Array<{ abreviatura: string; genero: Genero }>; resto: string[] } {
  const palabras = nombre.split(/\s+/).filter(Boolean);
  const titulos: Array<{ abreviatura: string; genero: Genero }> = [];
  while (palabras.length > 1) {
    const titulo = TITULOS[clave(palabras[0])];
    if (!titulo) break;
    titulos.push(titulo);
    palabras.shift();
  }
  return { titulos, resto: palabras };
}

// El cargo solo aporta al saludo cuando ES un titulo ("Ingeniera"). Un puesto
// ("Gerente", "Directora comercial") no se antepone al nombre.
function tituloDelCargo(cargo: string | null | undefined): { abreviatura: string; genero: Genero } | null {
  if (!cargo) return null;
  const palabras = cargo.trim().split(/\s+/);
  if (palabras.length !== 1) return null;
  return TITULOS[clave(palabras[0])] ?? null;
}

export function resolverSaludo(nombre: string, cargo?: string | null): SaludoResuelto {
  // Lo que el agente haya puesto al final ("Gabriela Muñoz:") se descarta: la
  // puntuacion del saludo la decide esta funcion. El punto final se conserva
  // solo si cierra una abreviatura: "S.A." sin su punto queda mal escrito.
  let limpio = nombre.replace(/[()]/g, '').replace(/\s+/g, ' ').trim().replace(/[\s,:;]+$/, '');
  if (limpio.endsWith('.')) {
    const ultima = limpio.split(' ').pop() ?? '';
    const esAbreviatura = /^([A-Za-z]\.){2,}$/.test(ultima) || ABREVIATURAS_FINALES.has(clave(ultima));
    if (!esAbreviatura) limpio = limpio.replace(/\.+$/, '');
  }

  if (esEmpresa(limpio)) {
    // La razon social se deja como la escribio el agente: las siglas y las
    // mayusculas de una marca suelen ser intencionales.
    return { texto: `Estimados señores de ${limpio},`, trato: 'empresa', tratamiento: limpio };
  }

  const { titulos, resto } = separarTitulos(limpio);
  if (titulos.length === 0) {
    const delCargo = tituloDelCargo(cargo);
    if (delCargo) titulos.push(delCargo);
  }

  const nombrePropio = normalizarMayusculas(resto.join(' '));
  const primerNombre = resto[0] ?? '';

  // Genero: el del nombre de pila y el que marque el titulo tienen que estar de
  // acuerdo. Si se contradicen ("Dr. Gabriela"), no se elige: se usa la barra.
  const senales = [generoDelNombre(primerNombre), ...titulos.map((t) => t.genero)].filter((g): g is 'f' | 'm' => g !== null);
  const genero: Genero = senales.length > 0 && senales.every((g) => g === senales[0]) ? senales[0] : null;

  const tratamiento = [...titulos.map((t) => t.abreviatura), nombrePropio].join(' ');
  const formula = genero === 'f' ? 'Estimada' : genero === 'm' ? 'Estimado' : 'Estimado/a';

  return {
    texto: `${formula} ${tratamiento},`,
    trato: genero === 'f' ? 'femenino' : genero === 'm' ? 'masculino' : 'indeterminado',
    tratamiento,
  };
}

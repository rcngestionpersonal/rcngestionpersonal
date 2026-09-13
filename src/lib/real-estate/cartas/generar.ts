import {
  CARTA_BLOQUES,
  CARTA_BLOQUES_DEL_MODELO,
  CARTA_BLOQUE_INSTRUCCION,
  CARTA_DESTINATARIO_CONFIG,
  cierresMencionables,
  inventarioMencionable,
  normalizarBloques,
  type CartaBloqueClave,
  type CartaBloques,
  type CartaDatosAgente,
  type CartaDestinatarioTipo,
} from './tipos';
import { auditarInvencion, type ContextoAuditoria } from './auditoria';
import { resolverSaludo, type SaludoResuelto, type TratoDestinatario } from './saludo';

// Generacion del texto de la carta.
//
// Usa el mismo proveedor que ya usa el proyecto para NLP (ver
// src/lib/real-estate/nlp.ts) con la clave OPENAI_API_KEY. Sin clave
// configurada NO se rompe la feature: cae a un borrador armado con plantillas
// sobre los mismos datos reales, que el agente edita igual. Una carta sin IA
// es peor que una con IA; una pantalla rota es peor que las dos.

export type EntradaGeneracion = {
  datos: CartaDatosAgente;
  destinatarioTipo: CartaDestinatarioTipo;
  destinatarioNombre: string;
  destinatarioCargo?: string | null;
  contexto?: string | null;
  // Bloques que el agente reescribio en cartas anteriores (punto 3.3).
  muestrasDeEstilo?: string[];
  // El agente tiene mini-sitio publicado y dejo el enlace activo: el modelo
  // puede invitar a visitarlo, sin escribir la URL.
  conPerfilPublico?: boolean;
};

export type ResultadoGeneracion = {
  bloques: CartaBloques;
  modelo: string | null;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  // true cuando el texto salio de la plantilla local en vez del modelo, sea
  // porque no hay clave o porque el proveedor fallo.
  usoPlantilla: boolean;
  // Por que se cayo a la plantilla. Solo para logs: al agente no se le habla
  // de proveedores ni de claves.
  motivoRespaldo?: MotivoFallo;
};

// El modelo de las cartas se FIJA aqui y NO se lee de OPENAI_MODEL.
//
// Esa variable la comparte nlp.ts, que hace otra cosa y puede querer otro
// modelo; y ademas estaba puesta en un valor distinto en local que en
// produccion, de modo que el mismo agente habria recibido cartas escritas por
// modelos distintos segun donde corriera. El costo de la feature esta calculado
// sobre este modelo concreto, asi que cambiarlo es una decision, no un efecto
// colateral de tocar una variable de entorno ajena.
export const CARTA_MODELO = 'gpt-4.1-mini';

function modeloConfigurado(): { apiKey: string; modelo: string } | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return { apiKey, modelo: process.env.OPENAI_MODEL_CARTAS || CARTA_MODELO };
}

// El bloque de datos que viaja al modelo. Se escribe como hechos numerados y
// planos, no como prosa: cuanto menos margen de interpretacion, menos margen
// para adornar.
//
// Una cifra que no alcanza para respaldar al agente NO viaja: el modelo no
// puede escribir "tres cierres" si nunca supo que eran tres. Es mas firme que
// pasarle el numero con la orden de no usarlo.
function hechosVerificables(datos: CartaDatosAgente): string {
  const conCierres = cierresMencionables(datos);
  const conInventario = inventarioMencionable(datos);
  const lineas = [`- Nombre: ${datos.nombre}`];
  // Sin empresa, la linea no va. Con "sin empresa registrada" el modelo
  // escribia "sin estar afiliada a ninguna empresa registrada": convertia un
  // campo vacio en una afirmacion.
  if (datos.empresa) lineas.push(`- Empresa: ${datos.empresa}`);
  lineas.push(
    `- Opera en: ${datos.zonas.length > 0 ? datos.zonas.join(', ') : 'Quito'}`,
    `- Especialidad: ${datos.especialidad}`,
  );
  if (datos.aniosEnRedinmo >= 1) {
    lineas.push(`- Años cumplidos en Redinmo.io (dato de la plataforma): ${datos.aniosEnRedinmo}, desde ${datos.anioIngreso}`);
  }
  if (conInventario) {
    lineas.push(
      `- Inmuebles activos en su cartera (dato de la plataforma): ${datos.inmueblesActivos}`,
      `- Composicion de la cartera: ${datos.composicionInventario.map((c) => `${c.cantidad} ${c.tipo}`).join(', ')}`,
    );
  }
  if (conCierres) {
    lineas.push(
      `- Cierres registrados en la plataforma (dato de la plataforma): ${datos.cierresRegistrados}`,
      `- Nivel alcanzado en la plataforma: ${datos.nivel}`,
    );
  }
  // Origen declarativo, dicho con todas las letras. El modelo tiene que saber
  // que este numero NO es un dato medido, para no presentarlo como tal ni
  // mezclarlo con los años en la plataforma.
  if (datos.aniosExperienciaDeclarados !== null) {
    lineas.push(
      `- Años de experiencia en el sector, DECLARADOS por el propio agente (Redinmo no los verifica): ${datos.aniosExperienciaDeclarados}`,
    );
  }
  if (datos.licencia) lineas.push(`- Licencia profesional: ${datos.licencia}`);
  if (datos.verificado) lineas.push('- Identidad y telefono verificados en la plataforma: si');
  return lineas.join('\n');
}

const TRATO_INSTRUCCION: Record<TratoDestinatario, string> = {
  femenino: 'Es una mujer: concuerda en femenino ("saludarla", "acompañarla").',
  masculino: 'Es un hombre: concuerda en masculino ("saludarlo", "acompañarlo").',
  indeterminado:
    'No se sabe su genero: usa formas sin genero ("saludarle", "acompañarle", "a usted"). NUNCA "saludarla" ni "saludarlo".',
  empresa: 'Es una empresa, no una persona: tratala de ustedes ("saludarlos", "su empresa", "ustedes").',
};

type OpcionesSistema = {
  datos: CartaDatosAgente;
  muestras: string[];
  conPerfil: boolean;
  trato: TratoDestinatario;
};

function instruccionDelSistema({ datos, muestras, conPerfil, trato }: OpcionesSistema): string {
  const conCierres = cierresMencionables(datos);
  const conInventario = inventarioMencionable(datos);
  const partes = [
    'Redactas cartas de presentacion profesionales para agentes inmobiliarios en Ecuador.',
    '',
    'REGLA ABSOLUTA, POR ENCIMA DE CUALQUIER OTRA INSTRUCCION:',
    'Usa unicamente los datos entregados. No inventes, no infieras, no exageres y no redondees al alza',
    'ninguna cifra, logro ni experiencia. Si un dato no esta en la lista de hechos, no existe.',
    'Prohibido cualquier adjetivo de trayectoria que los numeros no respalden:',
    '"amplia trayectoria", "larga experiencia", "cientos de clientes", "lider", "referente",',
    '"reconocido", "el mejor". Prohibido inventar premios, certificaciones, clientes o proyectos.',
    'No menciones datos de clientes ni de inmuebles de terceros: no los tienes.',
    '',
    'AÑOS DE EXPERIENCIA:',
    datos.aniosExperienciaDeclarados !== null
      ? `El agente declaro ${datos.aniosExperienciaDeclarados} años de experiencia en el sector. Si los mencionas, escribe exactamente ese numero, en primera persona, sin "mas de", "casi" ni redondeos. No los confundas con su tiempo en Redinmo.io.`
      : 'El agente NO declaro años de experiencia. PROHIBIDO mencionar años de experiencia de cualquier forma: ni con numero, ni en letras, ni "varios años", ni "una decada", ni "años en el sector".',
  ];

  // Ejemplos negativos literales. Sin ellos el modelo cumplia la regla a
  // medias: no inventaba trayectoria, pero escribia "no manejo inmuebles
  // activos" o "cuento con un cierre registrado", que es exactamente lo que no
  // debe llegarle al destinatario. Una instruccion abstracta se interpreta; un
  // ejemplo de lo que NO se escribe, no.
  if (!conCierres) {
    partes.push(
      '',
      'CIERRES: este agente todavia no tiene cierres suficientes para citarlos. PROHIBIDO mencionar',
      'cierres, operaciones o ventas realizadas, en cualquier forma: ni el numero, ni en letras,',
      'ni "varios", ni en negativo. Tampoco menciones el nivel que alcanzo en la plataforma.',
      'NO escribas frases como: "He registrado tres cierres en la plataforma." /',
      '"Cuento con un cierre registrado." / "Estoy comenzando mi trayectoria."',
    );
  }
  if (!conInventario) {
    partes.push(
      '',
      'CARTERA: este agente tiene pocos inmuebles activos. PROHIBIDO mencionar la cantidad o la',
      'composicion de su cartera, en cualquier forma: ni el numero, ni en letras, ni en singular,',
      'ni en negativo, ni como algo que va a crecer.',
      'NO escribas frases como: "En este momento no manejo inmuebles activos en cartera." /',
      '"Mi cartera esta compuesta por un departamento y una casa." / "Aun no tengo propiedades, pero..."',
      'En el bloque "inventario" habla de que busca lo que el destinatario necesita y de como',
      'trabaja para conseguirlo, sin decir cuanto tiene hoy.',
    );
  }
  if (!conCierres && !conInventario) {
    partes.push('En el bloque "experiencia" habla de su especialidad y de las zonas que conoce.');
  }

  partes.push(
    '',
    'ESTRUCTURA DE LA APERTURA:',
    'El saludo ("Estimada Ing. ...,") lo pone el sistema en su propia linea: tu NO lo escribes.',
    'Nunca empieces un bloque con el nombre del destinatario ni con "Estimado". Nunca uses parentesis.',
    'Si hay contexto de la relacion, el bloque "apertura" lo retoma en una o dos frases completas,',
    // El ejemplo va con tildes aunque el resto del prompt no las lleve: el
    // modelo lo copia casi literal, y sin tildes escribia "conversacion".
    'por ejemplo: "Un gusto saludarla tras nuestra conversación en la convención financiera en Guayaquil."',
    'No agregues detalles que el contexto no dice (temas, fechas, acuerdos).',
    'Si NO hay contexto, "apertura" es una cadena vacia y no aludes a ningun encuentro previo.',
    `Trato del destinatario: ${TRATO_INSTRUCCION[trato]}`,
  );

  if (conPerfil) {
    // La URL vive en el pie del PDF y en el QR. Aqui solo se invita: una
    // direccion web escrita a mitad de un parrafo rompe la lectura y en el
    // correo se duplicaria con el boton.
    partes.push(
      '',
      'El agente tiene un perfil profesional publico. Puedes invitar a visitarlo en el cierre,',
      'de forma natural y solo si encaja. NUNCA escribas la direccion web ni un enlace:',
      'la URL va en el pie del documento. Di algo como "puede visitar mi perfil profesional"',
      'o "si desea conocer mi inventario y verificar mi credencial". Si no encaja, no lo menciones.',
    );
  }

  partes.push(
    '',
    // Sin esta linea, con agentes sin datos que citar, el modelo pasaba a
    // tercera persona ("Daniela Ordóñez se dedica...") en una carta que firma
    // la propia Daniela.
    'VOZ: primera persona, SIEMPRE. Escribe el agente que firma: "Soy...", "Me dedico...", "Trabajo...".',
    'Nunca "Daniela se dedica" ni "Su especialidad es": la carta la firma el agente, no un tercero.',
    'ESTILO: español neutro de Ecuador, tono profesional y directo. Frases claras y cortas.',
    'Sin florituras, sin superlativos, sin signos de exclamacion, sin emojis.',
    'Trata al destinatario de usted, o de ustedes si es una empresa. No firmes: la firma la pone el documento.',
    'Extension total de media pagina a una pagina.',
  );

  if (muestras.length > 0) {
    partes.push(
      '',
      'REFERENCIA DE ESTILO: el agente reescribio asi parrafos de sus cartas anteriores.',
      'Imita su registro y su forma de construir frases, NUNCA su contenido ni sus datos:',
      ...muestras.map((m) => `"""${m}"""`),
    );
  }

  return partes.join('\n');
}

function instruccionDeUsuario(entrada: EntradaGeneracion, saludo: SaludoResuelto): string {
  const config = CARTA_DESTINATARIO_CONFIG[entrada.destinatarioTipo];
  const destinatario = [
    `- Nombre: ${saludo.tratamiento}`,
    entrada.destinatarioCargo ? `- Cargo: ${entrada.destinatarioCargo}` : null,
    `- Saludo que ya lleva la carta: ${saludo.texto}`,
    entrada.contexto?.trim()
      ? `- Contexto de la relacion, escrito por el agente: ${entrada.contexto.trim()}`
      : '- Contexto de la relacion: ninguno. El bloque "apertura" va vacio.',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'HECHOS VERIFICABLES DEL AGENTE (unica fuente permitida):',
    hechosVerificables(entrada.datos),
    '',
    'DESTINATARIO:',
    destinatario,
    '',
    `ENFOQUE REQUERIDO: ${config.enfoque}`,
    '',
    'Devuelve SOLO un JSON valido con exactamente estas claves de texto plano:',
    ...CARTA_BLOQUES_DEL_MODELO.map((clave) => `- "${clave}": ${CARTA_BLOQUE_INSTRUCCION[clave]}`),
  ].join('\n');
}

// Lo que se decide en codigo y no se le deja al modelo: el saludo, y que la
// apertura exista solo si hay contexto. Se aplica a lo que devuelva el modelo
// ANTES de auditar, asi que la auditoria ve la carta tal como va a salir.
function completarEstructura(bloques: CartaBloques, entrada: EntradaGeneracion, saludo: SaludoResuelto): CartaBloques {
  return {
    ...bloques,
    saludo: saludo.texto,
    apertura: entrada.contexto?.trim() ? bloques.apertura.trim() : '',
  };
}

// Bloques que tienen que venir con texto. La apertura solo si hay contexto.
function bloquesFaltantes(bloques: CartaBloques, entrada: EntradaGeneracion): boolean {
  return CARTA_BLOQUES_DEL_MODELO.some((c) => {
    if (c === 'apertura' && !entrada.contexto?.trim()) return false;
    return !bloques[c].trim();
  });
}

function contextoDeAuditoria(entrada: EntradaGeneracion, saludo: SaludoResuelto): ContextoAuditoria {
  return { contexto: entrada.contexto, trato: saludo.trato, nombreDestinatario: saludo.tratamiento };
}

type RespuestaChat = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

// Un proveedor caido NUNCA puede dejar al agente sin poder escribir una carta.
// Por eso esta funcion no lanza: devuelve null y quien llama cae a la
// plantilla. Se distingue el motivo para poder verlo en los logs sin exponerlo
// en la pantalla.
export type MotivoFallo = 'sin_clave' | 'http' | 'red' | 'respuesta_vacia' | 'auditoria';

// Toda caida al borrador de plantilla deja UNA linea en el log, con el motivo.
// Sirve para ver si el respaldo se esta activando de forma recurrente, que es
// un problema del proveedor y no del agente. Nunca se registra la clave ni el
// contenido de la carta.
function registrarRespaldo(motivo: MotivoFallo, detalle?: string): void {
  console.error(`[cartas] respaldo a plantilla | motivo=${motivo}${detalle ? ` | ${detalle}` : ''}`);
}

// 20 segundos. Un modelo que tarda mas que esto ya arruino la espera: el agente
// esta frente a su cliente y prefiere el borrador de plantilla al toque antes
// que seguir mirando un spinner.
const TIMEOUT_MS = 20_000;
// Un solo reintento, y solo para fallas transitorias (429 y 5xx). Reintentar
// un 400 o un 401 es quemar tiempo: esos no se arreglan solos.
const REINTENTOS = 1;

async function llamarModelo(
  sistema: string,
  usuario: string,
): Promise<
  | { ok: true; contenido: string; modelo: string; entrada: number | null; salida: number | null }
  | { ok: false; motivo: MotivoFallo }
> {
  const config = modeloConfigurado();
  if (!config) return { ok: false, motivo: 'sin_clave' };

  let ultimoMotivo: MotivoFallo = 'red';

  for (let intento = 0; intento <= REINTENTOS; intento += 1) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
      const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.modelo,
          // Temperatura baja: esta feature premia la fidelidad a los datos por
          // encima de la variedad literaria.
          temperature: 0.4,
          messages: [
            { role: 'system', content: sistema },
            { role: 'user', content: usuario },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: control.signal,
      });

      if (!respuesta.ok) {
        ultimoMotivo = 'http';
        const transitorio = respuesta.status === 429 || respuesta.status >= 500;
        console.error(`[cartas] el generador respondio ${respuesta.status}${transitorio && intento < REINTENTOS ? ' - se reintenta' : ''}`);
        if (transitorio && intento < REINTENTOS) continue;
        return { ok: false, motivo: 'http' };
      }

      const payload = (await respuesta.json()) as RespuestaChat;
      const contenido = payload.choices?.[0]?.message?.content;
      if (!contenido) {
        console.error('[cartas] el generador respondio sin contenido');
        return { ok: false, motivo: 'respuesta_vacia' };
      }

      return {
        ok: true,
        contenido,
        modelo: config.modelo,
        entrada: payload.usage?.prompt_tokens ?? null,
        salida: payload.usage?.completion_tokens ?? null,
      };
    } catch (error) {
      ultimoMotivo = 'red';
      const abortado = error instanceof Error && error.name === 'AbortError';
      console.error(`[cartas] el generador fallo (${abortado ? 'timeout' : 'red'})${intento < REINTENTOS ? ' - se reintenta' : ''}`);
      if (intento >= REINTENTOS) return { ok: false, motivo: 'red' };
    } finally {
      clearTimeout(reloj);
    }
  }

  return { ok: false, motivo: ultimoMotivo };
}

// Segundo intento cuando la auditoría encuentra algo. Se le devuelve al modelo
// lo que hizo mal, con sus propias frases, en vez de repetirle la regla que ya
// se saltó una vez.
function correccionTrasAuditoria(hallazgos: string[]): string {
  return [
    '',
    'TU RESPUESTA ANTERIOR INCUMPLIO LAS REGLAS. Problemas detectados:',
    ...hallazgos.map((h) => `  - ${h}`),
    '',
    'Corrige exactamente eso. No expliques el cambio, no te disculpes: devuelve',
    'solo el JSON con las mismas claves que se pidieron.',
  ].join('\n');
}

export async function generarCarta(entrada: EntradaGeneracion): Promise<ResultadoGeneracion> {
  const saludo = resolverSaludo(entrada.destinatarioNombre, entrada.destinatarioCargo);
  const sistema = instruccionDelSistema({
    datos: entrada.datos,
    muestras: entrada.muestrasDeEstilo ?? [],
    conPerfil: Boolean(entrada.conPerfilPublico),
    trato: saludo.trato,
  });
  const usuario = instruccionDeUsuario(entrada, saludo);
  const ctxAuditoria = contextoDeAuditoria(entrada, saludo);
  const respuesta = await llamarModelo(sistema, usuario);

  // Sin clave, con el proveedor caido o con una respuesta ilegible: el agente
  // igual se lleva un borrador armado con sus datos reales. La carta puede
  // salir mas simple, nunca puede no salir.
  if (!respuesta.ok) {
    registrarRespaldo(respuesta.motivo);
    return {
      bloques: borradorDePlantilla(entrada),
      modelo: null,
      tokensEntrada: null,
      tokensSalida: null,
      usoPlantilla: true,
      motivoRespaldo: respuesta.motivo,
    };
  }

  let entradaTotal = respuesta.entrada;
  let salidaTotal = respuesta.salida;

  try {
    let bloques = completarEstructura(normalizarBloques(JSON.parse(respuesta.contenido)), entrada, saludo);
    // Una respuesta a la que le falten bloques es peor que la plantilla: se
    // prefiere un borrador completo y editable antes que una carta con huecos.
    if (bloquesFaltantes(bloques, entrada)) {
      registrarRespaldo('respuesta_vacia', 'bloques incompletos');
      return {
        bloques: borradorDePlantilla(entrada),
        modelo: respuesta.modelo,
        tokensEntrada: entradaTotal,
        tokensSalida: salidaTotal,
        usoPlantilla: true,
        motivoRespaldo: 'respuesta_vacia',
      };
    }

    // Red de seguridad del punto 3.4: el prompt pide no inventar, pero eso es
    // una peticion. Esto lo comprueba. Si algo pasa, se le devuelve al modelo
    // lo que hizo mal y se le da UNA segunda oportunidad.
    let hallazgos = auditarInvencion(bloques, entrada.datos, ctxAuditoria);
    if (hallazgos.length > 0) {
      // Los hallazgos van al log: son frases fijas y cifras del propio agente,
      // nunca el texto de la carta ni datos del destinatario. Sirven para ver
      // si una regla dispara de mas y encarece cada carta con un reintento.
      console.error(`[cartas] auditoría: ${hallazgos.length} hallazgos en el primer intento - se reintenta | ${hallazgos.join(' ; ')}`);
      const segunda = await llamarModelo(sistema, usuario + correccionTrasAuditoria(hallazgos));
      if (segunda.ok) {
        entradaTotal = (entradaTotal ?? 0) + (segunda.entrada ?? 0);
        salidaTotal = (salidaTotal ?? 0) + (segunda.salida ?? 0);
        try {
          const corregidos = completarEstructura(normalizarBloques(JSON.parse(segunda.contenido)), entrada, saludo);
          if (!bloquesFaltantes(corregidos, entrada)) {
            const restantes = auditarInvencion(corregidos, entrada.datos, ctxAuditoria);
            if (restantes.length === 0) {
              bloques = corregidos;
              hallazgos = [];
            } else {
              hallazgos = restantes;
            }
          }
        } catch {
          // Se conserva el diagnostico del primer intento.
        }
      }
    }

    // Sigue inventando tras el reintento: gana la plantilla, que es
    // determinista y no puede afirmar nada que no venga de los datos. Una carta
    // mas sobria es infinitamente mejor que una que expone al agente.
    if (hallazgos.length > 0) {
      registrarRespaldo('auditoria', hallazgos.join(' ; '));
      return {
        bloques: borradorDePlantilla(entrada),
        modelo: respuesta.modelo,
        tokensEntrada: entradaTotal,
        tokensSalida: salidaTotal,
        usoPlantilla: true,
        motivoRespaldo: 'auditoria',
      };
    }

    return {
      bloques,
      modelo: respuesta.modelo,
      tokensEntrada: entradaTotal,
      tokensSalida: salidaTotal,
      usoPlantilla: false,
    };
  } catch {
    registrarRespaldo('respuesta_vacia', 'JSON inválido');
    return {
      bloques: borradorDePlantilla(entrada),
      modelo: respuesta.modelo,
      tokensEntrada: entradaTotal,
      tokensSalida: salidaTotal,
      usoPlantilla: true,
      motivoRespaldo: 'respuesta_vacia',
    };
  }
}

export type ResultadoRegeneracion = {
  texto: string;
  modelo: string | null;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  sinProveedor: boolean;
  // El modelo propuso un parrafo que la auditoria rechazo dos veces. No se
  // guarda: el agente conserva el que tenia.
  rechazado?: boolean;
};

export async function regenerarBloque(
  entrada: EntradaGeneracion & { bloque: CartaBloqueClave; bloquesActuales: CartaBloques },
): Promise<ResultadoRegeneracion> {
  const saludo = resolverSaludo(entrada.destinatarioNombre, entrada.destinatarioCargo);

  // El saludo no se "regenera" con el modelo: tiene reglas fijas. Pedirlo de
  // nuevo lo devuelve a su forma correcta si el agente lo habia tocado.
  if (entrada.bloque === 'saludo') {
    return { texto: saludo.texto, modelo: null, tokensEntrada: null, tokensSalida: null, sinProveedor: false };
  }
  // Sin contexto no hay apertura que escribir.
  if (entrada.bloque === 'apertura' && !entrada.contexto?.trim()) {
    return { texto: '', modelo: null, tokensEntrada: null, tokensSalida: null, sinProveedor: false };
  }

  // Sin proveedor configurado no tiene sentido "regenerar": la plantilla es
  // determinista y devolveria el mismo parrafo. Se dice con todas las letras
  // en vez de devolver un error generico que suena a falla intermitente.
  if (!modeloConfigurado()) {
    return { texto: '', modelo: null, tokensEntrada: null, tokensSalida: null, sinProveedor: true };
  }
  const sistema = instruccionDelSistema({
    datos: entrada.datos,
    muestras: entrada.muestrasDeEstilo ?? [],
    conPerfil: Boolean(entrada.conPerfilPublico),
    trato: saludo.trato,
  });
  const contexto = CARTA_BLOQUES.filter((c) => c !== entrada.bloque)
    .map((c) => `${c}: ${entrada.bloquesActuales[c]}`)
    .join('\n');

  const usuario = [
    instruccionDeUsuario(entrada, saludo),
    '',
    'AHORA SOLO se reescribe UN bloque. El resto de la carta ya esta escrito y no debe repetirse:',
    contexto,
    '',
    `Reescribe unicamente el bloque "${entrada.bloque}". ${CARTA_BLOQUE_INSTRUCCION[entrada.bloque]}`,
    `Devuelve SOLO un JSON con la clave "${entrada.bloque}".`,
  ].join('\n');

  // Solo se audita el parrafo nuevo. Los demas pueden traer ediciones del
  // agente, y lo que el agente escribe con su mano es su palabra, no una
  // invencion del modelo.
  const ctxAuditoria = contextoDeAuditoria(entrada, saludo);
  const auditar = (texto: string) => {
    const soloEste = Object.fromEntries(CARTA_BLOQUES.map((c) => [c, ''])) as CartaBloques;
    soloEste[entrada.bloque] = texto;
    return auditarInvencion(soloEste, entrada.datos, ctxAuditoria);
  };
  const leer = (contenido: string) => {
    try {
      const valor = (JSON.parse(contenido) as Record<string, unknown>)[entrada.bloque];
      return typeof valor === 'string' ? valor.trim() : '';
    } catch {
      return '';
    }
  };

  const respuesta = await llamarModelo(sistema, usuario);
  if (!respuesta.ok) return { texto: '', modelo: null, tokensEntrada: null, tokensSalida: null, sinProveedor: false };

  let texto = leer(respuesta.contenido);
  let tokensEntrada = respuesta.entrada;
  let tokensSalida = respuesta.salida;
  let hallazgos = texto ? auditar(texto) : [];

  // Misma regla que la carta completa: una segunda oportunidad con lo que hizo
  // mal, y si insiste, no se entrega.
  if (hallazgos.length > 0) {
    console.error(`[cartas] auditoría de párrafo "${entrada.bloque}": ${hallazgos.length} hallazgos - se reintenta`);
    const segunda = await llamarModelo(sistema, usuario + correccionTrasAuditoria(hallazgos));
    if (segunda.ok) {
      tokensEntrada = (tokensEntrada ?? 0) + (segunda.entrada ?? 0);
      tokensSalida = (tokensSalida ?? 0) + (segunda.salida ?? 0);
      texto = leer(segunda.contenido);
      hallazgos = texto ? auditar(texto) : hallazgos;
    }
  }

  if (hallazgos.length > 0) {
    registrarRespaldo('auditoria', `párrafo ${entrada.bloque} rechazado: ${hallazgos.join(' ; ')}`);
    return { texto: '', modelo: respuesta.modelo, tokensEntrada, tokensSalida, sinProveedor: false, rechazado: true };
  }

  return { texto, modelo: respuesta.modelo, tokensEntrada, tokensSalida, sinProveedor: false };
}

// Los tipos de inmueble llegan en singular ("departamento", "local comercial").
// En una frase de cartera casi siempre van en plural, y "3 departamento" delata
// de inmediato que el texto lo armo una maquina.
function pluralizar(tipo: string, cantidad: number): string {
  if (cantidad === 1) return tipo;
  return tipo
    .split(' ')
    .map((palabra, i) => (i === 0 ? (/[aeiou]$/i.test(palabra) ? `${palabra}s` : `${palabra}es`) : palabra))
    .join(' ');
}

// Borrador sin modelo. Sigue las MISMAS reglas de cero invencion: cada frase
// se arma desde un dato real y las que dependen de volumen desaparecen cuando
// la cartera es chica.
// Enumera en castellano: "casas, departamentos y oficinas" en vez de la lista
// separada por comas que delata una plantilla.
function enumerar(partes: string[]): string {
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

// El contexto lo escribe el agente como le sale ("nos conocimos en la feria").
// Sin modelo no se reescribe: se respeta su frase, con mayuscula inicial,
// punto final y sin parentesis, que en una carta formal parecen una nota
// provisional.
export function aperturaDesdeContexto(contexto: string | null | undefined): string {
  const limpio = (contexto ?? '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '');
  if (!limpio) return '';
  return `${limpio[0].toUpperCase()}${limpio.slice(1)}.`;
}

export function borradorDePlantilla(entrada: EntradaGeneracion): CartaBloques {
  const { datos } = entrada;
  const conCierres = cierresMencionables(datos);
  const conInventario = inventarioMencionable(datos);
  const config = CARTA_DESTINATARIO_CONFIG[entrada.destinatarioTipo];
  const zonas = enumerar(datos.zonas.length > 0 ? datos.zonas : ['Quito']);
  const saludo = resolverSaludo(entrada.destinatarioNombre, entrada.destinatarioCargo);

  // Presentacion: nombre, empresa, zonas y especialidad en UNA frase que se
  // lea como una presentacion y no como cuatro campos pegados.
  const quienSoy = datos.empresa
    ? `Mi nombre es ${datos.nombre} y trabajo como agente inmobiliario en ${datos.empresa}`
    : `Mi nombre es ${datos.nombre} y trabajo como agente inmobiliario independiente`;
  const presentacion = `${quienSoy}. Me dedico a ${datos.especialidad} de inmuebles y opero en ${zonas}.`;

  // Experiencia: cada cifra solo si respalda, y redactada como respaldo, no
  // como planilla. Sin cifras, se habla de oficio, nunca de volumen.
  const respaldo: string[] = [];
  if (conInventario) {
    respaldo.push(`Hoy tengo ${datos.inmueblesActivos} inmuebles activos en cartera.`);
  }
  if (conCierres) {
    respaldo.push(
      `He registrado ${datos.cierresRegistrados} cierres en Redinmo.io${
        datos.aniosEnRedinmo >= 1 ? `, la red donde opero desde ${datos.anioIngreso}` : ''
      }.`,
    );
  }
  // Declarado por el agente: el numero exacto, en su voz, sin adornos. Sin
  // genero ("dedicado/dedicada"): no se sabe el del agente.
  if (datos.aniosExperienciaDeclarados !== null) {
    respaldo.push(`Llevo ${datos.aniosExperienciaDeclarados} años en el sector inmobiliario.`);
  }
  if (datos.licencia) {
    respaldo.push(`Cuento con licencia profesional vigente (${datos.licencia}).`);
  }
  if (respaldo.length === 0) {
    respaldo.push(
      `Conozco ${zonas} en detalle: los precios reales a los que se cierra, qué se mueve rápido y qué se queda, y eso es lo que pongo sobre la mesa.`,
    );
  }
  if (datos.verificado) {
    // "puede comprobarlo en el enlace del pie" solo si el pie lleva enlace: con
    // el interruptor del perfil apagado no hay nada que comprobar ahi.
    respaldo.push(
      entrada.conPerfilPublico
        ? 'Mi identidad está verificada en la plataforma y puede comprobarla en el enlace del pie de esta carta.'
        : 'Mi identidad está verificada en la plataforma.',
    );
  }

  // Inventario: complementa a la experiencia, no la repite. Con cartera chica
  // habla de criterio de seleccion, que es cierto y no depende del volumen.
  const inventario = conInventario
    ? `En este momento represento ${enumerar(
        datos.composicionInventario.map((c) => `${c.cantidad} ${pluralizar(c.tipo, c.cantidad)}`),
      )}.`
    : `Si lo que necesita no está entre los inmuebles que represento hoy, lo busco: formo parte de una red de agentes en ${zonas} y muevo el requerimiento hasta dar con lo que corresponde.`;

  return {
    saludo: saludo.texto,
    apertura: aperturaDesdeContexto(entrada.contexto),
    presentacion,
    experiencia: respaldo.join(' '),
    inventario,
    propuesta: `${config.fraseApertura} ${config.argumento}`,
    cierre: config.cierre,
  };
}

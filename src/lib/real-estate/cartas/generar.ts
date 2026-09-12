import {
  CARTA_BLOQUES,
  CARTA_BLOQUE_INSTRUCCION,
  CARTA_DESTINATARIO_CONFIG,
  inventarioEsEscaso,
  normalizarBloques,
  type CartaBloqueClave,
  type CartaBloques,
  type CartaDatosAgente,
  type CartaDestinatarioTipo,
} from './tipos';
import { auditarInvencion } from './auditoria';

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
function hechosVerificables(datos: CartaDatosAgente): string {
  const escaso = inventarioEsEscaso(datos);
  const lineas = [
    `- Nombre: ${datos.nombre}`,
    `- Empresa: ${datos.empresa ?? 'sin empresa registrada'}`,
    `- Opera en: ${datos.zonas.length > 0 ? datos.zonas.join(', ') : 'Quito'}`,
    `- Especialidad: ${datos.especialidad}`,
    `- Nivel alcanzado en la plataforma: ${datos.nivel}`,
    `- Años cumplidos en Redinmo.io: ${datos.aniosEnRedinmo} (se registro en ${datos.anioIngreso})`,
    `- Inmuebles activos en su cartera: ${datos.inmueblesActivos}`,
    `- Composicion de la cartera: ${
      datos.composicionInventario.length > 0
        ? datos.composicionInventario.map((c) => `${c.cantidad} ${c.tipo}`).join(', ')
        : 'sin inmuebles activos'
    }`,
    `- Cierres registrados en la plataforma: ${datos.cierresRegistrados}`,
  ];
  if (datos.aniosDeExperiencia) lineas.push(`- Años de experiencia declarados en el sector: ${datos.aniosDeExperiencia}`);
  if (datos.licencia) lineas.push(`- Licencia profesional: ${datos.licencia}`);
  if (datos.verificado) lineas.push('- Identidad y telefono verificados en la plataforma: si');
  lineas.push(`- Cartera considerada escasa para presumir volumen: ${escaso ? 'si' : 'no'}`);
  return lineas.join('\n');
}

function instruccionDelSistema(datos: CartaDatosAgente, muestras: string[]): string {
  const escaso = inventarioEsEscaso(datos);
  const partes = [
    'Redactas cartas de presentacion profesionales para agentes inmobiliarios en Ecuador.',
    '',
    'REGLA ABSOLUTA, POR ENCIMA DE CUALQUIER OTRA INSTRUCCION:',
    'Usa unicamente los datos entregados. No inventes, no infieras, no exageres y no redondees al alza',
    'ninguna cifra, logro ni experiencia. Si un dato no esta en la lista de hechos, no existe.',
    'Prohibido cualquier adjetivo de trayectoria que los numeros no respalden:',
    '"amplia trayectoria", "anos de experiencia en el mercado", "cientos de clientes", "lider", "referente",',
    '"reconocido", "el mejor". Prohibido inventar premios, certificaciones, clientes o proyectos.',
    'No menciones datos de clientes ni de inmuebles de terceros: no los tienes.',
  ];

  if (escaso) {
    // Ejemplos negativos literales. Sin ellos el modelo cumplia la regla a
    // medias: no inventaba trayectoria, pero escribia "no manejo inmuebles
    // activos" o "cuento con un cierre registrado", que es exactamente lo que
    // no debe llegarle al destinatario. Una instruccion abstracta se interpreta;
    // un ejemplo de lo que NO se escribe, no.
    partes.push(
      '',
      'ESTE AGENTE TIENE CARTERA CHICA. PROHIBIDO mencionar la cantidad de inmuebles',
      'o de cierres, en cualquier forma: ni el numero, ni en letras, ni en singular,',
      'ni en negativo, ni como algo que va a crecer.',
      '',
      'NO escribas nunca frases como estas, ni parecidas:',
      '  "En este momento no manejo inmuebles activos en cartera."',
      '  "Cuento con un cierre registrado en la plataforma."',
      '  "Mi cartera esta compuesta por un departamento y una casa."',
      '  "Estoy comenzando mi trayectoria." / "Estoy en un nivel inicial."',
      '  "Aun no tengo propiedades, pero..."',
      '',
      'En el bloque "experiencia" habla de su especialidad y de las zonas que conoce.',
      'En el bloque "inventario" habla de que busca lo que el destinatario necesita',
      'y de como trabaja para conseguirlo, sin decir cuanto tiene hoy.',
      'No menciones tampoco el nivel que alcanzo en la plataforma.',
    );
  }

  partes.push(
    '',
    'ESTILO: español neutro de Ecuador, tono profesional y directo. Frases claras y cortas.',
    'Sin florituras, sin superlativos, sin signos de exclamacion, sin emojis.',
    'Trata al destinatario de usted. No firmes: la firma la pone el documento.',
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

function instruccionDeUsuario(entrada: EntradaGeneracion): string {
  const config = CARTA_DESTINATARIO_CONFIG[entrada.destinatarioTipo];
  const destinatario = [
    `- Nombre: ${entrada.destinatarioNombre}`,
    entrada.destinatarioCargo ? `- Cargo: ${entrada.destinatarioCargo}` : null,
    entrada.contexto ? `- Contexto de la relacion: ${entrada.contexto}` : null,
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
    ...CARTA_BLOQUES.map((clave) => `- "${clave}": ${CARTA_BLOQUE_INSTRUCCION[clave]}`),
  ].join('\n');
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
    'Reescribe la carta COMPLETA corrigiendo exactamente eso. No expliques el',
    'cambio, no te disculpes: devuelve solo el JSON con los seis bloques.',
  ].join('\n');
}

export async function generarCarta(entrada: EntradaGeneracion): Promise<ResultadoGeneracion> {
  const sistema = instruccionDelSistema(entrada.datos, entrada.muestrasDeEstilo ?? []);
  const usuario = instruccionDeUsuario(entrada);
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
    let bloques = normalizarBloques(JSON.parse(respuesta.contenido));
    // Una respuesta a la que le falten bloques es peor que la plantilla: se
    // prefiere un borrador completo y editable antes que una carta con huecos.
    if (CARTA_BLOQUES.some((c) => !bloques[c].trim())) {
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
    let hallazgos = auditarInvencion(bloques, entrada.datos);
    if (hallazgos.length > 0) {
      console.error(`[cartas] auditoría: ${hallazgos.length} hallazgos en el primer intento - se reintenta`);
      const segunda = await llamarModelo(sistema, usuario + correccionTrasAuditoria(hallazgos));
      if (segunda.ok) {
        entradaTotal = (entradaTotal ?? 0) + (segunda.entrada ?? 0);
        salidaTotal = (salidaTotal ?? 0) + (segunda.salida ?? 0);
        try {
          const corregidos = normalizarBloques(JSON.parse(segunda.contenido));
          if (!CARTA_BLOQUES.some((c) => !corregidos[c].trim())) {
            const restantes = auditarInvencion(corregidos, entrada.datos);
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

export async function regenerarBloque(
  entrada: EntradaGeneracion & { bloque: CartaBloqueClave; bloquesActuales: CartaBloques },
): Promise<{ texto: string; modelo: string | null; tokensEntrada: number | null; tokensSalida: number | null; sinProveedor: boolean }> {
  // Sin proveedor configurado no tiene sentido "regenerar": la plantilla es
  // determinista y devolveria el mismo parrafo. Se dice con todas las letras
  // en vez de devolver un error generico que suena a falla intermitente.
  if (!modeloConfigurado()) {
    return { texto: '', modelo: null, tokensEntrada: null, tokensSalida: null, sinProveedor: true };
  }
  const sistema = instruccionDelSistema(entrada.datos, entrada.muestrasDeEstilo ?? []);
  const contexto = CARTA_BLOQUES.filter((c) => c !== entrada.bloque)
    .map((c) => `${c}: ${entrada.bloquesActuales[c]}`)
    .join('\n');

  const usuario = [
    instruccionDeUsuario(entrada),
    '',
    'AHORA SOLO se reescribe UN bloque. El resto de la carta ya esta escrito y no debe repetirse:',
    contexto,
    '',
    `Reescribe unicamente el bloque "${entrada.bloque}". ${CARTA_BLOQUE_INSTRUCCION[entrada.bloque]}`,
    `Devuelve SOLO un JSON con la clave "${entrada.bloque}".`,
  ].join('\n');

  const respuesta = await llamarModelo(sistema, usuario);
  if (!respuesta.ok) return { texto: '', modelo: null, tokensEntrada: null, tokensSalida: null, sinProveedor: false };

  try {
    const json = JSON.parse(respuesta.contenido) as Record<string, unknown>;
    const texto = json[entrada.bloque];
    return {
      texto: typeof texto === 'string' ? texto.trim() : '',
      modelo: respuesta.modelo,
      tokensEntrada: respuesta.entrada,
      tokensSalida: respuesta.salida,
      sinProveedor: false,
    };
  } catch {
    return { texto: '', modelo: respuesta.modelo, tokensEntrada: respuesta.entrada, tokensSalida: respuesta.salida, sinProveedor: false };
  }
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

export function borradorDePlantilla(entrada: EntradaGeneracion): CartaBloques {
  const { datos } = entrada;
  const escaso = inventarioEsEscaso(datos);
  const config = CARTA_DESTINATARIO_CONFIG[entrada.destinatarioTipo];
  const zonas = enumerar(datos.zonas.length > 0 ? datos.zonas : ['Quito']);
  // El cargo NO entra en el saludo: 'Estimada Gerente María Jaramillo' no es
  // castellano. El cargo ya se imprime en el bloque de destinatario del PDF.
  const tratamiento = entrada.destinatarioNombre;

  // Presentacion: nombre, empresa, zonas y especialidad en UNA frase que se
  // lea como una presentacion y no como cuatro campos pegados. El contexto que
  // escribio el agente abre la carta, porque es lo unico que el destinatario
  // reconoce de entrada.
  const quienSoy = datos.empresa
    ? `Mi nombre es ${datos.nombre} y trabajo como agente inmobiliario en ${datos.empresa}`
    : `Mi nombre es ${datos.nombre} y trabajo como agente inmobiliario independiente`;
  const presentacion = [
    entrada.contexto ? `${entrada.contexto}.` : null,
    `${quienSoy}. Me dedico a ${datos.especialidad} de inmuebles y opero en ${zonas}.`,
  ]
    .filter(Boolean)
    .join(' ');

  // Experiencia: los numeros solo si los hay, y redactados como respaldo, no
  // como planilla. Con cartera chica se habla de oficio, nunca de volumen.
  const respaldo: string[] = [];
  if (!escaso) {
    respaldo.push(
      `Hoy tengo ${datos.inmueblesActivos} inmuebles activos en cartera y ${datos.cierresRegistrados} cierres registrados en Redinmo.io${
        datos.aniosEnRedinmo >= 1 ? `, la red donde opero desde ${datos.anioIngreso}` : ''
      }.`,
    );
  }
  if (datos.aniosDeExperiencia) {
    respaldo.push(`Llevo ${datos.aniosDeExperiencia} años dedicado a esto.`);
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
    respaldo.push('Mi identidad está verificada en la plataforma y puede comprobarla en el enlace del pie de esta carta.');
  }

  // Inventario: complementa a la experiencia, no la repite. Con cartera chica
  // habla de criterio de seleccion, que es cierto y no depende del volumen.
  const inventario = escaso
    ? `Si lo que necesita no está entre los inmuebles que represento hoy, lo busco: formo parte de una red de agentes en ${zonas} y muevo el requerimiento hasta dar con lo que corresponde.`
    : `En este momento represento ${enumerar(
        datos.composicionInventario.map((c) => `${c.cantidad} ${pluralizar(c.tipo, c.cantidad)}`),
      )}.`;

  return {
    saludo: `Estimado/a ${tratamiento}:`,
    presentacion,
    experiencia: respaldo.join(' '),
    inventario,
    propuesta: `${config.fraseApertura} ${config.argumento}`,
    cierre: config.cierre,
  };
}

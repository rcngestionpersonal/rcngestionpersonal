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

// Generacion del texto de la carta.
//
// Usa el mismo proveedor que ya usa el proyecto para NLP (ver
// src/lib/real-estate/nlp.ts): OPENAI_API_KEY / OPENAI_MODEL. Sin clave
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

function modeloConfigurado(): { apiKey: string; modelo: string } | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return { apiKey, modelo: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini' };
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
    partes.push(
      '',
      'ESTE AGENTE TIENE CARTERA CHICA. No menciones cantidad de inmuebles ni de cierres,',
      'ni siquiera para decir que esta empezando. Construye el texto sobre su especialidad,',
      'las zonas que conoce, su forma de trabajar y su disposicion profesional.',
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
export type MotivoFallo = 'sin_clave' | 'http' | 'red' | 'respuesta_vacia';

// Un modelo que tarda mas que esto ya arruino la espera del agente: es mejor
// entregarle el borrador de plantilla al toque que dejarlo mirando un spinner.
const TIMEOUT_MS = 25_000;
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

export async function generarCarta(entrada: EntradaGeneracion): Promise<ResultadoGeneracion> {
  const sistema = instruccionDelSistema(entrada.datos, entrada.muestrasDeEstilo ?? []);
  const usuario = instruccionDeUsuario(entrada);
  const respuesta = await llamarModelo(sistema, usuario);

  // Sin clave, con el proveedor caido o con una respuesta ilegible: el agente
  // igual se lleva un borrador armado con sus datos reales. La carta puede
  // salir mas simple, nunca puede no salir.
  if (!respuesta.ok) {
    return {
      bloques: borradorDePlantilla(entrada),
      modelo: null,
      tokensEntrada: null,
      tokensSalida: null,
      usoPlantilla: true,
      motivoRespaldo: respuesta.motivo,
    };
  }

  try {
    const bloques = normalizarBloques(JSON.parse(respuesta.contenido));
    // Una respuesta a la que le falten bloques es peor que la plantilla: se
    // prefiere un borrador completo y editable antes que una carta con huecos.
    if (CARTA_BLOQUES.some((c) => !bloques[c].trim())) {
      console.error('[cartas] el generador devolvio bloques incompletos - se usa la plantilla');
      return {
        bloques: borradorDePlantilla(entrada),
        modelo: respuesta.modelo,
        tokensEntrada: respuesta.entrada,
        tokensSalida: respuesta.salida,
        usoPlantilla: true,
        motivoRespaldo: 'respuesta_vacia',
      };
    }
    return {
      bloques,
      modelo: respuesta.modelo,
      tokensEntrada: respuesta.entrada,
      tokensSalida: respuesta.salida,
      usoPlantilla: false,
    };
  } catch {
    console.error('[cartas] el generador devolvio un JSON invalido - se usa la plantilla');
    return {
      bloques: borradorDePlantilla(entrada),
      modelo: respuesta.modelo,
      tokensEntrada: respuesta.entrada,
      tokensSalida: respuesta.salida,
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

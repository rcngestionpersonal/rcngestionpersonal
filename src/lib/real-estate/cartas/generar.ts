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
  // true cuando no habia proveedor configurado y se uso la plantilla local.
  usoPlantilla: boolean;
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

async function llamarModelo(sistema: string, usuario: string): Promise<{ contenido: string; modelo: string; entrada: number | null; salida: number | null } | null> {
  const config = modeloConfigurado();
  if (!config) return null;

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
    });
    if (!respuesta.ok) return null;
    const payload = (await respuesta.json()) as RespuestaChat;
    const contenido = payload.choices?.[0]?.message?.content;
    if (!contenido) return null;
    return {
      contenido,
      modelo: config.modelo,
      entrada: payload.usage?.prompt_tokens ?? null,
      salida: payload.usage?.completion_tokens ?? null,
    };
  } catch {
    return null;
  }
}

export async function generarCarta(entrada: EntradaGeneracion): Promise<ResultadoGeneracion> {
  const sistema = instruccionDelSistema(entrada.datos, entrada.muestrasDeEstilo ?? []);
  const usuario = instruccionDeUsuario(entrada);
  const respuesta = await llamarModelo(sistema, usuario);

  if (!respuesta) {
    return { bloques: borradorDePlantilla(entrada), modelo: null, tokensEntrada: null, tokensSalida: null, usoPlantilla: true };
  }

  try {
    const bloques = normalizarBloques(JSON.parse(respuesta.contenido));
    // Una respuesta a la que le falten bloques es peor que la plantilla: se
    // prefiere un borrador completo y editable antes que una carta con huecos.
    if (CARTA_BLOQUES.some((c) => !bloques[c].trim())) {
      return { bloques: borradorDePlantilla(entrada), modelo: respuesta.modelo, tokensEntrada: respuesta.entrada, tokensSalida: respuesta.salida, usoPlantilla: true };
    }
    return {
      bloques,
      modelo: respuesta.modelo,
      tokensEntrada: respuesta.entrada,
      tokensSalida: respuesta.salida,
      usoPlantilla: false,
    };
  } catch {
    return { bloques: borradorDePlantilla(entrada), modelo: respuesta.modelo, tokensEntrada: respuesta.entrada, tokensSalida: respuesta.salida, usoPlantilla: true };
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
  if (!respuesta) return { texto: '', modelo: null, tokensEntrada: null, tokensSalida: null, sinProveedor: false };

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
export function borradorDePlantilla(entrada: EntradaGeneracion): CartaBloques {
  const { datos } = entrada;
  const escaso = inventarioEsEscaso(datos);
  const config = CARTA_DESTINATARIO_CONFIG[entrada.destinatarioTipo];
  const zonas = datos.zonas.length > 0 ? datos.zonas.join(', ') : 'Quito';
  const empresa = datos.empresa ? ` de ${datos.empresa}` : '';
  const tratamiento = entrada.destinatarioCargo
    ? `${entrada.destinatarioCargo} ${entrada.destinatarioNombre}`
    : entrada.destinatarioNombre;

  const experiencia = escaso
    ? `Trabajo enfocado en ${datos.especialidad} en ${zonas}, que es la zona que conozco a fondo.${
        datos.aniosDeExperiencia ? ` Tengo ${datos.aniosDeExperiencia} años en el sector inmobiliario.` : ''
      }`
    : `Tengo ${datos.inmueblesActivos} inmuebles activos en cartera y ${datos.cierresRegistrados} cierres registrados en Redinmo.io${
        datos.aniosEnRedinmo >= 1 ? `, donde opero desde ${datos.anioIngreso}` : ''
      }.`;

  const inventario = escaso
    ? `Me especializo en ${datos.especialidad} en ${zonas}, y selecciono cada inmueble que represento.`
    : `Hoy manejo ${datos.composicionInventario.map((c) => `${c.cantidad} ${pluralizar(c.tipo, c.cantidad)}`).join(', ')}.`;

  return {
    saludo: `Estimado/a ${tratamiento}:`,
    presentacion: `Mi nombre es ${datos.nombre}, agente inmobiliario${empresa}. Opero en ${zonas} y me dedico a ${datos.especialidad} de inmuebles.${
      entrada.contexto ? ` ${entrada.contexto}.` : ''
    }`,
    experiencia,
    inventario,
    propuesta: `${config.fraseApertura} Me gustaría conversar sobre cómo puedo ayudarle y explicarle en detalle cómo trabajo.`,
    cierre: 'Quedo atento a su respuesta para coordinar una conversación cuando le resulte conveniente.',
  };
}

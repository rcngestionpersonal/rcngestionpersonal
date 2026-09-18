// Contratos: tipos y configuracion de campos, compartidos entre cliente y
// servidor. Sin imports de Prisma para que el formulario del agente pueda
// importarlo sin arrastrar el backend.

import { DEFINICIONES_LEGADO, FIRMANTES_LEGADO } from './tipos-legado';

// Los valores del enum en la base. Se generan hoy el corretaje, las dos
// reservas y los tres arrendamientos (residencial, comercial e industrial). El
// resto son tipos RETIRADOS que siguen en el enum porque hay (o puede haber)
// contratos que los usan, y esos contratos se abren, se imprimen y se descargan
// igual que siempre. Lo que no se puede es crear otro.
//
// El enum NO se recorta al retirar un tipo: PostgreSQL no permite eliminar un
// valor de un enum sin recrear el tipo, y una fila que lo use quedaria huerfana.
export const CONTRATO_TIPOS = [
  'CORRETAJE',
  'ARRENDAMIENTO_RESIDENCIAL',
  'ARRENDAMIENTO_COMERCIAL',
  'ARRENDAMIENTO_INDUSTRIAL',
  'CORRETAJE_EXCLUSIVO',
  'CORRETAJE_ABIERTO',
  'ARRENDAMIENTO',
  'RESERVA_ARRIENDO',
  'RESERVA_COMPRAVENTA',
] as const;
export type ContratoTipo = (typeof CONTRATO_TIPOS)[number];

// Archivados y de solo lectura: no se ofrecen, no se editan y no se envían.
// Se conservan sus definiciones en ./tipos-legado para reimprimirlos.
export const CONTRATO_TIPOS_LEGADO: readonly ContratoTipo[] = [
  'CORRETAJE_EXCLUSIVO',
  'ARRENDAMIENTO',
  'CORRETAJE_ABIERTO',
];

export function esTipoArchivado(tipo: string): boolean {
  return (CONTRATO_TIPOS_LEGADO as readonly string[]).includes(tipo);
}

// ---------------------------------------------------------------------------
// ESTADOS
//
// El módulo no firma: cada envío es una versión que las partes aprueban o no.
// Y no la reciben a la vez. Primero la revisa el cliente del agente (la parte
// PRINCIPAL) y, solo cuando la aprueba y el agente lo decide, la contraparte:
//
//   BORRADOR → EN_REVISION_PRINCIPAL → APROBADO_PRINCIPAL
//            → EN_REVISION_CONTRAPARTE → APROBADO_FINAL
//
// Laterales: CAMBIOS_SOLICITADOS_PRINCIPAL, CAMBIOS_SOLICITADOS_CONTRAPARTE,
// VENCIDO y ANULADO.
// ---------------------------------------------------------------------------
export const CONTRATO_ESTADOS = [
  'BORRADOR',
  'EN_REVISION_PRINCIPAL',
  'APROBADO_PRINCIPAL',
  'EN_REVISION_CONTRAPARTE',
  'APROBADO_FINAL',
  'CAMBIOS_SOLICITADOS_PRINCIPAL',
  'CAMBIOS_SOLICITADOS_CONTRAPARTE',
  'VENCIDO',
  'ANULADO',
] as const;
export type ContratoEstado = (typeof CONTRATO_ESTADOS)[number];

// Valores del flujo anterior. Pueden seguir en la base hasta que corre la
// migración de datos (scripts/migrate-contratos-flujo-secuencial.ts): se leen
// como su equivalente y nunca se escriben.
const ESTADOS_ANTERIORES: Record<string, ContratoEstado> = {
  EN_APROBACION: 'EN_REVISION_PRINCIPAL',
  APROBADO: 'APROBADO_FINAL',
  RECHAZADO: 'CAMBIOS_SOLICITADOS_PRINCIPAL',
  // Firma electrónica retirada: firmado por todos, o que ya no puede concluir.
  FIRMADO: 'APROBADO_FINAL',
  PENDIENTE_FIRMA: 'VENCIDO',
};

export function estadoVigente(estado: string): ContratoEstado {
  if ((CONTRATO_ESTADOS as readonly string[]).includes(estado)) return estado as ContratoEstado;
  return ESTADOS_ANTERIORES[estado] ?? 'BORRADOR';
}

// En revisión: hay enlaces vivos esperando una decisión.
export function estaEnRevision(estado: string): boolean {
  const e = estadoVigente(estado);
  return e === 'EN_REVISION_PRINCIPAL' || e === 'EN_REVISION_CONTRAPARTE';
}

export const PARTE_ESTADOS = ['ENVIADO', 'ABIERTO', 'APROBADO', 'RECHAZADO', 'FIRMADO'] as const;
export type ParteEstado = (typeof PARTE_ESTADOS)[number];

export const VERSION_ESTADOS = ['EN_APROBACION', 'APROBADA', 'RECHAZADA', 'REEMPLAZADA', 'ANULADA'] as const;
export type VersionEstado = (typeof VERSION_ESTADOS)[number];

// Un contrato del flujo de firma retirado: se abre y se descarga, nada más. Se
// reconoce por sus firmantes, que no pertenecen a ninguna versión; el estado
// solo cuenta mientras no corrió la migración.
export function esEstadoDeFirmaLegado(estado: string): boolean {
  return estado === 'PENDIENTE_FIRMA' || estado === 'FIRMADO';
}

export function esContratoDeFirmaLegado(contrato: { estado: string; partes: Array<{ versionId: string | null }> }): boolean {
  return esEstadoDeFirmaLegado(contrato.estado) || contrato.partes.some((p) => !p.versionId);
}

// ---------------------------------------------------------------------------
// ETAPAS Y LADOS
//
// Cada documento tiene lados: vendedor y comprador, arrendador y arrendatario.
// El agente dice a cuál representa (por defecto, al propietario) y ese lado es
// la etapa PRINCIPAL; el resto, la CONTRAPARTE. Un lado sin partes en el
// documento no tiene etapa: en la reserva de arrendamiento el arrendador no
// comparece, así que la revisa solo el interesado.
// ---------------------------------------------------------------------------
export type Etapa = 'PRINCIPAL' | 'CONTRAPARTE';
export const ETAPAS: readonly Etapa[] = ['PRINCIPAL', 'CONTRAPARTE'];

export type LadoDefinicion = { clave: string; etiqueta: string; roles: string[] };

type LadosDelTipo = { porDefecto: string; lados: LadoDefinicion[] };

const LADOS_ARRENDAMIENTO: LadosDelTipo = {
  porDefecto: 'ARRENDADOR',
  lados: [
    { clave: 'ARRENDADOR', etiqueta: 'Arrendador', roles: ['arrendador'] },
    { clave: 'ARRENDATARIO', etiqueta: 'Arrendatario', roles: ['arrendatario'] },
  ],
};

export const LADOS_POR_TIPO: Partial<Record<ContratoTipo, LadosDelTipo>> = {
  CORRETAJE: { porDefecto: 'PROPIETARIO', lados: [{ clave: 'PROPIETARIO', etiqueta: 'Propietario', roles: ['propietario'] }] },
  ARRENDAMIENTO_RESIDENCIAL: LADOS_ARRENDAMIENTO,
  ARRENDAMIENTO_COMERCIAL: LADOS_ARRENDAMIENTO,
  ARRENDAMIENTO_INDUSTRIAL: {
    porDefecto: 'ARRENDADOR',
    lados: [
      { clave: 'ARRENDADOR', etiqueta: 'Arrendadora', roles: ['arrendador'] },
      { clave: 'ARRENDATARIO', etiqueta: 'Arrendataria', roles: ['arrendatario'] },
    ],
  },
  RESERVA_COMPRAVENTA: {
    porDefecto: 'VENDEDOR',
    lados: [
      { clave: 'VENDEDOR', etiqueta: 'Vendedor', roles: ['vendedor'] },
      { clave: 'COMPRADOR', etiqueta: 'Comprador', roles: ['comprador'] },
    ],
  },
  RESERVA_ARRIENDO: {
    porDefecto: 'ARRENDADOR',
    lados: [
      { clave: 'ARRENDADOR', etiqueta: 'Arrendador', roles: [] },
      { clave: 'INTERESADO', etiqueta: 'Interesado', roles: ['interesado'] },
    ],
  },
};

export function ladosDelTipo(tipo: ContratoTipo): LadosDelTipo | null {
  return LADOS_POR_TIPO[tipo] ?? null;
}

// El lado que representa el agente. Un valor que no corresponde al tipo cae al
// de por defecto: nunca deja un contrato sin etapa principal definida.
export function ladoRepresentado(tipo: ContratoTipo, representa: string | null | undefined): LadoDefinicion | null {
  const def = ladosDelTipo(tipo);
  if (!def) return null;
  return def.lados.find((l) => l.clave === representa) ?? def.lados.find((l) => l.clave === def.porDefecto) ?? null;
}

// Roles del documento (sin el agente) que aprueban en cada etapa.
export function rolesPorEtapa(tipo: ContratoTipo, representa: string | null | undefined): Record<Etapa, string[]> {
  const def = ladosDelTipo(tipo);
  const principal = ladoRepresentado(tipo, representa);
  if (!def || !principal) return { PRINCIPAL: [], CONTRAPARTE: [] };
  return {
    PRINCIPAL: principal.roles,
    CONTRAPARTE: def.lados.filter((l) => l.clave !== principal.clave).flatMap((l) => l.roles),
  };
}

// Cómo se nombra cada etapa en la pantalla: "Vendedor", "Comprador". null si
// la etapa no existe en ese documento.
export function etiquetasEtapas(tipo: ContratoTipo, representa: string | null | undefined): Record<Etapa, string | null> {
  const def = ladosDelTipo(tipo);
  const principal = ladoRepresentado(tipo, representa);
  if (!def || !principal) return { PRINCIPAL: null, CONTRAPARTE: null };
  const otros = def.lados.filter((l) => l.clave !== principal.clave && l.roles.length > 0);
  return {
    PRINCIPAL: principal.roles.length > 0 ? principal.etiqueta : null,
    CONTRAPARTE: otros.length > 0 ? otros.map((l) => l.etiqueta).join(' y ') : null,
  };
}

// Quita el sufijo de persona adicional: "vendedor_2" es del lado "vendedor".
export function rolBase(rol: string): string {
  return rol.replace(/_\d+$/, '');
}

export function etapaDeRol(tipo: ContratoTipo, representa: string | null | undefined, rol: string): Etapa | null {
  const roles = rolesPorEtapa(tipo, representa);
  const base = rolBase(rol);
  if (roles.PRINCIPAL.includes(base)) return 'PRINCIPAL';
  if (roles.CONTRAPARTE.includes(base)) return 'CONTRAPARTE';
  return null;
}

// Vigencia del enlace de revisión, configurable en cada envío. Por defecto 72
// horas en las reservas, que se negocian en días, y 5 días en el resto.
export const VIGENCIAS_HORAS = [24, 48, 72, 120, 168, 360] as const;

export function vigenciaPorDefectoHoras(tipo: ContratoTipo): number {
  return tipo === 'RESERVA_COMPRAVENTA' || tipo === 'RESERVA_ARRIENDO' ? 72 : 120;
}

export function vigenciaValida(horas: unknown): horas is number {
  return typeof horas === 'number' && (VIGENCIAS_HORAS as readonly number[]).includes(horas);
}

// Aviso de "está por vencer" para el agente.
export const HORAS_AVISO_VENCIMIENTO = 24;

// Hasta cuántas personas comparecen en un mismo lado (cónyuges, convivientes o
// copropietarios). Todas aprueban antes de pasar a la etapa siguiente.
export const MAX_PERSONAS_POR_LADO = 3;

// Lo que se imprime donde un campo opcional quedó sin llenar. Un marcador
// visible y no un hueco en blanco: un espacio vacío pasa desapercibido al
// revisar, y aparece en el documento que se lleva a la notaría sin que nadie
// lo note.
export const MARCADOR_SIN_COMPLETAR = '[ POR COMPLETAR ]';

// ---------------------------------------------------------------------------
// AVISOS
//
// Viven aca, en un solo lugar, y NUNCA se exponen como campo editable del
// formulario. Ninguno se imprime dentro del cuerpo del contrato: el documento
// es del agente y de sus clientes y no lleva marca de la plataforma. Solo el
// anexo de constancia identifica el sistema que registró las aprobaciones.
// ---------------------------------------------------------------------------

// Nota en la app, bajo el selector de contrato.
export const AVISO_MODULO =
  'Son modelos que la plataforma te sugiere, elaborados sobre formatos de uso común en el mercado inmobiliario ecuatoriano. El documento es tuyo y de tus clientes: revísalo, ajústalo y, en operaciones de alto valor o con condiciones especiales, consúltalo con un abogado.';

// La advertencia que ven las partes al revisar. Obligatoria, visible y con el
// mismo peso tipográfico que el resto de la página: nunca en letra chica.
export const AVISO_APROBACION =
  'Esta aprobación deja constancia de que usted revisó y está de acuerdo con esta versión del documento. NO es una firma. El contrato debe suscribirse personalmente y, cuando corresponda, legalizarse ante notario.';

// La casilla que marca la parte. Se guarda literal en su registro: lo que
// declaró es exactamente esto.
export const DECLARACION_APROBACION = 'He leído íntegramente esta versión del documento y estoy de acuerdo con su contenido.';

// Lo que ven las PARTES junto a la decisión: informa un derecho, no advierte
// sobre el documento.
export const AVISO_PAGINA_APROBACION =
  'Antes de aprobar puede descargar esta versión, consultarla con un profesional de su confianza o pedir cambios a quien se la envió. Si no está de acuerdo con algo, no la apruebe: indique qué necesita cambiar y recibirá una versión nueva.';

// Pie del anexo de constancia.
export const AVISO_REDINMO_NO_ES_PARTE =
  'Redinmo.io es la herramienta con la que se registraron estas aprobaciones. No es parte del contrato, no interviene en lo acordado entre las partes y no presta servicios legales.';

export const NOTA_ANEXO_SEPARABLE =
  'Este anexo no forma parte del contrato. Registra la revisión del borrador por las partes y puede omitirse al imprimir el documento para suscribirlo.';

// Nota que acompaña a toda cláusula opcional que puede no ser válida.
export const NOTA_CLAUSULA_DISCUTIBLE =
  'Esta cláusula es de uso frecuente pero su validez puede discutirse. Consúltala con un abogado antes de activarla.';

// Aviso antes de descargar el Word.
export const AVISO_EXPORTAR_WORD =
  'Si editas el documento fuera de la plataforma, no podrás enviarlo para aprobación desde aquí.';

// Enlaces de apoyo junto al formulario.
export const ENLACE_REVISION_ABOGADO = '/legal/revision-abogado';
export const ENLACE_REVISION_ABOGADO_ETIQUETA = '¿Necesitas que un abogado lo revise?';
export const ENLACE_EXPLICAR_CLIENTE = '/ayuda/explicar-el-contrato';
export const ENLACE_EXPLICAR_CLIENTE_ETIQUETA = '¿Cómo explicarle este documento a tu cliente?';

export type CampoTipo = 'texto' | 'cedula' | 'correo' | 'telefono' | 'numero' | 'dinero' | 'porcentaje' | 'fecha' | 'opcion' | 'opcionExplicada' | 'multiple' | 'area';

export type CampoOpcion = {
  valor: string;
  etiqueta: string;
  // Qué pasa de verdad si se elige esto. Obligatorio de hecho en 'opcionExplicada'.
  consecuencia?: string;
};

export type CampoDefinicion = {
  clave: string;
  etiqueta: string;
  tipo: CampoTipo;
  obligatorio?: boolean;
  porDefecto?: string;
  opciones?: CampoOpcion[];
  ayuda?: string;
  // Largo mínimo razonable de un texto que se imprime tal cual (la descripción
  // del inmueble): dos líneas sueltas no describen nada.
  minimo?: number;
  // El campo se puede prellenar con los datos de un inmueble del inventario.
  // La pantalla ofrece el botón; lo que quede escrito es del agente.
  desdeInmueble?: boolean;
  // Legado: los tipos retirados marcaban así los datos de cada firmante.
  rolFirmante?: string;
  // El campo solo existe si otro campo tiene uno de estos valores (o, con una
  // lista, si se cumplen todas). Oculto, no se pide ni se valida: los datos de
  // una compañía no se exigen a una persona.
  visibleSi?: CondicionCampo | CondicionCampo[];
};

export type CondicionCampo = { clave: string; valores: string[] };

export type SeccionDefinicion = {
  clave: string;
  titulo: string;
  descripcion?: string;
  campos: CampoDefinicion[];
};

export type TipoDefinicion = {
  titulo: string;
  // Una línea para el selector: cuándo usarlo, dicho como lo diría un agente.
  descripcion: string;
  nombreDocumento: string;
  requiereInmueble: boolean;
  ayuda?: string;
  secciones: SeccionDefinicion[];
};

const SI_NO = [
  { valor: 'SI', etiqueta: 'Sí' },
  { valor: 'NO', etiqueta: 'No' },
];

const TIPO_DOCUMENTO = [
  { valor: 'CEDULA', etiqueta: 'Cédula' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
];

export const TIPO_PERSONA = [
  { valor: 'NATURAL', etiqueta: 'Persona natural' },
  { valor: 'JURIDICA', etiqueta: 'Compañía (persona jurídica)' },
];

// Parte que comparece: una persona o una compañía con su representante legal.
// "extras" añade lo que cada contrato pide de más: el corretaje distingue
// cédula de pasaporte.
export function parte(
  rol: string,
  titulo: string,
  extras: { tipoDocumento?: boolean; juridicaPorDefecto?: boolean; descripcion?: string; estadoCivil?: boolean } = {},
): SeccionDefinicion {
  const natural = { clave: `${rol}_tipoPersona`, valores: ['NATURAL'] };
  const juridica = { clave: `${rol}_tipoPersona`, valores: ['JURIDICA'] };
  const campos: CampoDefinicion[] = [
    {
      clave: `${rol}_tipoPersona`,
      etiqueta: 'Comparece como',
      tipo: 'opcion',
      obligatorio: true,
      porDefecto: extras.juridicaPorDefecto ? 'JURIDICA' : 'NATURAL',
      opciones: TIPO_PERSONA,
    },
    { clave: `${rol}_nombre`, etiqueta: 'Nombre completo', tipo: 'texto', obligatorio: true, visibleSi: natural },
  ];
  if (extras.tipoDocumento) {
    campos.push({
      clave: `${rol}_tipoDocumento`,
      etiqueta: 'Tipo de documento',
      tipo: 'opcion',
      obligatorio: true,
      porDefecto: 'CEDULA',
      opciones: TIPO_DOCUMENTO,
      visibleSi: natural,
    });
  }
  campos.push(
    {
      clave: `${rol}_cedula`,
      etiqueta: extras.tipoDocumento ? 'Número de documento' : 'Cédula',
      tipo: 'cedula',
      obligatorio: true,
      visibleSi: natural,
    },
    ...(extras.estadoCivil
      ? [{ clave: `${rol}_estadoCivil`, etiqueta: 'Estado civil', tipo: 'texto' as const, visibleSi: natural }]
      : []),
    { clave: `${rol}_razonSocial`, etiqueta: 'Razón social', tipo: 'texto', obligatorio: true, visibleSi: juridica },
    { clave: `${rol}_ruc`, etiqueta: 'RUC', tipo: 'cedula', obligatorio: true, visibleSi: juridica },
    {
      clave: `${rol}_representante`,
      etiqueta: 'Representante legal',
      tipo: 'texto',
      obligatorio: true,
      visibleSi: juridica,
      ayuda: 'Nombre completo de quien comparece por la compañía. Es quien revisa y aprueba el documento.',
    },
    {
      clave: `${rol}_representanteCedula`,
      etiqueta: 'Cédula del representante',
      tipo: 'cedula',
      obligatorio: true,
      visibleSi: juridica,
    },
    {
      clave: `${rol}_telefono`,
      etiqueta: 'Teléfono (WhatsApp)',
      tipo: 'telefono',
      obligatorio: true,
      ayuda: 'El enlace para revisar cada versión se comparte de preferencia por WhatsApp.',
    },
    {
      clave: `${rol}_correo`,
      etiqueta: 'Correo electrónico',
      tipo: 'correo',
      ayuda: 'Opcional. Si lo tiene, el enlace también puede llegarle por correo.',
    },
    { clave: `${rol}_direccion`, etiqueta: 'Domicilio', tipo: 'texto', obligatorio: true },
    {
      clave: `${rol}_personas`,
      etiqueta: 'Personas en este lado',
      tipo: 'opcion',
      obligatorio: true,
      porDefecto: '1',
      opciones: [
        { valor: '1', etiqueta: 'Una' },
        { valor: '2', etiqueta: 'Dos' },
        { valor: '3', etiqueta: 'Tres' },
      ],
      visibleSi: natural,
      ayuda: 'Si comparecen cónyuges, convivientes o copropietarios, agrégalos: cada uno recibe su enlace y todos deben aprobar.',
    },
  );
  return { clave: rol, titulo, descripcion: extras.descripcion, campos };
}

const ORDINAL_PERSONA: Record<number, string> = { 2: 'segunda persona', 3: 'tercera persona' };

// Las demás personas de un lado: la segunda y la tercera. Comparecen como
// personas naturales junto a la primera, bajo la misma denominación, y cada
// una aprueba con su propio enlace.
function personasAdicionales(
  rol: string,
  titulo: string,
  extras: { tipoDocumento?: boolean; estadoCivil?: boolean },
): SeccionDefinicion[] {
  const secciones: SeccionDefinicion[] = [];
  for (let n = 2; n <= MAX_PERSONAS_POR_LADO; n += 1) {
    const visible: CondicionCampo[] = [
      { clave: `${rol}_tipoPersona`, valores: ['NATURAL'] },
      { clave: `${rol}_personas`, valores: ['2', '3'].filter((v) => Number(v) >= n) },
    ];
    const r = `${rol}_${n}`;
    const campos: CampoDefinicion[] = [
      { clave: `${r}_nombre`, etiqueta: 'Nombre completo', tipo: 'texto', obligatorio: true, visibleSi: visible },
    ];
    if (extras.tipoDocumento) {
      campos.push({
        clave: `${r}_tipoDocumento`,
        etiqueta: 'Tipo de documento',
        tipo: 'opcion',
        obligatorio: true,
        porDefecto: 'CEDULA',
        opciones: TIPO_DOCUMENTO,
        visibleSi: visible,
      });
    }
    campos.push(
      {
        clave: `${r}_cedula`,
        etiqueta: extras.tipoDocumento ? 'Número de documento' : 'Cédula',
        tipo: 'cedula',
        obligatorio: true,
        visibleSi: visible,
      },
      ...(extras.estadoCivil ? [{ clave: `${r}_estadoCivil`, etiqueta: 'Estado civil', tipo: 'texto' as const, visibleSi: visible }] : []),
      { clave: `${r}_telefono`, etiqueta: 'Teléfono (WhatsApp)', tipo: 'telefono', obligatorio: true, visibleSi: visible },
      { clave: `${r}_correo`, etiqueta: 'Correo electrónico', tipo: 'correo', visibleSi: visible, ayuda: 'Opcional.' },
      {
        clave: `${r}_direccion`,
        etiqueta: 'Domicilio',
        tipo: 'texto',
        visibleSi: visible,
        ayuda: 'Si lo dejas vacío, se usa el de la primera persona.',
      },
    );
    secciones.push({
      clave: r,
      titulo: `${titulo} · ${ORDINAL_PERSONA[n]}`,
      descripcion: 'Recibe su propio enlace y también debe aprobar antes de pasar a la etapa siguiente.',
      campos,
    });
  }
  return secciones;
}

// Un lado completo del documento: la primera persona (o la compañía) y, si
// hace falta, las demás personas de ese mismo lado.
export function lado(
  rol: string,
  titulo: string,
  extras: { tipoDocumento?: boolean; juridicaPorDefecto?: boolean; descripcion?: string; estadoCivil?: boolean } = {},
): SeccionDefinicion[] {
  return [parte(rol, titulo, extras), ...personasAdicionales(rol, titulo, extras)];
}

// El agente también es parte en los documentos donde actúa como corredor, y
// puede comparecer a su nombre o por su empresa. Su nombre y su cédula salen
// del perfil; aquí solo se pide lo que el perfil no guarda.
export function parteAgente(rol: string, titulo: string): SeccionDefinicion {
  const juridica = { clave: `${rol}_tipoPersona`, valores: ['JURIDICA'] };
  return {
    clave: rol,
    titulo,
    descripcion: 'Tu nombre, cédula y licencia salen de tu perfil.',
    campos: [
      {
        clave: `${rol}_tipoPersona`,
        etiqueta: 'Comparezco',
        tipo: 'opcion',
        obligatorio: true,
        porDefecto: 'NATURAL',
        opciones: [
          { valor: 'NATURAL', etiqueta: 'A mi nombre' },
          { valor: 'JURIDICA', etiqueta: 'Por mi empresa (persona jurídica)' },
        ],
      },
      { clave: `${rol}_razonSocial`, etiqueta: 'Razón social de tu empresa', tipo: 'texto', obligatorio: true, visibleSi: juridica },
      { clave: `${rol}_ruc`, etiqueta: 'RUC de tu empresa', tipo: 'cedula', obligatorio: true, visibleSi: juridica },
    ],
  };
}

// ---------------------------------------------------------------------------
// JURISDICCIÓN Y SOLUCIÓN DE CONTROVERSIAS
//
// Dónde se resuelve un problema y por qué vía. Las tres vías cambian el texto
// de la cláusula, y el arbitraje cierra la puerta a los jueces ordinarios: por
// eso su consecuencia se explica en la pantalla del agente (nunca en el PDF).
// ---------------------------------------------------------------------------
const CIUDADES: Array<{ valor: string; nombre: string }> = [
  { valor: 'QUITO', nombre: 'Quito' },
  { valor: 'GUAYAQUIL', nombre: 'Guayaquil' },
  { valor: 'CUENCA', nombre: 'Cuenca' },
  { valor: 'MANTA', nombre: 'Manta' },
  { valor: 'PORTOVIEJO', nombre: 'Portoviejo' },
  { valor: 'AMBATO', nombre: 'Ambato' },
  { valor: 'SANTO_DOMINGO', nombre: 'Santo Domingo' },
];

export const CIUDAD_JURISDICCION_OPCIONES: CampoOpcion[] = [
  { valor: 'INMUEBLE', etiqueta: 'La del inmueble' },
  ...CIUDADES.map((c) => ({ valor: c.valor, etiqueta: c.nombre })),
  { valor: 'OTRA', etiqueta: 'Otra' },
];

export function nombreDeCiudad(valor: string): string {
  return CIUDADES.find((c) => c.valor === valor)?.nombre ?? '';
}

// El centro que corresponde a cada ciudad. Es solo el punto de partida: el
// agente puede cambiarlo, porque cada cámara nombra al suyo a su manera.
export function centroPorDefecto(ciudad: string): string {
  const limpia = ciudad.trim();
  return limpia ? `Centro de Arbitraje y Mediación de la Cámara de Comercio de ${limpia}` : '';
}

// La ciudad que gobierna el contrato: la elegida, la escrita a mano o, por
// defecto, la del inmueble. La usan el formulario y la plantilla.
export function ciudadDeJurisdiccion(datos: Record<string, string>): string {
  const eleccion = (datos.jurisdiccionCiudad ?? '').trim() || 'INMUEBLE';
  if (eleccion === 'OTRA') return (datos.jurisdiccionCiudadOtra ?? '').trim();
  if (eleccion !== 'INMUEBLE') return nombreDeCiudad(eleccion);
  return (datos.propiedadCiudad ?? '').trim();
}

export const VIA_MEDIACION_JUECES = 'MEDIACION_JUECES';
export const VIA_ARBITRAJE = 'ARBITRAJE';
export const VIA_JUECES = 'JUECES';

// Los campos de jurisdicción, en el orden en que se leen.
function jurisdiccionYControversias(): CampoDefinicion[] {
  return [
    {
      clave: 'jurisdiccionCiudad',
      etiqueta: 'Ciudad de jurisdicción y competencia',
      tipo: 'opcion',
      obligatorio: true,
      porDefecto: 'INMUEBLE',
      opciones: CIUDAD_JURISDICCION_OPCIONES,
      ayuda: 'Dónde se resuelve el contrato si hay un problema. Por defecto, la ciudad del inmueble.',
    },
    {
      clave: 'jurisdiccionCiudadOtra',
      etiqueta: 'Escribe la ciudad',
      tipo: 'texto',
      obligatorio: true,
      visibleSi: { clave: 'jurisdiccionCiudad', valores: ['OTRA'] },
    },
    {
      clave: 'controversiasVia',
      etiqueta: 'Mecanismo de solución de controversias',
      tipo: 'opcionExplicada',
      obligatorio: true,
      porDefecto: VIA_MEDIACION_JUECES,
      opciones: [
        {
          valor: VIA_MEDIACION_JUECES,
          etiqueta: 'Mediación y, de no haber acuerdo, jueces competentes',
          consecuencia: 'Primero se intenta un acuerdo en el centro de mediación. Si no lo hay, queda abierta la vía judicial de siempre.',
        },
        {
          valor: VIA_ARBITRAJE,
          etiqueta: 'Arbitraje y mediación',
          consecuencia: 'El arbitraje excluye la vía judicial ordinaria y tiene costos del centro.',
        },
        {
          valor: VIA_JUECES,
          etiqueta: 'Solo jueces competentes',
          consecuencia: 'Sin paso previo de mediación: cualquier desacuerdo va directo a los jueces de la ciudad elegida.',
        },
      ],
    },
    {
      clave: 'centroMediacion',
      etiqueta: 'Centro de mediación o arbitraje',
      tipo: 'texto',
      ayuda: 'Se propone el de la cámara de comercio de la ciudad elegida. Cámbialo si el centro se llama distinto.',
      visibleSi: { clave: 'controversiasVia', valores: [VIA_MEDIACION_JUECES, VIA_ARBITRAJE] },
    },
  ];
}

const JURISDICCION: CampoDefinicion = {
  clave: 'ciudadJurisdiccion',
  etiqueta: 'Ciudad de los jueces competentes',
  tipo: 'texto',
  ayuda: 'Si lo dejas vacío, se usa la ciudad de tu perfil.',
};

// ---------------------------------------------------------------------------
// TIPOS VIVOS
// ---------------------------------------------------------------------------
const DEFINICIONES_VIVAS: Record<string, TipoDefinicion> = {
  CORRETAJE: {
    titulo: 'Corretaje inmobiliario',
    descripcion: 'Cuando un propietario te encarga vender su inmueble, con o sin exclusividad.',
    nombreDocumento: 'CONTRATO DE CORRETAJE INMOBILIARIO',
    // El inmueble se está captando: todavía no está en "Tus inmuebles", así que
    // el contrato se describe con lo que escribe el agente.
    requiereInmueble: false,
    secciones: [
      ...lado('propietario', 'Datos del propietario', { tipoDocumento: true }),
      parteAgente('corredor', 'Tú, como corredor'),
      {
        clave: 'exclusividad',
        titulo: 'Modalidad',
        descripcion: 'Cambia el alcance del encargo y cuándo se te deben los honorarios.',
        campos: [
          {
            clave: 'exclusividad',
            // "La consignación se otorga" venía de la plantilla de reserva. Lo
            // que se otorga aquí es el encargo de venta.
            etiqueta: 'El encargo se otorga',
            tipo: 'opcionExplicada',
            // ----------------------------------------------------------------
            // SIN VALOR POR DEFECTO, A PROPÓSITO. NO AÑADIR UNO.
            // Es la decisión que más cambia el contrato y la que el propietario
            // más negocia. Un default la tomaría por el agente sin que la note.
            // ----------------------------------------------------------------
            obligatorio: true,
            opciones: [
              {
                valor: 'CON',
                etiqueta: 'Con exclusividad',
                consecuencia:
                  'Durante la vigencia solo tú comercializas el inmueble. Si se vende por otra vía, igual se te deben los honorarios pactados.',
              },
              {
                valor: 'SIN',
                etiqueta: 'Sin exclusividad',
                consecuencia:
                  'El propietario puede vender por su cuenta o con otros agentes. Cobras solo si el comprador fue presentado por ti.',
              },
            ],
          },
        ],
      },
      {
        clave: 'promocion',
        titulo: 'Promoción',
        campos: [
          {
            clave: 'rotuloAutorizado',
            etiqueta: '¿Autoriza rótulo o aviso en la propiedad?',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'SI',
            opciones: SI_NO,
          },
        ],
      },
      {
        clave: 'honorarios',
        titulo: 'Honorarios',
        campos: [
          {
            clave: 'honorariosPorcentaje',
            etiqueta: 'Honorarios (% del precio real de venta)',
            tipo: 'porcentaje',
            obligatorio: true,
            porDefecto: '3',
          },
          {
            clave: 'ivaTarifa',
            etiqueta: 'Tarifa de IVA (%)',
            tipo: 'porcentaje',
            ayuda: 'Déjalo vacío y el documento dirá "a la tarifa vigente", sin fijar un número que mañana cambie.',
          },
          {
            clave: 'honorariosPlazoDias',
            etiqueta: 'Plazo para pagar los honorarios (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '8',
          },
        ],
      },
      {
        clave: 'documentos',
        titulo: 'Documentos del propietario',
        campos: [
          {
            clave: 'documentosPlazoDias',
            etiqueta: 'Plazo para entregarlos (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '15',
          },
        ],
      },
      {
        clave: 'vigencia',
        titulo: 'Vigencia',
        campos: [
          { clave: 'vigenciaMeses', etiqueta: 'Vigencia (meses)', tipo: 'numero', obligatorio: true, porDefecto: '6' },
          {
            clave: 'prorrogaAvisoDias',
            etiqueta: 'Aviso para no prorrogar (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '15',
          },
          {
            clave: 'renunciaAvisoDias',
            etiqueta: 'Aviso si tú renuncias al encargo (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '15',
          },
        ],
      },
      {
        clave: 'propiedad',
        titulo: 'El inmueble',
        descripcion: 'En el corretaje el inmueble todavía se está captando: lo que escribas aquí es lo que describe el contrato.',
        campos: [
          {
            clave: 'inmuebleDescripcion',
            etiqueta: 'Descripción del inmueble',
            tipo: 'area',
            obligatorio: true,
            minimo: 120,
            desdeInmueble: true,
            ayuda:
              'Sale en el contrato tal como la escribas. Incluye tipo de inmueble, ubicación y referencia, área del terreno y de construcción, número de pisos, dormitorios, baños, parqueaderos, bodega, estado y demás características relevantes.',
          },
          { clave: 'precio', etiqueta: 'Precio de venta', tipo: 'dinero', obligatorio: true },
          { clave: 'propiedadDireccion', etiqueta: 'Dirección', tipo: 'texto', obligatorio: true },
          { clave: 'propiedadCiudad', etiqueta: 'Ciudad', tipo: 'texto', obligatorio: true },
          { clave: 'propiedadProvincia', etiqueta: 'Provincia', tipo: 'texto', obligatorio: true },
          { clave: 'propiedadPredio', etiqueta: 'Número de predio', tipo: 'texto' },
        ],
      },
      {
        clave: 'jurisdiccion',
        titulo: 'Jurisdicción y controversias',
        campos: jurisdiccionYControversias(),
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// ARRENDAMIENTOS
//
// Tres documentos según el tipo de inmueble, cada uno sobre un contrato real
// usado en el mercado (con sus datos retirados): vivienda, local u oficina, y
// bodega o galpón. Las renuncias de validez discutible no son campos: son
// cláusulas opcionales, apagadas, que el agente activa en el editor de
// cláusulas con la nota de consultar a un abogado.
// ---------------------------------------------------------------------------

const VIA_CONTROVERSIAS = (porDefecto: 'JUECES' | 'ARBITRAJE'): CampoDefinicion => ({
  clave: 'viaControversias',
  etiqueta: 'Si no hay acuerdo en mediación',
  tipo: 'opcion',
  obligatorio: true,
  porDefecto,
  opciones: [
    { valor: 'JUECES', etiqueta: 'Jueces competentes' },
    { valor: 'ARBITRAJE', etiqueta: 'Arbitraje' },
  ],
});

// Solo lo usa la cláusula opcional de desalojo; si no se activa, no se imprime.
const DESALOJO_DIAS: CampoDefinicion = {
  clave: 'desalojoDias',
  etiqueta: 'Días para restituir tras la terminación',
  tipo: 'numero',
  porDefecto: '8',
  ayuda: 'Solo se usa si activas la cláusula opcional de desalojo en el paso de cláusulas.',
};

const DEFINICIONES_ARRENDAMIENTO: Record<string, TipoDefinicion> = {
  ARRENDAMIENTO_RESIDENCIAL: {
    titulo: 'Arrendamiento residencial',
    descripcion: 'Cuando arriendas una casa, departamento o suite para que alguien viva ahí.',
    nombreDocumento: 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA',
    requiereInmueble: true,
    secciones: [
      ...lado('arrendador', 'Arrendador (propietario)'),
      ...lado('arrendatario', 'Arrendatario (inquilino)'),
      {
        clave: 'inmueble',
        titulo: 'El inmueble',
        campos: [
          {
            clave: 'inmuebleDescripcion',
            etiqueta: 'Qué se arrienda',
            tipo: 'texto',
            obligatorio: true,
            ayuda: 'Tipo y unidad, con estacionamientos y bodegas. Ej.: departamento 4B, con un estacionamiento y una bodega.',
          },
          { clave: 'inmuebleDireccion', etiqueta: 'Dirección', tipo: 'texto', obligatorio: true },
          { clave: 'inmuebleEdificio', etiqueta: 'Edificio o conjunto', tipo: 'texto', ayuda: 'Déjalo vacío si es una casa independiente.' },
          { clave: 'inmuebleParroquia', etiqueta: 'Parroquia', tipo: 'texto' },
          { clave: 'inmuebleCiudad', etiqueta: 'Ciudad', tipo: 'texto', obligatorio: true },
          { clave: 'inmuebleProvincia', etiqueta: 'Provincia', tipo: 'texto', obligatorio: true },
          {
            clave: 'tituloPropiedad',
            etiqueta: 'Escritura e inscripción',
            tipo: 'texto',
            ayuda: 'Opcional. Ej.: escritura otorgada el 3 de mayo de 2019 ante la Notaría Vigésima Cuarta de Quito, inscrita el 20 de mayo de 2019.',
          },
        ],
      },
      {
        clave: 'entrega',
        titulo: 'Entrega',
        campos: [
          { clave: 'estadoEntrega', etiqueta: 'Estado en que se entrega', tipo: 'texto', obligatorio: true, porDefecto: 'en buenas condiciones de uso' },
          { clave: 'amoblado', etiqueta: '¿Se entrega amoblado?', tipo: 'opcion', obligatorio: true, porDefecto: 'NO', opciones: SI_NO },
          { clave: 'serviciosPagadosHasta', etiqueta: 'Servicios básicos pagados hasta (mes)', tipo: 'texto' },
          { clave: 'ocupantesMaximo', etiqueta: 'Número máximo de ocupantes', tipo: 'numero' },
        ],
      },
      {
        clave: 'canon',
        titulo: 'Canon y alícuota',
        campos: [
          { clave: 'canon', etiqueta: 'Canon mensual', tipo: 'dinero', obligatorio: true },
          {
            clave: 'alicuota',
            etiqueta: 'La alícuota ordinaria',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'ARRENDATARIO',
            opciones: [
              { valor: 'ARRENDATARIO', etiqueta: 'La paga el inquilino aparte' },
              { valor: 'INCLUIDA', etiqueta: 'Está incluida en el canon' },
              { valor: 'NO_APLICA', etiqueta: 'No hay alícuota' },
            ],
          },
          { clave: 'diaPago', etiqueta: 'Pagar dentro de los primeros (días del mes)', tipo: 'numero', obligatorio: true, porDefecto: '5' },
          { clave: 'reajusteAnual', etiqueta: 'Reajuste anual (%)', tipo: 'porcentaje', ayuda: 'Déjalo vacío si no se pacta reajuste.' },
        ],
      },
      {
        clave: 'garantia',
        titulo: 'Garantía',
        campos: [
          { clave: 'garantia', etiqueta: 'Monto de la garantía', tipo: 'dinero', obligatorio: true },
          { clave: 'garantiaDevolucionDias', etiqueta: 'Días para devolverla', tipo: 'numero', obligatorio: true, porDefecto: '30' },
        ],
      },
      {
        clave: 'plazo',
        titulo: 'Plazo',
        campos: [
          { clave: 'plazoMeses', etiqueta: 'Plazo (meses)', tipo: 'numero', obligatorio: true, porDefecto: '12' },
          { clave: 'fechaInicio', etiqueta: 'Fecha de inicio', tipo: 'fecha', obligatorio: true },
          { clave: 'renovacionAvisoDias', etiqueta: 'Aviso para negociar la renovación (días)', tipo: 'numero', obligatorio: true, porDefecto: '90' },
          { clave: 'desocupacionAvisoDias', etiqueta: 'Aviso si el inquilino se va antes (días)', tipo: 'numero', obligatorio: true, porDefecto: '60' },
          {
            clave: 'indemnizacionCanones',
            etiqueta: 'Indemnización si se va antes (cánones)',
            tipo: 'numero',
            ayuda: 'Vacío o cero: basta con el aviso, sin indemnización.',
          },
        ],
      },
      {
        clave: 'controversias',
        titulo: 'Controversias',
        campos: [VIA_CONTROVERSIAS('JUECES'), JURISDICCION, DESALOJO_DIAS],
      },
    ],
  },

  ARRENDAMIENTO_COMERCIAL: {
    titulo: 'Arrendamiento comercial',
    descripcion: 'Cuando el inquilino va a atender clientes o trabajar ahí: locales, oficinas, consultorios.',
    nombreDocumento: 'CONTRATO DE ARRENDAMIENTO COMERCIAL',
    requiereInmueble: true,
    secciones: [
      ...lado('arrendador', 'Arrendador (propietario)'),
      ...lado('arrendatario', 'Arrendatario'),
      {
        clave: 'inmueble',
        titulo: 'El inmueble',
        campos: [
          {
            clave: 'tipoLocal',
            etiqueta: 'Qué se arrienda',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'LOCAL',
            opciones: [
              { valor: 'LOCAL', etiqueta: 'Local comercial' },
              { valor: 'OFICINA', etiqueta: 'Oficina' },
              { valor: 'CONSULTORIO', etiqueta: 'Consultorio' },
            ],
          },
          { clave: 'inmuebleDireccion', etiqueta: 'Dirección', tipo: 'texto', obligatorio: true },
          { clave: 'inmuebleParroquia', etiqueta: 'Parroquia', tipo: 'texto', obligatorio: true },
          { clave: 'inmuebleCiudad', etiqueta: 'Cantón', tipo: 'texto', obligatorio: true },
          { clave: 'inmuebleProvincia', etiqueta: 'Provincia', tipo: 'texto', obligatorio: true },
          { clave: 'predio', etiqueta: 'Número de predio', tipo: 'texto' },
          {
            clave: 'areaArrendada',
            etiqueta: 'Parte que se arrienda',
            tipo: 'texto',
            obligatorio: true,
            porDefecto: 'la totalidad',
            ayuda: 'Ej.: la totalidad; la planta baja y el tercer piso.',
          },
          { clave: 'areaM2', etiqueta: 'Área aproximada (m²)', tipo: 'numero', obligatorio: true },
          { clave: 'areaDistribucion', etiqueta: 'Distribución', tipo: 'texto', ayuda: 'Opcional. Cómo se reparte el área.' },
        ],
      },
      {
        clave: 'destino',
        titulo: 'Destino',
        campos: [
          { clave: 'giro', etiqueta: 'Actividad del arrendatario', tipo: 'texto', obligatorio: true, ayuda: 'Ej.: restaurante y cafetería; consultorio odontológico.' },
          {
            clave: 'destinoDetalle',
            etiqueta: 'Uso declarado por áreas o marca',
            tipo: 'texto',
            ayuda: 'Opcional. Ej.: el tercer piso a la operación de un restaurante bajo la marca comercial "…".',
          },
        ],
      },
      {
        clave: 'plazo',
        titulo: 'Plazo y entrega',
        campos: [
          { clave: 'plazoMeses', etiqueta: 'Plazo (meses)', tipo: 'numero', obligatorio: true, porDefecto: '24' },
          { clave: 'fechaInicio', etiqueta: 'Fecha de inicio', tipo: 'fecha', obligatorio: true },
          { clave: 'fechaFin', etiqueta: 'Fecha de terminación', tipo: 'fecha', obligatorio: true },
          { clave: 'fechaEntrega', etiqueta: 'Fecha de entrega material', tipo: 'fecha', obligatorio: true },
          { clave: 'renovacionAvisoDias', etiqueta: 'Aviso para pedir renovación (días)', tipo: 'numero', obligatorio: true, porDefecto: '90' },
        ],
      },
      {
        clave: 'canon',
        titulo: 'Canon',
        campos: [
          { clave: 'canon', etiqueta: 'Canon mensual (sin IVA)', tipo: 'dinero', obligatorio: true },
          { clave: 'diaPago', etiqueta: 'Pagar dentro de los primeros (días del mes)', tipo: 'numero', obligatorio: true, porDefecto: '5' },
          { clave: 'primerCanonMes', etiqueta: 'Mes del primer canon', tipo: 'texto', ayuda: 'Opcional. Ej.: octubre de 2026.' },
          { clave: 'incrementoPorcentaje', etiqueta: 'Incremento anual (%)', tipo: 'porcentaje', ayuda: 'Déjalo vacío si no se pacta incremento.' },
          { clave: 'incrementoDesde', etiqueta: 'Primer incremento desde', tipo: 'fecha' },
          {
            clave: 'alicuota',
            etiqueta: 'Las alícuotas ordinarias',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'ARRENDATARIO',
            opciones: [
              { valor: 'ARRENDATARIO', etiqueta: 'Las paga el arrendatario' },
              { valor: 'ARRENDADOR', etiqueta: 'Las paga el arrendador' },
              { valor: 'NO_APLICA', etiqueta: 'No hay alícuotas' },
            ],
          },
        ],
      },
      {
        clave: 'garantia',
        titulo: 'Garantía',
        campos: [
          { clave: 'garantia', etiqueta: 'Monto de la garantía', tipo: 'dinero', obligatorio: true },
          { clave: 'garantiaDevolucionDias', etiqueta: 'Días hábiles para devolverla', tipo: 'numero', obligatorio: true, porDefecto: '15' },
        ],
      },
      {
        clave: 'terminacion',
        titulo: 'Terminación anticipada',
        descripcion: 'Lo que paga quien termina el contrato antes de tiempo sin causa.',
        campos: [
          { clave: 'indemnizacionArrendatario', etiqueta: 'Si se va el arrendatario (cánones)', tipo: 'numero', obligatorio: true },
          { clave: 'indemnizacionArrendador', etiqueta: 'Si lo termina el arrendador (cánones)', tipo: 'numero', obligatorio: true },
        ],
      },
      {
        clave: 'controversias',
        titulo: 'Controversias',
        campos: [JURISDICCION, DESALOJO_DIAS],
      },
    ],
  },

  ARRENDAMIENTO_INDUSTRIAL: {
    titulo: 'Arrendamiento industrial',
    descripcion: 'Cuando el inmueble es para almacenar, producir o distribuir: bodegas y galpones, casi siempre entre empresas.',
    nombreDocumento: 'CONTRATO DE ARRENDAMIENTO INDUSTRIAL',
    requiereInmueble: true,
    secciones: [
      ...lado('arrendador', 'Arrendadora', { juridicaPorDefecto: true }),
      ...lado('arrendatario', 'Arrendataria', { juridicaPorDefecto: true }),
      {
        clave: 'antecedentes',
        titulo: 'El inmueble y el uso',
        campos: [
          {
            clave: 'tipoInmueble',
            etiqueta: 'Qué se arrienda',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'BODEGA',
            opciones: [
              { valor: 'BODEGA', etiqueta: 'Bodega' },
              { valor: 'GALPON', etiqueta: 'Galpón' },
              { valor: 'NAVE', etiqueta: 'Nave industrial' },
            ],
          },
          { clave: 'inmuebleDescripcion', etiqueta: 'Descripción general', tipo: 'texto', obligatorio: true, ayuda: 'Ej.: un conjunto de bodegas.' },
          { clave: 'inmuebleDireccion', etiqueta: 'Dirección', tipo: 'texto', obligatorio: true },
          { clave: 'inmuebleParroquia', etiqueta: 'Parroquia', tipo: 'texto' },
          { clave: 'inmuebleCiudad', etiqueta: 'Ciudad', tipo: 'texto', obligatorio: true },
          {
            clave: 'actividadArrendataria',
            etiqueta: 'Actividad de la arrendataria',
            tipo: 'texto',
            obligatorio: true,
            ayuda: 'Ej.: una empresa comercial e industrial.',
          },
          { clave: 'usoPrevisto', etiqueta: 'Uso del inmueble', tipo: 'texto', obligatorio: true, porDefecto: 'bodega', ayuda: 'Ej.: bodega; almacenamiento y distribución de mercadería.' },
        ],
      },
      {
        clave: 'tecnica',
        titulo: 'Descripción técnica',
        descripcion: 'Lo que dejes vacío no se imprime.',
        campos: [
          { clave: 'areaCubierta', etiqueta: 'Área cubierta total (m²)', tipo: 'numero', obligatorio: true },
          { clave: 'areaOficina', etiqueta: 'Oficina (m²)', tipo: 'numero' },
          { clave: 'areaAltillo', etiqueta: 'Altillo (m²)', tipo: 'numero' },
          { clave: 'vestidores', etiqueta: 'Vestidores y baterías sanitarias', tipo: 'texto', ayuda: 'Ej.: vestidores externos de 16 m² con 2 inodoros, 2 duchas y 2 lavabos.' },
          { clave: 'suministroElectrico', etiqueta: 'Suministro eléctrico', tipo: 'texto', porDefecto: '110/220 V' },
          { clave: 'generador', etiqueta: '¿Generador de emergencia?', tipo: 'opcion', obligatorio: true, porDefecto: 'NO', opciones: SI_NO },
          { clave: 'redHidrica', etiqueta: '¿Red hídrica y agua potable?', tipo: 'opcion', obligatorio: true, porDefecto: 'SI', opciones: SI_NO },
          { clave: 'areaManiobras', etiqueta: 'Área exterior de maniobras (m²)', tipo: 'numero' },
          {
            clave: 'maniobrasUso',
            etiqueta: 'Uso del área de maniobras',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'EXCLUSIVO',
            opciones: [
              { valor: 'EXCLUSIVO', etiqueta: 'Exclusivo' },
              { valor: 'COMPARTIDO', etiqueta: 'Compartido' },
            ],
          },
          {
            clave: 'sustanciasPermitidas',
            etiqueta: 'Sustancias propias de la actividad permitidas',
            tipo: 'texto',
            ayuda: 'Opcional. Si lo dejas vacío, la prohibición de inflamables y explosivos es total.',
          },
        ],
      },
      {
        clave: 'canon',
        titulo: 'Canon y rubros',
        campos: [
          { clave: 'canon', etiqueta: 'Canon mensual (sin IVA)', tipo: 'dinero', obligatorio: true },
          { clave: 'diaPago', etiqueta: 'Pagar dentro de los primeros (días del mes)', tipo: 'numero', obligatorio: true, porDefecto: '5' },
          { clave: 'reajusteAnual', etiqueta: 'Reajuste anual (%)', tipo: 'porcentaje', ayuda: 'Déjalo vacío si no se pacta reajuste.' },
          { clave: 'rubroAdicional', etiqueta: 'Rubro mensual aparte del canon', tipo: 'dinero', ayuda: 'Opcional. Guardianía, limpieza u otros servicios comunes.' },
          {
            clave: 'rubroConceptos',
            etiqueta: 'Qué cubre ese rubro',
            tipo: 'texto',
            porDefecto: 'guardianía, limpieza y energía eléctrica de áreas comunes',
          },
        ],
      },
      {
        clave: 'garantia',
        titulo: 'Garantía',
        campos: [
          { clave: 'garantia', etiqueta: 'Monto del depósito', tipo: 'dinero', obligatorio: true },
          { clave: 'garantiaCanones', etiqueta: 'Equivale a (cánones)', tipo: 'numero' },
          { clave: 'garantiaDevolucionDias', etiqueta: 'Días para devolverlo', tipo: 'numero', obligatorio: true, porDefecto: '30' },
        ],
      },
      {
        clave: 'plazo',
        titulo: 'Plazo',
        campos: [
          { clave: 'plazoTexto', etiqueta: 'Plazo', tipo: 'texto', obligatorio: true, porDefecto: 'un año', ayuda: 'Ej.: un año; dos años.' },
          { clave: 'fechaInicio', etiqueta: 'Desde', tipo: 'fecha', obligatorio: true },
          { clave: 'fechaFin', etiqueta: 'Hasta', tipo: 'fecha', obligatorio: true },
        ],
      },
      {
        clave: 'operacion',
        titulo: 'Operación',
        campos: [
          { clave: 'respuestaMejorasDias', etiqueta: 'Días para responder una solicitud de mejora', tipo: 'numero', obligatorio: true, porDefecto: '5' },
          { clave: 'ingresoInteresadosDias', etiqueta: 'Días finales con visitas de interesados', tipo: 'numero', obligatorio: true, porDefecto: '60' },
          { clave: 'inutilizableDias', etiqueta: 'Días inutilizable por fuerza mayor para terminar', tipo: 'numero', obligatorio: true, porDefecto: '90' },
        ],
      },
      {
        clave: 'controversias',
        titulo: 'Controversias',
        campos: [
          VIA_CONTROVERSIAS('ARBITRAJE'),
          {
            clave: 'numeroArbitros',
            etiqueta: 'Árbitros',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'UNO',
            opciones: [
              { valor: 'UNO', etiqueta: 'Uno' },
              { valor: 'TRES', etiqueta: 'Tres' },
            ],
            visibleSi: { clave: 'viaControversias', valores: ['ARBITRAJE'] },
          },
          JURISDICCION,
          DESALOJO_DIAS,
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// RESERVAS
//
// Retiradas el 2026-09-11 y vueltas a ofrecer el 2026-09-16, ya con aprobación
// de borrador y con partes que pueden ser compañías. Los campos son los de su
// última versión; las decisiones que más conflictos generan siguen sin valor
// por defecto.
// ---------------------------------------------------------------------------

// Sin número de cuenta, entidad ni titular: el respaldo del pago es el
// comprobante de la transacción, y los datos para pagar viajan aparte.
const FORMAS_PAGO: CampoOpcion[] = [
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia bancaria' },
  { valor: 'DEPOSITO', etiqueta: 'Depósito' },
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'CHEQUE', etiqueta: 'Cheque' },
];

const DEFINICIONES_RESERVA: Record<string, TipoDefinicion> = {
  RESERVA_COMPRAVENTA: {
    titulo: 'Reserva de compraventa',
    descripcion: 'Cuando un comprador entrega dinero para separar el inmueble mientras se prepara la escritura.',
    nombreDocumento: 'CONTRATO DE RESERVA DE COMPRAVENTA DE BIEN INMUEBLE',
    requiereInmueble: true,
    secciones: [
      ...lado('vendedor', 'Parte vendedora', { estadoCivil: true }),
      ...lado('comprador', 'Parte compradora', { estadoCivil: true }),
      parteAgente('corredor', 'Tú, como corredor'),
      {
        clave: 'antecedentes',
        titulo: 'Antecedentes (opcional)',
        descripcion: 'Si no los completas, el documento los omite en vez de dejarlos en blanco.',
        campos: [
          {
            clave: 'representacion',
            etiqueta: 'Representación por poder, si alguna parte comparece por otra',
            tipo: 'area',
            ayuda: 'Ejemplo: poder especial otorgado el 12 de marzo de 2024 ante la Notaría Décima del cantón Quito.',
          },
          {
            clave: 'tituloDominio',
            etiqueta: 'Título con el que la parte vendedora acredita el dominio',
            tipo: 'area',
            ayuda: 'Escritura, posesión efectiva o el instrumento inscrito que corresponda.',
          },
          { clave: 'predio', etiqueta: 'Número de predio', tipo: 'texto' },
        ],
      },
      {
        clave: 'reserva',
        titulo: 'Condiciones de la reserva',
        campos: [
          { clave: 'precioTotal', etiqueta: 'Precio total acordado', tipo: 'dinero', obligatorio: true },
          { clave: 'montoReserva', etiqueta: 'Monto de la reserva', tipo: 'dinero', obligatorio: true },
          {
            clave: 'formaPago',
            etiqueta: 'Forma de pago de la reserva',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'TRANSFERENCIA',
            opciones: FORMAS_PAGO,
            ayuda: 'No se registra número de cuenta: el respaldo del pago es el comprobante de la transacción.',
          },
          { clave: 'fechaEntrega', etiqueta: 'Fecha en que se entrega el valor', tipo: 'fecha', obligatorio: true },
          {
            clave: 'reservaEntregadaA',
            etiqueta: 'El valor de la reserva queda en poder de',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'VENDEDOR',
            opciones: [
              { valor: 'VENDEDOR', etiqueta: 'La parte vendedora' },
              { valor: 'CORREDOR', etiqueta: 'El corredor, en depósito hasta el cierre' },
            ],
            ayuda: 'De esto depende quién devuelve o entrega el dinero si alguien desiste. La cláusula de penalidad se redacta sola a partir de tu respuesta.',
          },
          {
            clave: 'plazoDevolucionDias',
            etiqueta: 'Plazo para devolver o entregar el valor (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '5',
          },
          {
            clave: 'formaPagoSaldo',
            etiqueta: 'Forma de pago del saldo',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'CONTADO',
            opciones: [
              { valor: 'CONTADO', etiqueta: 'Contado' },
              { valor: 'CREDITO', etiqueta: 'Crédito hipotecario' },
              { valor: 'MIXTO', etiqueta: 'Mixto' },
            ],
          },
          {
            clave: 'entidadFinanciera',
            etiqueta: 'Entidad que concede el crédito',
            tipo: 'texto',
            ayuda: 'Solo el nombre de la institución. Nunca un número de cuenta.',
            visibleSi: { clave: 'formaPagoSaldo', valores: ['CREDITO', 'MIXTO'] },
          },
          {
            clave: 'plazoEscrituraDias',
            etiqueta: 'Plazo para suscribir la escritura pública (días)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '60',
          },
          {
            clave: 'gastosNotariales',
            etiqueta: 'Gastos notariales y de registro a cargo de',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'COMPRADOR',
            opciones: [
              { valor: 'COMPRADOR', etiqueta: 'La parte compradora' },
              { valor: 'VENDEDOR', etiqueta: 'La parte vendedora' },
              { valor: 'COMPARTIDOS', etiqueta: 'Compartidos en partes iguales' },
            ],
          },
          // ------------------------------------------------------------------
          // LAS DOS OPCIONES DE DESISTIMIENTO VAN SIN VALOR POR DEFECTO, A
          // PROPÓSITO. NO AÑADIR UNO: es la cláusula que más conflictos genera
          // y un default la decidiría por el agente sin que la note.
          // ------------------------------------------------------------------
          {
            clave: 'siDesisteComprador',
            etiqueta: 'Si desiste la parte compradora, el valor de la reserva',
            tipo: 'opcionExplicada',
            obligatorio: true,
            opciones: [
              {
                valor: 'SE_PIERDE',
                etiqueta: 'Queda a favor de la parte vendedora',
                consecuencia:
                  'La compradora pierde todo lo entregado. Es lo que más protege a la vendedora, y también lo que más se discute después si la compradora alega que se retiró por una causa justificada.',
              },
              {
                valor: 'DEVOLUCION_TOTAL',
                etiqueta: 'Se devuelve en su totalidad',
                consecuencia:
                  'La compradora puede retirarse sin costo. La reserva deja de ser una garantía: la vendedora saca el inmueble del mercado sin nada a cambio.',
              },
              {
                valor: 'DEVOLUCION_PARCIAL',
                etiqueta: 'Se devuelve parcialmente',
                consecuencia:
                  'Se retiene solo la parte que definas abajo y el resto vuelve a la compradora. Es el punto medio, y se sostiene mejor si lo retenido guarda relación con gastos reales.',
              },
            ],
            ayuda: 'No hay valor por defecto: elígelo con el cliente delante. Lo habitual en el mercado es que quede a favor de la parte vendedora.',
          },
          {
            clave: 'siDesisteCompradorDetalle',
            etiqueta: 'Detalle de la devolución parcial',
            tipo: 'texto',
            visibleSi: { clave: 'siDesisteComprador', valores: ['DEVOLUCION_PARCIAL'] },
          },
          {
            clave: 'siDesisteVendedor',
            etiqueta: 'Si desiste la parte vendedora',
            tipo: 'opcionExplicada',
            obligatorio: true,
            opciones: [
              {
                valor: 'DEVUELVE_DOBLE',
                etiqueta: 'Devuelve la reserva y paga otro tanto igual',
                consecuencia:
                  'La vendedora arriesga el mismo monto que la compradora. Es lo que hace que la reserva sea recíproca de verdad y lo que desalienta que se retire por una oferta mejor.',
              },
              {
                valor: 'DEVUELVE_SIMPLE',
                etiqueta: 'Devuelve solo la reserva',
                consecuencia:
                  'La vendedora puede retirarse sin costo. La compradora pierde el tiempo y los gastos del trámite sin compensación, y nada impide aceptar una oferta mejor a mitad del plazo.',
              },
            ],
            ayuda: 'No hay valor por defecto: elígelo con el cliente delante. Lo habitual es devolver la reserva y pagar una suma igual como indemnización.',
          },
        ],
      },
    ],
  },

  RESERVA_ARRIENDO: {
    titulo: 'Reserva de arrendamiento',
    descripcion: 'Cuando un interesado entrega dinero para separar un inmueble mientras se cumplen las condiciones para arrendarlo.',
    nombreDocumento: 'RESERVA DE ARRENDAMIENTO',
    requiereInmueble: true,
    secciones: [
      ...lado('interesado', 'Datos del interesado'),
      parteAgente('corredor', 'Tú, como agente'),
      {
        clave: 'reserva',
        titulo: 'Condiciones de la reserva',
        campos: [
          { clave: 'montoReserva', etiqueta: 'Monto de la reserva', tipo: 'dinero', obligatorio: true },
          {
            clave: 'formaPago',
            etiqueta: 'Forma de pago de la reserva',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'TRANSFERENCIA',
            opciones: FORMAS_PAGO,
            ayuda: 'No se registra número de cuenta: el respaldo del pago es el comprobante de la transacción.',
          },
          { clave: 'fechaEntrega', etiqueta: 'Fecha en que se entrega el valor', tipo: 'fecha', obligatorio: true },
          {
            clave: 'reservaEntregadaA',
            etiqueta: 'El valor de la reserva queda en poder de',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'AGENTE',
            opciones: [
              { valor: 'AGENTE', etiqueta: 'El agente, en depósito hasta que se firme' },
              { valor: 'ARRENDADOR', etiqueta: 'El arrendador' },
            ],
            ayuda: 'De esto depende quién devuelve el dinero si el arriendo no se concreta. La cláusula se redacta sola a partir de tu respuesta.',
          },
          {
            clave: 'plazoDevolucionDias',
            etiqueta: 'Plazo para devolver o entregar el valor (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '5',
          },
          { clave: 'plazoDias', etiqueta: 'Plazo de la reserva (días)', tipo: 'numero', obligatorio: true, porDefecto: '8' },
          {
            clave: 'condiciones',
            etiqueta: 'Condiciones para firmar el arriendo',
            tipo: 'area',
            obligatorio: true,
            porDefecto: 'Aprobación del garante propuesto y entrega de la documentación requerida por el arrendador.',
          },
          {
            clave: 'destinoValor',
            etiqueta: 'El valor de la reserva se imputa a',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'PRIMER_CANON',
            opciones: [
              { valor: 'PRIMER_CANON', etiqueta: 'El primer canon de arrendamiento' },
              { valor: 'GARANTIA', etiqueta: 'La garantía o depósito' },
            ],
          },
          {
            clave: 'siNoSeConcreta',
            etiqueta: 'Si el arriendo no se concreta, el valor',
            tipo: 'opcionExplicada',
            // SIN VALOR POR DEFECTO, A PROPÓSITO. NO AÑADIR UNO.
            obligatorio: true,
            opciones: [
              {
                valor: 'DEVOLUCION_TOTAL',
                etiqueta: 'Se devuelve en su totalidad',
                consecuencia:
                  'El interesado recupera todo lo entregado. El arrendador no recibe compensación por los días que el inmueble estuvo fuera de oferta.',
              },
              {
                valor: 'DEVOLUCION_PARCIAL',
                etiqueta: 'Se devuelve parcialmente',
                consecuencia:
                  'Se retiene solo la parte que definas abajo y el resto vuelve al interesado. Es el punto medio, y se sostiene mejor si lo retenido guarda relación con gastos reales.',
              },
              {
                valor: 'SE_PIERDE',
                etiqueta: 'Se pierde a favor del arrendador',
                consecuencia:
                  'El interesado pierde todo, incluso si el arriendo no se firmó por algo que no dependía de él. Es la alternativa más dura y la que más reclamos genera.',
              },
            ],
            ayuda: 'No hay valor por defecto: elígelo con el cliente delante.',
          },
          {
            clave: 'devolucionParcialDetalle',
            etiqueta: 'Detalle de la devolución parcial',
            tipo: 'texto',
            visibleSi: { clave: 'siNoSeConcreta', valores: ['DEVOLUCION_PARCIAL'] },
          },
        ],
      },
    ],
  },
};

// Todas las definiciones: las vivas y las archivadas, que siguen aquí para que
// un contrato retirado se abra e imprima igual que el día que se firmó.
export const CONTRATO_DEFINICION: Record<ContratoTipo, TipoDefinicion> = {
  ...(DEFINICIONES_LEGADO as Record<ContratoTipo, TipoDefinicion>),
  ...(DEFINICIONES_VIVAS as Record<ContratoTipo, TipoDefinicion>),
  ...(DEFINICIONES_ARRENDAMIENTO as Record<ContratoTipo, TipoDefinicion>),
  // Las reservas volvieron a ofrecerse: su definición viva reemplaza a la que
  // quedó en ./tipos-legado cuando se retiraron (no hay contratos de reserva
  // anteriores en la base).
  ...(DEFINICIONES_RESERVA as Record<ContratoTipo, TipoDefinicion>),
};

// Selector de documento: solo lo que se puede generar hoy.
export type MenuEntrada = { clase: 'tipo'; tipo: ContratoTipo };

export const CONTRATO_MENU: MenuEntrada[] = [
  { clase: 'tipo', tipo: 'CORRETAJE' },
  { clase: 'tipo', tipo: 'RESERVA_COMPRAVENTA' },
  { clase: 'tipo', tipo: 'ARRENDAMIENTO_RESIDENCIAL' },
  { clase: 'tipo', tipo: 'ARRENDAMIENTO_COMERCIAL' },
  { clase: 'tipo', tipo: 'ARRENDAMIENTO_INDUSTRIAL' },
  { clase: 'tipo', tipo: 'RESERVA_ARRIENDO' },
];

// ---------------------------------------------------------------------------
// PARTES
//
// Quién comparece en cada documento, en el orden de las líneas de firma. Las
// partes que no son el agente reciben cada versión y la aprueban; el agente no
// se aprueba a sí mismo: enviar una versión ES su conformidad con ella.
// ---------------------------------------------------------------------------
export type ParteDefinicion = { rol: string; etiqueta: string; esAgente?: boolean };

export const PARTES_POR_TIPO: Record<ContratoTipo, ParteDefinicion[]> = {
  ...(FIRMANTES_LEGADO as Record<ContratoTipo, ParteDefinicion[]>),
  CORRETAJE: [
    { rol: 'propietario', etiqueta: 'Propietario' },
    { rol: 'corredor', etiqueta: 'Corredor', esAgente: true },
  ],
  // En los arrendamientos el agente no es parte: el contrato es entre
  // propietario e inquilino, y ambos aprueban cada versión.
  ARRENDAMIENTO_RESIDENCIAL: [
    { rol: 'arrendador', etiqueta: 'Arrendador' },
    { rol: 'arrendatario', etiqueta: 'Arrendatario' },
  ],
  ARRENDAMIENTO_COMERCIAL: [
    { rol: 'arrendador', etiqueta: 'Arrendador' },
    { rol: 'arrendatario', etiqueta: 'Arrendatario' },
  ],
  ARRENDAMIENTO_INDUSTRIAL: [
    { rol: 'arrendador', etiqueta: 'Arrendadora' },
    { rol: 'arrendatario', etiqueta: 'Arrendataria' },
  ],
  // En las reservas el agente comparece (como depositario del valor, si lo
  // tiene) pero no aprueba: aprueban las partes de la operación.
  RESERVA_COMPRAVENTA: [
    { rol: 'vendedor', etiqueta: 'Parte vendedora' },
    { rol: 'comprador', etiqueta: 'Parte compradora' },
    { rol: 'corredor', etiqueta: 'Corredor de bienes raíces', esAgente: true },
  ],
  RESERVA_ARRIENDO: [
    { rol: 'interesado', etiqueta: 'Interesado' },
    { rol: 'corredor', etiqueta: 'Agente', esAgente: true },
  ],
};

export function esContratoTipo(valor: unknown): valor is ContratoTipo {
  return typeof valor === 'string' && (CONTRATO_TIPOS as readonly string[]).includes(valor);
}

// Se edita mientras la negociación siga abierta, incluso después de enviada o
// aprobada una versión: los cambios quedan en la copia de trabajo hasta que se
// envían como versión nueva. Un contrato anulado, uno del flujo de firma o uno
// de tipo archivado ya no.
export function esEditable(estado: string, tipo?: string): boolean {
  if (tipo && esTipoArchivado(tipo)) return false;
  if (esEstadoDeFirmaLegado(estado)) return false;
  return estadoVigente(estado) !== 'ANULADO';
}

export function correoValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim());
}

function camposDe(tipo: ContratoTipo): CampoDefinicion[] {
  return CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos);
}

// El valor que cuenta: lo escrito o, si no hay nada, el valor por defecto.
export function valorEfectivo(tipo: ContratoTipo, datos: Record<string, string>, clave: string): string {
  const escrito = (datos[clave] ?? '').trim();
  if (escrito) return escrito;
  return camposDe(tipo).find((c) => c.clave === clave)?.porDefecto ?? '';
}

export function campoVisible(tipo: ContratoTipo, campo: CampoDefinicion, datos: Record<string, string>): boolean {
  if (!campo.visibleSi) return true;
  const condiciones = Array.isArray(campo.visibleSi) ? campo.visibleSi : [campo.visibleSi];
  return condiciones.every((c) => c.valores.includes(valorEfectivo(tipo, datos, c.clave)));
}

// Devuelve los campos obligatorios que faltan, para que el formulario y la
// ruta apliquen exactamente la misma regla. Un campo oculto no se exige.
export function camposFaltantes(tipo: ContratoTipo, datos: Record<string, string>): string[] {
  const faltan: string[] = [];
  for (const seccion of CONTRATO_DEFINICION[tipo].secciones) {
    // En las personas adicionales de un lado, la etiqueta sola ("Cédula") no
    // dice de quién falta: va con el título de su sección.
    const prefijo = /_\d+$/.test(seccion.clave) ? `${seccion.titulo}: ` : '';
    for (const campo of seccion.campos) {
      if (!campoVisible(tipo, campo, datos)) continue;
      const valor = valorEfectivo(tipo, datos, campo.clave);
      // Un correo opcional no se exige, pero si se escribió tiene que servir.
      if (campo.tipo === 'correo' && valor && !correoValido(valor)) faltan.push(`${prefijo}${campo.etiqueta} (formato no válido)`);
      else if (campo.obligatorio && !valor) faltan.push(`${prefijo}${campo.etiqueta}`);
      else if (campo.minimo && valor && valor.trim().length < campo.minimo) {
        faltan.push(`${prefijo}${campo.etiqueta} (al menos ${campo.minimo} caracteres)`);
      }
    }
  }
  return faltan;
}

// ---------------------------------------------------------------------------
// IDENTIDAD DE UNA PARTE
//
// Una sola función decide cómo se nombra a una parte, qué documento la
// identifica y QUIÉN aprueba por ella. En una compañía el que revisa y aprueba
// es su representante legal, y los últimos 4 dígitos que teclea son los de su
// cédula, no los del RUC.
// ---------------------------------------------------------------------------
export type IdentidadParte = {
  juridica: boolean;
  // Cómo figura la parte en el documento: la persona o la razón social.
  nombre: string;
  documento: string;
  tipoDocumento: 'cédula' | 'pasaporte' | 'RUC';
  representante: { nombre: string; cedula: string } | null;
  aprobador: { nombre: string; cedula: string };
  correo: string;
  telefono: string;
  domicilio: string;
};

export function identidadParte(tipo: ContratoTipo, datos: Record<string, string>, rol: string): IdentidadParte {
  const v = (clave: string) => valorEfectivo(tipo, datos, `${rol}_${clave}`);
  // Una persona adicional sin domicilio propio comparte el de la primera.
  const base = rolBase(rol);
  const domicilio = v('direccion') || (base !== rol ? valorEfectivo(tipo, datos, `${base}_direccion`) : '');
  const contacto = { correo: v('correo'), telefono: v('telefono'), domicilio };
  if (v('tipoPersona') === 'JURIDICA') {
    const representante = { nombre: v('representante'), cedula: v('representanteCedula') };
    return {
      juridica: true,
      nombre: v('razonSocial'),
      documento: v('ruc'),
      tipoDocumento: 'RUC',
      representante,
      aprobador: representante,
      ...contacto,
    };
  }
  const persona = { nombre: v('nombre'), cedula: v('cedula') };
  return {
    juridica: false,
    nombre: persona.nombre,
    documento: persona.cedula,
    tipoDocumento: v('tipoDocumento') === 'PASAPORTE' ? 'pasaporte' : 'cédula',
    representante: null,
    aprobador: persona,
    ...contacto,
  };
}

// El agente como parte: su persona sale del perfil y, si comparece por su
// empresa, la razón social y el RUC salen del formulario.
export function identidadAgente(
  tipo: ContratoTipo,
  datos: Record<string, string>,
  rol: string,
  agente: { nombre: string; cedula: string; correo: string; telefono: string; direccion: string },
): IdentidadParte {
  const persona = { nombre: agente.nombre, cedula: agente.cedula };
  const contacto = { correo: agente.correo, telefono: agente.telefono, domicilio: agente.direccion };
  if (valorEfectivo(tipo, datos, `${rol}_tipoPersona`) === 'JURIDICA') {
    return {
      juridica: true,
      nombre: valorEfectivo(tipo, datos, `${rol}_razonSocial`),
      documento: valorEfectivo(tipo, datos, `${rol}_ruc`),
      tipoDocumento: 'RUC',
      representante: persona,
      aprobador: persona,
      ...contacto,
    };
  }
  return {
    juridica: false,
    nombre: persona.nombre,
    documento: persona.cedula,
    tipoDocumento: 'cédula',
    representante: null,
    aprobador: persona,
    ...contacto,
  };
}

// ---------------------------------------------------------------------------
// PARTES DEL DOCUMENTO CON SUS PERSONAS ADICIONALES
// ---------------------------------------------------------------------------

// Cuántas personas comparecen en un lado. Una compañía comparece sola, por su
// representante.
export function personasEnLado(tipo: ContratoTipo, datos: Record<string, string>, rol: string): number {
  if (valorEfectivo(tipo, datos, `${rol}_tipoPersona`) === 'JURIDICA') return 1;
  const campo = camposDe(tipo).find((c) => c.clave === `${rol}_personas`);
  if (!campo) return 1;
  const n = Number(valorEfectivo(tipo, datos, `${rol}_personas`));
  return Number.isInteger(n) ? Math.min(Math.max(n, 1), MAX_PERSONAS_POR_LADO) : 1;
}

// Roles de las personas adicionales de un lado: "vendedor_2", "vendedor_3".
export function rolesAdicionales(tipo: ContratoTipo, datos: Record<string, string>, rol: string): string[] {
  const salida: string[] = [];
  for (let n = 2; n <= personasEnLado(tipo, datos, rol); n += 1) salida.push(`${rol}_${n}`);
  return salida;
}

export type ParteDocumento = ParteDefinicion & { rolBase: string };

// Quiénes comparecen de verdad en este documento, en el orden de las líneas de
// firma: cada parte de la definición seguida de las demás personas de su lado.
export function partesDocumento(tipo: ContratoTipo, datos: Record<string, string>): ParteDocumento[] {
  const salida: ParteDocumento[] = [];
  for (const def of PARTES_POR_TIPO[tipo] ?? []) {
    salida.push({ ...def, rolBase: def.rol });
    if (def.esAgente) continue;
    for (const rol of rolesAdicionales(tipo, datos, def.rol)) salida.push({ rol, etiqueta: def.etiqueta, rolBase: def.rol });
  }
  return salida;
}

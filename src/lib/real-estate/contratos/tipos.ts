// Contratos: tipos y configuracion de campos, compartidos entre cliente y
// servidor. Sin imports de Prisma para que el formulario del agente pueda
// importarlo sin arrastrar el backend.

import { DEFINICIONES_LEGADO, FIRMANTES_LEGADO } from './tipos-legado';

// Los valores del enum en la base. Solo UNO se puede generar hoy: el corretaje.
// El resto son tipos RETIRADOS que siguen en el enum porque hay (o puede haber)
// contratos que los usan, y esos contratos se abren, se imprimen y se descargan
// igual que siempre. Lo que no se puede es crear otro.
//
// El enum NO se recorta al retirar un tipo: PostgreSQL no permite eliminar un
// valor de un enum sin recrear el tipo, y una fila que lo use quedaria huerfana.
export const CONTRATO_TIPOS = [
  'CORRETAJE',
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
  'RESERVA_ARRIENDO',
  'RESERVA_COMPRAVENTA',
];

export function esTipoArchivado(tipo: string): boolean {
  return (CONTRATO_TIPOS_LEGADO as readonly string[]).includes(tipo);
}

// ---------------------------------------------------------------------------
// ESTADOS
//
// El modulo ya no firma: cada envio es una version que las partes aprueban o
// no. PENDIENTE_FIRMA y FIRMADO quedan solo para los contratos de la etapa de
// firma electronica, que se conservan tal como se firmaron.
// ---------------------------------------------------------------------------
export const CONTRATO_ESTADOS = [
  'BORRADOR',
  'EN_APROBACION',
  'APROBADO',
  'RECHAZADO',
  'ANULADO',
  'PENDIENTE_FIRMA',
  'FIRMADO',
] as const;
export type ContratoEstado = (typeof CONTRATO_ESTADOS)[number];

export const PARTE_ESTADOS = ['ENVIADO', 'ABIERTO', 'APROBADO', 'RECHAZADO', 'FIRMADO'] as const;
export type ParteEstado = (typeof PARTE_ESTADOS)[number];

export const VERSION_ESTADOS = ['EN_APROBACION', 'APROBADA', 'RECHAZADA', 'REEMPLAZADA', 'ANULADA'] as const;
export type VersionEstado = (typeof VERSION_ESTADOS)[number];

// Un contrato del flujo de firma retirado: se abre y se descarga, nada más.
export function esEstadoDeFirmaLegado(estado: string): boolean {
  return estado === 'PENDIENTE_FIRMA' || estado === 'FIRMADO';
}

// Vigencia del enlace de revisión. Vencido, el agente lo reenvía.
export const APROBACION_VIGENCIA_DIAS = 15;

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
  // Legado: los tipos retirados marcaban así los datos de cada firmante.
  rolFirmante?: string;
  // El campo solo existe si otro campo tiene uno de estos valores. Oculto, no
  // se pide ni se valida: los datos de una compañía no se exigen a una persona.
  visibleSi?: { clave: string; valores: string[] };
};

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
  extras: { tipoDocumento?: boolean } = {},
): SeccionDefinicion {
  const natural = { clave: `${rol}_tipoPersona`, valores: ['NATURAL'] };
  const juridica = { clave: `${rol}_tipoPersona`, valores: ['JURIDICA'] };
  const campos: CampoDefinicion[] = [
    {
      clave: `${rol}_tipoPersona`,
      etiqueta: 'Comparece como',
      tipo: 'opcion',
      obligatorio: true,
      porDefecto: 'NATURAL',
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
      clave: `${rol}_correo`,
      etiqueta: 'Correo electrónico',
      tipo: 'correo',
      obligatorio: true,
      ayuda: 'Por aquí recibirá cada versión del documento para revisarla y aprobarla.',
    },
    { clave: `${rol}_telefono`, etiqueta: 'Teléfono', tipo: 'telefono', obligatorio: true },
    { clave: `${rol}_direccion`, etiqueta: 'Domicilio', tipo: 'texto', obligatorio: true },
  );
  return { clave: rol, titulo, campos };
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
    requiereInmueble: true,
    secciones: [
      parte('propietario', 'Datos del propietario', { tipoDocumento: true }),
      parteAgente('corredor', 'Tú, como corredor'),
      {
        clave: 'exclusividad',
        titulo: 'Modalidad',
        descripcion: 'Cambia el alcance del encargo y cuándo se te deben los honorarios.',
        campos: [
          {
            clave: 'exclusividad',
            etiqueta: 'La consignación se otorga',
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
        clave: 'deposito',
        titulo: 'Depósito o señal de trato',
        descripcion: 'Qué pasa con el dinero que un interesado entregue para asegurar la negociación.',
        campos: [
          {
            clave: 'depositoEnPoderDe',
            etiqueta: 'La señal queda en poder de',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'CORREDOR',
            opciones: [
              { valor: 'CORREDOR', etiqueta: 'El corredor' },
              { valor: 'PROPIETARIO', etiqueta: 'El propietario' },
            ],
          },
          {
            clave: 'siDesisteComprador',
            etiqueta: 'Si el interesado desiste, la señal',
            tipo: 'opcionExplicada',
            // Sin default, por lo mismo que la exclusividad.
            obligatorio: true,
            opciones: [
              {
                valor: 'SE_PIERDE',
                etiqueta: 'Queda a favor del propietario',
                consecuencia:
                  'El interesado pierde lo entregado. Es lo más común, y también lo que más se discute si alega que se retiró por causa justificada.',
              },
              {
                valor: 'DEVOLUCION_TOTAL',
                etiqueta: 'Se devuelve completa',
                consecuencia:
                  'El interesado se retira sin costo. La señal deja de asegurar nada y el inmueble estuvo fuera del mercado a cambio de nada.',
              },
              {
                valor: 'DEVOLUCION_PARCIAL',
                etiqueta: 'Se devuelve en parte',
                consecuencia:
                  'Se retiene solo lo que definas abajo. Es el punto medio, y se sostiene mejor si lo retenido guarda relación con gastos reales.',
              },
            ],
          },
          {
            clave: 'retencionDetalle',
            etiqueta: 'Detalle de la retención parcial',
            tipo: 'texto',
            visibleSi: { clave: 'siDesisteComprador', valores: ['DEVOLUCION_PARCIAL'] },
          },
          {
            clave: 'devolucionPlazoDias',
            etiqueta: 'Plazo para devolver la señal (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '5',
          },
        ],
      },
      {
        clave: 'propiedad',
        titulo: 'Información de la propiedad',
        descripcion: 'Se imprime al final del contrato. Lo que dejes vacío sale marcado como pendiente.',
        campos: [
          { clave: 'precio', etiqueta: 'Precio de venta', tipo: 'dinero', obligatorio: true },
          { clave: 'propiedadDireccion', etiqueta: 'Dirección', tipo: 'texto', obligatorio: true },
          { clave: 'propiedadCiudad', etiqueta: 'Ciudad', tipo: 'texto', obligatorio: true },
          { clave: 'propiedadProvincia', etiqueta: 'Provincia', tipo: 'texto', obligatorio: true },
          { clave: 'propiedadCatastro', etiqueta: 'Número de catastro', tipo: 'texto' },
          { clave: 'linderoNorte', etiqueta: 'Lindero norte', tipo: 'texto' },
          { clave: 'linderoSur', etiqueta: 'Lindero sur', tipo: 'texto' },
          { clave: 'linderoEste', etiqueta: 'Lindero este', tipo: 'texto' },
          { clave: 'linderoOeste', etiqueta: 'Lindero oeste', tipo: 'texto' },
          JURISDICCION,
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
};

// Selector de documento: solo lo que se puede generar hoy.
export type MenuEntrada = { clase: 'tipo'; tipo: ContratoTipo };

export const CONTRATO_MENU: MenuEntrada[] = [{ clase: 'tipo', tipo: 'CORRETAJE' }];

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
};

export function esContratoTipo(valor: unknown): valor is ContratoTipo {
  return typeof valor === 'string' && (CONTRATO_TIPOS as readonly string[]).includes(valor);
}

// Se edita mientras la negociación siga abierta, incluso después de enviada o
// aprobada una versión: los cambios quedan en la copia de trabajo hasta que se
// envían como versión nueva. Un contrato anulado, uno del flujo de firma o uno
// de tipo archivado ya no.
export function esEditable(estado: ContratoEstado, tipo?: string): boolean {
  if (tipo && esTipoArchivado(tipo)) return false;
  return estado === 'BORRADOR' || estado === 'EN_APROBACION' || estado === 'APROBADO' || estado === 'RECHAZADO';
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
  return campo.visibleSi.valores.includes(valorEfectivo(tipo, datos, campo.visibleSi.clave));
}

// Devuelve los campos obligatorios que faltan, para que el formulario y la
// ruta apliquen exactamente la misma regla. Un campo oculto no se exige.
export function camposFaltantes(tipo: ContratoTipo, datos: Record<string, string>): string[] {
  const faltan: string[] = [];
  for (const seccion of CONTRATO_DEFINICION[tipo].secciones) {
    for (const campo of seccion.campos) {
      if (!campo.obligatorio || !campoVisible(tipo, campo, datos)) continue;
      const valor = valorEfectivo(tipo, datos, campo.clave);
      if (!valor) faltan.push(campo.etiqueta);
      else if (campo.tipo === 'correo' && !correoValido(valor)) faltan.push(`${campo.etiqueta} (formato no válido)`);
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
  const contacto = { correo: v('correo'), telefono: v('telefono'), domicilio: v('direccion') };
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

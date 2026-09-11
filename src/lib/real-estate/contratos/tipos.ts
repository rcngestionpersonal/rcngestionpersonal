// Contratos: tipos y configuracion de campos, compartidos entre cliente y
// servidor. Sin imports de Prisma para que el formulario del agente pueda
// importarlo sin arrastrar el backend.

import { DEFINICIONES_LEGADO, FIRMANTES_LEGADO } from './tipos-legado';

// Los valores del enum en la base. Solo DOS se pueden generar hoy: corretaje y
// arrendamiento. El resto son tipos RETIRADOS que siguen en el enum porque hay
// (o puede haber) contratos que los usan, y esos contratos se abren, se
// imprimen y se descargan igual que siempre. Lo que no se puede es crear otro.
export const CONTRATO_TIPOS = [
  'CORRETAJE',
  'CORRETAJE_EXCLUSIVO',
  'CORRETAJE_ABIERTO',
  'ARRENDAMIENTO',
  'RESERVA_ARRIENDO',
  'RESERVA_COMPRAVENTA',
] as const;
export type ContratoTipo = (typeof CONTRATO_TIPOS)[number];

// Archivados y de solo lectura: no se ofrecen, no se editan y no se envían a
// firma. Se conservan sus definiciones en ./tipos-legado para reimprimirlos.
export const CONTRATO_TIPOS_LEGADO: readonly ContratoTipo[] = [
  'CORRETAJE_EXCLUSIVO',
  'CORRETAJE_ABIERTO',
  'RESERVA_ARRIENDO',
  'RESERVA_COMPRAVENTA',
];

export function esTipoArchivado(tipo: string): boolean {
  return (CONTRATO_TIPOS_LEGADO as readonly string[]).includes(tipo);
}

export const CONTRATO_ESTADOS = ['BORRADOR', 'PENDIENTE_FIRMA', 'FIRMADO', 'RECHAZADO', 'ANULADO'] as const;
export type ContratoEstado = (typeof CONTRATO_ESTADOS)[number];

export const FIRMANTE_ESTADOS = ['ENVIADO', 'ABIERTO', 'FIRMADO', 'RECHAZADO'] as const;
export type FirmanteEstado = (typeof FIRMANTE_ESTADOS)[number];

// Vigencia del enlace de firma. Vencido, el agente reenvia.
export const FIRMA_VIGENCIA_DIAS = 15;
export const FIRMA_RECORDATORIO_DIAS = 3;

// Lo que se imprime donde un campo opcional quedó sin llenar. Un marcador
// visible y no un hueco en blanco: un espacio vacío pasa desapercibido al
// revisar, y aparece en el documento firmado sin que nadie lo note.
export const MARCADOR_SIN_COMPLETAR = '[ POR COMPLETAR ]';

// ---------------------------------------------------------------------------
// AVISOS
//
// Viven aca, en un solo lugar, y NUNCA se exponen como campo editable del
// formulario. El generador los inserta desde estas constantes y no desde los
// datos que envia el cliente.
// ---------------------------------------------------------------------------

// Nota en la app, bajo el selector de contrato. Discreta: las plantillas ya no
// son redaccion propia improvisada, asi que el aviso informa en vez de advertir.
export const AVISO_MODULO =
  'Documento elaborado sobre la base de formatos de uso común entre asociaciones de corredores de bienes raíces del Ecuador. Redinmo no presta servicios legales: verifica los datos y, en operaciones de alto valor o con condiciones especiales, revisa el documento con tu abogado antes de firmar.';

// Pie del PDF: una sola linea, en tamaño reducido, en la primera y la ultima
// pagina.
export const NOTA_PIE_PDF = 'Formato referencial. Redinmo no es parte del contrato.';

// Naturaleza de la firma. Se muestra en la pagina de firma, sin letra chica:
// es un limite real de lo que esta firma es y de lo que no.
export const AVISO_FIRMA_ELECTRONICA =
  'La aceptación electrónica de este documento constituye una FIRMA ELECTRÓNICA SIMPLE con respaldo probatorio reforzado, conforme a la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos del Ecuador. NO es una firma electrónica certificada emitida por una entidad de certificación acreditada, ni sustituye a la escritura pública en los casos en que la ley la exige.';

// Lo que ven las PARTES en la pagina de firma: preciso y neutro, informa un
// derecho del firmante en vez de advertir sobre el documento.
export const AVISO_PAGINA_FIRMA =
  'Este documento fue elaborado sobre un modelo contractual de uso habitual en el mercado inmobiliario ecuatoriano. Antes de firmarlo, usted puede descargarlo, consultarlo con un profesional de su confianza o solicitar aclaraciones a quien se lo envió. Redinmo provee la herramienta con la que se generó este documento; no es parte del contrato ni interviene en lo acordado entre ustedes.';

export const AVISO_REDINMO_NO_ES_PARTE =
  'Redinmo no es parte de este contrato, no interviene en lo acordado entre las partes y no presta servicios legales. La responsabilidad por el contenido y por su suscripción corresponde exclusivamente a quienes lo suscriben.';

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
  rolFirmante?: string;
};

export type SeccionDefinicion = {
  clave: string;
  titulo: string;
  descripcion?: string;
  campos: CampoDefinicion[];
};

export type TipoDefinicion = {
  titulo: string;
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

// Parte que comparece. "extras" añade los campos que cada contrato pide de más:
// el corretaje distingue cédula de pasaporte, el arrendamiento pide profesión y
// parroquia.
function parte(
  rol: string,
  titulo: string,
  extras: { tipoDocumento?: boolean; profesion?: boolean; parroquia?: boolean } = {},
): SeccionDefinicion {
  const campos: CampoDefinicion[] = [
    { clave: `${rol}_nombre`, etiqueta: 'Nombre completo', tipo: 'texto', obligatorio: true, rolFirmante: rol },
  ];
  if (extras.tipoDocumento) {
    campos.push({
      clave: `${rol}_tipoDocumento`,
      etiqueta: 'Tipo de documento',
      tipo: 'opcion',
      obligatorio: true,
      porDefecto: 'CEDULA',
      opciones: TIPO_DOCUMENTO,
    });
  }
  campos.push(
    { clave: `${rol}_cedula`, etiqueta: extras.tipoDocumento ? 'Número de documento' : 'Cédula', tipo: 'cedula', obligatorio: true, rolFirmante: rol },
    {
      clave: `${rol}_correo`,
      etiqueta: 'Correo electrónico',
      tipo: 'correo',
      obligatorio: true,
      rolFirmante: rol,
      ayuda: 'Es el canal por el que recibirá el documento para firmarlo.',
    },
    { clave: `${rol}_telefono`, etiqueta: 'Teléfono', tipo: 'telefono', obligatorio: true },
  );
  if (extras.profesion) campos.push({ clave: `${rol}_profesion`, etiqueta: 'Profesión', tipo: 'texto' });
  campos.push({ clave: `${rol}_direccion`, etiqueta: 'Domicilio', tipo: 'texto', obligatorio: true });
  if (extras.parroquia) {
    campos.push(
      { clave: `${rol}_parroquia`, etiqueta: 'Parroquia', tipo: 'texto' },
      { clave: `${rol}_ciudad`, etiqueta: 'Ciudad', tipo: 'texto' },
    );
  }
  return { clave: rol, titulo, campos };
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
    descripcion: 'Consignación para la venta de un inmueble, con o sin exclusividad.',
    nombreDocumento: 'CONTRATO DE CORRETAJE INMOBILIARIO',
    requiereInmueble: true,
    secciones: [
      parte('propietario', 'Datos del propietario', { tipoDocumento: true }),
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
          { clave: 'retencionDetalle', etiqueta: 'Detalle de la retención parcial', tipo: 'texto' },
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

  ARRENDAMIENTO: {
    titulo: 'Contrato de arrendamiento',
    descripcion: 'Arriendo de vivienda, oficina, local comercial, bodega o taller.',
    ayuda:
      'Este contrato tiene reglas legales que no dependen de lo que las partes acuerden. Recomendamos especialmente la revisión de un abogado.',
    nombreDocumento: 'CONTRATO DE ARRENDAMIENTO',
    requiereInmueble: true,
    secciones: [
      parte('arrendador', 'Datos del arrendador', { profesion: true, parroquia: true }),
      parte('arrendatario', 'Datos del arrendatario', { profesion: true, parroquia: true }),
      {
        clave: 'inmueble',
        titulo: 'Identificación del inmueble',
        campos: [
          { clave: 'inmuebleDireccion', etiqueta: 'Dirección', tipo: 'texto', obligatorio: true },
          { clave: 'inmuebleParroquia', etiqueta: 'Parroquia', tipo: 'texto' },
          { clave: 'inmuebleCanton', etiqueta: 'Cantón', tipo: 'texto', obligatorio: true },
          { clave: 'inmuebleProvincia', etiqueta: 'Provincia', tipo: 'texto', obligatorio: true },
        ],
      },
      {
        clave: 'titulo',
        titulo: 'Título de propiedad',
        descripcion: 'Lo que dejes vacío sale marcado como pendiente en el documento.',
        campos: [
          { clave: 'tituloFecha', etiqueta: 'Fecha de la escritura', tipo: 'fecha' },
          { clave: 'tituloNotaria', etiqueta: 'Notaría', tipo: 'texto' },
          { clave: 'tituloCanton', etiqueta: 'Cantón de la notaría', tipo: 'texto' },
          { clave: 'tituloInscripcion', etiqueta: 'Inscripción en el Registro de la Propiedad', tipo: 'texto' },
        ],
      },
      {
        clave: 'caracteristicas',
        titulo: 'Características del inmueble',
        campos: [
          { clave: 'espacios', etiqueta: 'Espacios que lo componen', tipo: 'area', obligatorio: true },
          { clave: 'estadoMantenimiento', etiqueta: 'Estado de mantenimiento a la entrega', tipo: 'area' },
          { clave: 'servicios', etiqueta: 'Servicios con que cuenta', tipo: 'area' },
          { clave: 'areasComunales', etiqueta: 'Áreas comunales de uso permitido', tipo: 'area' },
          { clave: 'equipos', etiqueta: 'Equipos que se entregan y su estado', tipo: 'area', ayuda: 'Calefón, aire acondicionado, electrodomésticos.' },
          { clave: 'inventario', etiqueta: 'Inventario, si se entrega amoblado', tipo: 'area', ayuda: 'Se anexa al contrato.' },
        ],
      },
      {
        clave: 'uso',
        titulo: 'Destino y uso',
        campos: [
          {
            clave: 'destino',
            etiqueta: 'Destino del inmueble',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'VIVIENDA',
            opciones: [
              { valor: 'VIVIENDA', etiqueta: 'vivienda' },
              { valor: 'OFICINA', etiqueta: 'oficina' },
              { valor: 'LOCAL_COMERCIAL', etiqueta: 'local comercial' },
              { valor: 'BODEGA', etiqueta: 'bodega' },
              { valor: 'TALLER', etiqueta: 'taller' },
            ],
          },
          { clave: 'numeroOcupantes', etiqueta: 'Número de ocupantes', tipo: 'numero', obligatorio: true },
          {
            clave: 'visitaAvisoHoras',
            etiqueta: 'Aviso previo para visitas del arrendador (horas)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '24',
          },
        ],
      },
      {
        clave: 'plazo',
        titulo: 'Plazo',
        campos: [
          { clave: 'plazoMeses', etiqueta: 'Plazo (meses)', tipo: 'numero', obligatorio: true, porDefecto: '12' },
          { clave: 'fechaInicio', etiqueta: 'Fecha de inicio', tipo: 'fecha', obligatorio: true },
          { clave: 'numeroLlaves', etiqueta: 'Juegos de llaves que se entregan', tipo: 'numero', obligatorio: true, porDefecto: '2' },
        ],
      },
      {
        clave: 'canon',
        titulo: 'Canon',
        campos: [
          { clave: 'canonMonto', etiqueta: 'Canon mensual', tipo: 'dinero', obligatorio: true },
          { clave: 'canonDiaPago', etiqueta: 'Día de pago de cada mes', tipo: 'numero', obligatorio: true, porDefecto: '5' },
          {
            clave: 'canonIncluyeAlicuotas',
            etiqueta: '¿El canon incluye las alícuotas?',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'NO',
            opciones: SI_NO,
          },
          {
            clave: 'formaPago',
            etiqueta: 'Forma de pago',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'TRANSFERENCIA',
            opciones: [
              { valor: 'TRANSFERENCIA', etiqueta: 'transferencia bancaria' },
              { valor: 'DEPOSITO', etiqueta: 'depósito' },
              { valor: 'EFECTIVO', etiqueta: 'efectivo' },
              { valor: 'CHEQUE', etiqueta: 'cheque' },
            ],
          },
          {
            clave: 'cuentaBancaria',
            etiqueta: 'Cuenta para transferencia o depósito',
            tipo: 'texto',
            ayuda: 'Se imprime en el contrato, que circula por correo entre las partes. Déjalo vacío si prefieres pasar estos datos por otro canal.',
          },
          {
            clave: 'declaracionCanon',
            etiqueta: '¿Incluir la declaración de las partes sobre el canon?',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'SI',
            opciones: SI_NO,
            ayuda: 'Ambas partes declaran que el canon se pactó libremente y atendiendo al estado y la ubicación del inmueble.',
          },
        ],
      },
      {
        clave: 'garantia',
        titulo: 'Garantía',
        campos: [
          { clave: 'garantiaMonto', etiqueta: 'Monto de la garantía', tipo: 'dinero', obligatorio: true },
          {
            clave: 'garantiaDevolucionDias',
            etiqueta: 'Plazo para devolverla (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '15',
          },
          { clave: 'valorPinturaM2', etiqueta: 'Pintura (USD por m²)', tipo: 'dinero' },
          { clave: 'valorPisoM2', etiqueta: 'Piso (USD por m²)', tipo: 'dinero' },
          { clave: 'valorCerradura', etiqueta: 'Cerradura (USD por unidad)', tipo: 'dinero' },
          { clave: 'conceptoLibre', etiqueta: 'Otro concepto', tipo: 'texto' },
          { clave: 'valorLibre', etiqueta: 'Valor de ese concepto (USD)', tipo: 'dinero' },
          { clave: 'unidadLibre', etiqueta: 'Unidad de ese concepto', tipo: 'texto', ayuda: 'Por ejemplo: unidad, m², juego.' },
        ],
      },
      { clave: 'jurisdiccion', titulo: 'Jurisdicción', campos: [JURISDICCION] },
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

export const CONTRATO_MENU: MenuEntrada[] = [
  { clase: 'tipo', tipo: 'CORRETAJE' },
  { clase: 'tipo', tipo: 'ARRENDAMIENTO' },
];

// Roles firmantes por tipo, en el orden en que aparecen en el documento.
export const FIRMANTES_POR_TIPO: Record<ContratoTipo, Array<{ rol: string; etiqueta: string; esAgente?: boolean }>> = {
  ...(FIRMANTES_LEGADO as Record<ContratoTipo, Array<{ rol: string; etiqueta: string; esAgente?: boolean }>>),
  CORRETAJE: [
    { rol: 'propietario', etiqueta: 'Propietario' },
    { rol: 'agente', etiqueta: 'Corredor', esAgente: true },
  ],
  ARRENDAMIENTO: [
    { rol: 'arrendador', etiqueta: 'Arrendador' },
    { rol: 'arrendatario', etiqueta: 'Arrendatario' },
  ],
};

export function esContratoTipo(valor: unknown): valor is ContratoTipo {
  return typeof valor === 'string' && (CONTRATO_TIPOS as readonly string[]).includes(valor);
}

// Un contrato firmado no se puede editar: solo anular o rehacer. Uno de tipo
// archivado tampoco, aunque siga en borrador.
export function esEditable(estado: ContratoEstado, tipo?: string): boolean {
  if (tipo && esTipoArchivado(tipo)) return false;
  return estado === 'BORRADOR';
}

export function correoValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim());
}

// Devuelve los campos obligatorios que faltan, para que el formulario y la
// ruta apliquen exactamente la misma regla.
export function camposFaltantes(tipo: ContratoTipo, datos: Record<string, string>): string[] {
  const faltan: string[] = [];
  for (const seccion of CONTRATO_DEFINICION[tipo].secciones) {
    for (const campo of seccion.campos) {
      if (!campo.obligatorio) continue;
      const valor = (datos[campo.clave] ?? '').trim();
      if (!valor) faltan.push(campo.etiqueta);
      else if (campo.tipo === 'correo' && !correoValido(valor)) faltan.push(`${campo.etiqueta} (formato no válido)`);
    }
  }
  return faltan;
}

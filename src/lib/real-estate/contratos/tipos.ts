// Contratos: tipos y configuracion de campos, compartidos entre cliente y
// servidor. Sin imports de Prisma para que el formulario del agente pueda
// importarlo sin arrastrar el backend.

// CORRETAJE (sin modalidad) es LEGADO: hay contratos generados con ese tipo y
// su definicion sigue viva para poder reimprimirlos, pero ya no se ofrece. Los
// contratos de corretaje nuevos son EXCLUSIVO o ABIERTO (punto 1.1).
export const CONTRATO_TIPOS = [
  'CORRETAJE',
  'CORRETAJE_EXCLUSIVO',
  'CORRETAJE_ABIERTO',
  'ARRENDAMIENTO',
  'RESERVA_ARRIENDO',
  'RESERVA_COMPRAVENTA',
] as const;
export type ContratoTipo = (typeof CONTRATO_TIPOS)[number];

export const CONTRATO_TIPOS_LEGADO: readonly ContratoTipo[] = ['CORRETAJE'];

export const CONTRATO_ESTADOS = ['BORRADOR', 'PENDIENTE_FIRMA', 'FIRMADO', 'RECHAZADO', 'ANULADO'] as const;
export type ContratoEstado = (typeof CONTRATO_ESTADOS)[number];

export const FIRMANTE_ESTADOS = ['ENVIADO', 'ABIERTO', 'FIRMADO', 'RECHAZADO'] as const;
export type FirmanteEstado = (typeof FIRMANTE_ESTADOS)[number];

// Vigencia del enlace de firma (punto 3.4). Vencido, el agente reenvia.
export const FIRMA_VIGENCIA_DIAS = 15;
// Recordatorio automatico a quien no firmo (punto 3.7).
export const FIRMA_RECORDATORIO_DIAS = 3;

// ---------------------------------------------------------------------------
// ADVERTENCIAS LEGALES
//
// Viven aca, en un solo lugar, y NUNCA se exponen como campo editable del
// formulario: el agente no puede alterarlas, quitarlas ni reescribirlas
// (punto 4.3). El generador de documentos las inserta siempre, tomandolas de
// estas constantes y no de los datos que envia el cliente. No hay ninguna
// preferencia de configuracion que las desactive: el interruptor no existe.
// ---------------------------------------------------------------------------

// Nota al pie del PDF. Va en la PRIMERA y en la ÚLTIMA página, no en todas:
// un aviso repetido siete veces se lee como descargo de responsabilidad; una
// vez, como nota informativa.
//
// Está redactada para las PARTES, que es quien lee el PDF. Dice lo mismo que la
// versión anterior sin sugerir que el documento sea provisional: quien recibe
// un contrato de su agente no tiene por qué deducir que le mandaron un borrador.
// El aviso enfático, el que habla de revisión legal, sigue existiendo entero
// pero donde corresponde: de cara al agente, que es quien decide usarlo.
export const NOTA_PIE_OBLIGATORIA =
  'Documento generado en Redinmo sobre un modelo contractual de uso habitual. Redinmo no es parte de este contrato.';

// Naturaleza de la firma (puntos 0.2 y 3.10). Se muestra en el documento y en
// la pagina de firma, sin letra chica.
export const AVISO_FIRMA_ELECTRONICA =
  'La aceptación electrónica de este documento constituye una FIRMA ELECTRÓNICA SIMPLE con respaldo probatorio reforzado, conforme a la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos del Ecuador. NO es una firma electrónica certificada emitida por una entidad de certificación acreditada, ni sustituye a la escritura pública en los casos en que la ley la exige.';

// Advertencia obligatoria de la reserva de compraventa (puntos 0.3 y 2.4).
export const AVISO_RESERVA_NO_ES_PROMESA =
  'Este instrumento constituye una RESERVA y no una promesa de compraventa. Conforme a la legislación ecuatoriana, la promesa de compraventa de bienes inmuebles requiere escritura pública. Las partes deberán elevar a escritura pública el contrato definitivo dentro del plazo pactado.';

// Advertencia del arrendamiento (puntos 2.2 y 5.6).
export const AVISO_LEY_INQUILINATO =
  'El arrendamiento de inmuebles urbanos en Ecuador se rige por normas de orden público que las partes no pueden modificar libremente. Verifique con un profesional del derecho las obligaciones aplicables a su caso, incluida la eventual necesidad de registrar este contrato ante la autoridad competente de su cantón.';

// Deslinde de la plataforma (punto 0.5).
export const AVISO_REDINMO_NO_ES_PARTE =
  'Redinmo no es parte de este contrato, no lo redacta a medida, no presta asesoría legal y no garantiza su idoneidad para el caso concreto. La responsabilidad por el contenido y por su suscripción corresponde exclusivamente a las partes.';

// ---------------------------------------------------------------------------
// DISCLAIMER DE MODELO REFERENCIAL (punto 4)
//
// El mismo principio dicho en los cuatro momentos en que alguien decide algo:
// al entrar al modulo, al mirar el borrador, al aceptar y al leer el PDF. La
// redaccion es deliberadamente llana (punto 4.5): un aviso que no se entiende
// protege menos que uno que si.
// ---------------------------------------------------------------------------

// a. Al entrar al modulo, la primera vez y cada 90 dias (punto 4.2.a).
export const AVISO_MODULO_TITULO = 'Los contratos de Redinmo son modelos referenciales';
export const AVISO_MODULO_PARRAFOS = [
  'Están redactados con base en la práctica habitual del mercado inmobiliario ecuatoriano, pero no contemplan las particularidades de cada operación ni constituyen asesoría legal.',
  'Recomendamos que un abogado revise el documento antes de su suscripción, especialmente en operaciones de monto significativo o con condiciones especiales.',
  'La responsabilidad por el uso de estos documentos corresponde exclusivamente a las partes que los suscriben.',
];
export const AVISO_MODULO_CASILLA =
  'Entiendo que estos documentos son referenciales y que Redinmo no presta asesoría legal.';

// Version del texto aceptado: si el aviso cambia de fondo se sube esta fecha y
// todos los agentes vuelven a aceptarlo, aunque estén dentro de los 90 días.
export const AVISO_MODULO_VERSION = '2026-09-09';
export const AVISO_MODULO_VIGENCIA_DIAS = 90;

// b. En la vista previa, antes de enviar a firma (punto 4.2.b). No descartable.
export const AVISO_VISTA_PREVIA =
  'Documento referencial. Recomendamos revisión por un abogado antes de enviarlo a firma.';

// c. En la pagina de firma que ven las partes (punto 4.2.c). Se muestra con el
// mismo peso tipografico que el resto de la pagina, nunca como letra chica.
//
// PRECISO Y NEUTRO, a diferencia del aviso que ve el agente. Informa un derecho
// del firmante en vez de advertir sobre el documento, y deja al agente como
// interlocutor legitimo a quien preguntar. La posibilidad de consultar a un
// abogado sigue dicha; lo que se quita es el tono de "esto quiza no sirva",
// que dejaba al agente explicando por que mando algo dudoso.
export const AVISO_PAGINA_FIRMA =
  'Este documento fue elaborado sobre un modelo contractual de uso habitual en el mercado inmobiliario ecuatoriano. Antes de firmarlo, usted puede descargarlo, consultarlo con un profesional de su confianza o solicitar aclaraciones a quien se lo envió. Redinmo provee la herramienta con la que se generó este documento; no es parte del contrato ni interviene en lo acordado entre ustedes.';

// Enlace de orientacion junto al boton de generar (punto 4.6).
export const ENLACE_REVISION_ABOGADO = '/legal/revision-abogado';
export const ENLACE_REVISION_ABOGADO_ETIQUETA = '¿Necesitas que un abogado lo revise?';

// Guion para presentarle el documento al cliente, junto al boton de enviar a
// firma. Es material de apoyo comercial, no legal: existe para que el agente
// transmita seguridad en vez de disculparse por el documento que envia.
export const ENLACE_EXPLICAR_CLIENTE = '/ayuda/explicar-el-contrato';
export const ENLACE_EXPLICAR_CLIENTE_ETIQUETA = '¿Cómo explicarle este documento a tu cliente?';

// Un agente vuelve a aceptar el aviso si nunca lo aceptó, si aceptó una
// version anterior del texto, o si pasaron mas de 90 dias.
export function debeAceptarAviso(aceptadoAt: Date | string | null, versionAceptada: string | null): boolean {
  if (!aceptadoAt || versionAceptada !== AVISO_MODULO_VERSION) return true;
  const fecha = typeof aceptadoAt === 'string' ? new Date(aceptadoAt) : aceptadoAt;
  if (Number.isNaN(fecha.getTime())) return true;
  const dias = (Date.now() - fecha.getTime()) / (24 * 60 * 60 * 1000);
  return dias > AVISO_MODULO_VIGENCIA_DIAS;
}

// 'opcionExplicada' se dibuja como una lista de tarjetas, no como un menú
// desplegable: cada alternativa muestra su consecuencia práctica al lado, y
// todas se ven a la vez. Es para las decisiones donde el agente tiene que
// entender QUÉ está eligiendo, no solo cuál es la costumbre del mercado.
export type CampoTipo = 'texto' | 'cedula' | 'correo' | 'telefono' | 'numero' | 'dinero' | 'porcentaje' | 'fecha' | 'opcion' | 'opcionExplicada' | 'multiple' | 'area';

export type CampoOpcion = {
  valor: string;
  etiqueta: string;
  // Qué pasa de verdad si se elige esto. Obligatorio de hecho en los campos
  // de tipo 'opcionExplicada'.
  consecuencia?: string;
};

export type CampoDefinicion = {
  clave: string;
  etiqueta: string;
  tipo: CampoTipo;
  obligatorio?: boolean;
  // Valor por defecto sensato (punto 1.4). Siempre editable.
  porDefecto?: string;
  opciones?: CampoOpcion[];
  ayuda?: string;
  // Para el bloque de una parte firmante: agrupa nombre/cedula/correo.
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
  // Texto de ayuda que acompaña a la tarjeta de este documento en el selector
  // (puntos 1.6 y 5.7). En lenguaje llano, no juridico.
  ayuda?: string;
  secciones: SeccionDefinicion[];
};

const SI_NO = [
  { valor: 'SI', etiqueta: 'Sí' },
  { valor: 'NO', etiqueta: 'No' },
];

// Formas de pago admitidas (punto 2.3). Deliberadamente NO existe un campo de
// numero de cuenta, entidad ni titular: ese dato es sensible y no tiene por
// que quedar escrito en un documento que circula por correo entre varias
// partes (punto 2.2). Los datos para pagar viajan por canal separado.
const FORMAS_PAGO = [
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia bancaria' },
  { valor: 'DEPOSITO', etiqueta: 'Depósito' },
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'CHEQUE', etiqueta: 'Cheque' },
];

// El correo de cada parte es OBLIGATORIO en todos los tipos: es el canal por
// el que viaja el enlace de firma, sin el no hay documento que firmar.
function parte(rol: string, titulo: string, opciones: { estadoCivil?: boolean; direccion?: boolean } = {}): SeccionDefinicion {
  const campos: CampoDefinicion[] = [
    { clave: `${rol}_nombre`, etiqueta: 'Nombre completo', tipo: 'texto', obligatorio: true, rolFirmante: rol },
    { clave: `${rol}_cedula`, etiqueta: 'Cédula o RUC', tipo: 'cedula', obligatorio: true, rolFirmante: rol },
    {
      clave: `${rol}_correo`,
      etiqueta: 'Correo electrónico',
      tipo: 'correo',
      obligatorio: true,
      rolFirmante: rol,
      ayuda: 'Es el canal por el que recibirá el documento para firmarlo.',
    },
    { clave: `${rol}_telefono`, etiqueta: 'Teléfono', tipo: 'telefono' },
  ];
  if (opciones.estadoCivil) campos.push({ clave: `${rol}_estadoCivil`, etiqueta: 'Estado civil', tipo: 'texto' });
  if (opciones.direccion !== false) campos.push({ clave: `${rol}_direccion`, etiqueta: 'Dirección', tipo: 'texto' });
  return { clave: rol, titulo, campos };
}

// Datos catastrales que el formato de corretaje pide y que el inventario no
// guarda. Opcionales: si el agente no los tiene a mano, la cláusula los omite
// en vez de imprimir una línea de puntos.
const CATASTRO: SeccionDefinicion = {
  clave: 'catastro',
  titulo: 'Datos catastrales del inmueble (opcional)',
  descripcion: 'Salen de la cédula catastral. Si no los tienes ahora, el documento los omite.',
  campos: [
    { clave: 'predio', etiqueta: 'Número de predio', tipo: 'texto' },
    { clave: 'areaCubierta', etiqueta: 'Área de construcción cubierta (m²)', tipo: 'numero' },
    { clave: 'areaAbierta', etiqueta: 'Área de construcción abierta (m²)', tipo: 'numero' },
    { clave: 'anioConstruccion', etiqueta: 'Año de construcción', tipo: 'numero' },
  ],
};

const OBJETO_CORRETAJE: CampoDefinicion = {
  clave: 'objeto',
  etiqueta: 'Autorización para',
  tipo: 'opcion',
  obligatorio: true,
  porDefecto: 'VENTA',
  opciones: [
    { valor: 'VENTA', etiqueta: 'Venta' },
    { valor: 'ARRIENDO', etiqueta: 'Arriendo' },
    { valor: 'AMBOS', etiqueta: 'Venta y arriendo' },
  ],
};

const COMISION_BASE: CampoDefinicion = {
  clave: 'comisionBase',
  etiqueta: 'La comisión se calcula sobre',
  tipo: 'opcion',
  porDefecto: 'PRECIO_VENTA',
  opciones: [
    { valor: 'PRECIO_VENTA', etiqueta: 'El precio final de la transacción' },
    { valor: 'PRECIO_SALIDA', etiqueta: 'El precio de salida' },
    { valor: 'UN_CANON', etiqueta: 'Un canon de arrendamiento' },
  ],
};

const HONORARIOS_CORRETAJE: CampoDefinicion[] = [
  {
    clave: 'comisionPorcentaje',
    etiqueta: 'Comisión (%)',
    tipo: 'porcentaje',
    obligatorio: true,
    porDefecto: '3',
    ayuda: 'Habitual: 3% en venta. En arriendo suele pactarse un canon.',
  },
  COMISION_BASE,
  {
    clave: 'honorariosContado',
    etiqueta: 'Pago de los honorarios si la operación es de contado',
    tipo: 'area',
    porDefecto: 'A la suscripción de la escritura pública de compraventa.',
  },
  {
    clave: 'honorariosFinanciado',
    etiqueta: 'Pago de los honorarios si la operación es financiada',
    tipo: 'area',
    porDefecto:
      'A la suscripción de la escritura pública, con independencia de la fecha en que la entidad financiera desembolse el crédito.',
  },
];

function facultadesCorretaje(): SeccionDefinicion {
  return {
    clave: 'facultades',
    titulo: 'Facultades del agente',
    descripcion: 'Marca lo que el propietario autoriza.',
    campos: [
      {
        clave: 'facultades',
        etiqueta: 'Autorizaciones',
        tipo: 'multiple',
        porDefecto: 'PORTALES,VISITAS,COMPARTIR',
        opciones: [
          { valor: 'PORTALES', etiqueta: 'Publicar en portales inmobiliarios' },
          { valor: 'ROTULO', etiqueta: 'Colocar rótulo en el inmueble' },
          { valor: 'VISITAS', etiqueta: 'Coordinar y acompañar visitas' },
          { valor: 'COMPARTIR', etiqueta: 'Compartir el inmueble con otros agentes' },
          { valor: 'TRAMITES', etiqueta: 'Representarle ante municipios, notarías y registros' },
        ],
      },
      {
        clave: 'gastosPromocion',
        etiqueta: 'Gastos de promoción a cargo de',
        tipo: 'opcion',
        porDefecto: 'AGENTE',
        opciones: [
          { valor: 'AGENTE', etiqueta: 'El agente' },
          { valor: 'PROPIETARIO', etiqueta: 'El propietario' },
          { valor: 'COMPARTIDOS', etiqueta: 'Compartidos en partes iguales' },
        ],
      },
      {
        clave: 'hipotecado',
        etiqueta: '¿El inmueble está hipotecado?',
        tipo: 'opcion',
        obligatorio: true,
        porDefecto: 'NO',
        opciones: SI_NO,
        ayuda: 'El propietario lo declara en el documento.',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Definicion de campos por tipo (punto 2). Todo lo que el sistema ya sabe -
// agente e inmueble - se autocompleta y NO aparece aca: este es solo lo que
// hay que preguntar (punto 1.2).
// ---------------------------------------------------------------------------
export const CONTRATO_DEFINICION: Record<ContratoTipo, TipoDefinicion> = {
  // -------------------------------------------------------------------------
  // LEGADO. No se ofrece en el selector. Vive para reimprimir los contratos de
  // corretaje generados antes de que existieran las dos modalidades.
  // -------------------------------------------------------------------------
  CORRETAJE: {
    titulo: 'Contrato de corretaje',
    descripcion: 'Autorización de venta o arriendo con comisión pactada.',
    nombreDocumento: 'CONTRATO DE CORRETAJE INMOBILIARIO',
    requiereInmueble: true,
    secciones: [
      parte('propietario', 'Datos del propietario'),
      {
        clave: 'objeto',
        titulo: 'Objeto y condiciones',
        campos: [
          OBJETO_CORRETAJE,
          { clave: 'precioSalida', etiqueta: 'Precio de salida acordado', tipo: 'dinero', obligatorio: true },
          {
            clave: 'comisionPorcentaje',
            etiqueta: 'Comisión (%)',
            tipo: 'porcentaje',
            obligatorio: true,
            porDefecto: '3',
            ayuda: 'Habitual: 3% en venta. En arriendo suele pactarse un canon.',
          },
          COMISION_BASE,
        ],
      },
      {
        clave: 'vigencia',
        titulo: 'Vigencia y exclusividad',
        campos: [
          { clave: 'vigenciaMeses', etiqueta: 'Vigencia del contrato (meses)', tipo: 'numero', obligatorio: true, porDefecto: '6' },
          { clave: 'exclusividad', etiqueta: '¿Se pacta exclusividad?', tipo: 'opcion', porDefecto: 'NO', opciones: SI_NO },
          { clave: 'exclusividadMeses', etiqueta: 'Plazo de exclusividad (meses)', tipo: 'numero', porDefecto: '6' },
        ],
      },
      {
        clave: 'facultades',
        titulo: 'Facultades del agente',
        descripcion: 'Marca lo que el propietario autoriza.',
        campos: [
          {
            clave: 'facultades',
            etiqueta: 'Autorizaciones',
            tipo: 'multiple',
            porDefecto: 'PORTALES,VISITAS,COMPARTIR',
            opciones: [
              { valor: 'PORTALES', etiqueta: 'Publicar en portales inmobiliarios' },
              { valor: 'ROTULO', etiqueta: 'Colocar rótulo en el inmueble' },
              { valor: 'VISITAS', etiqueta: 'Coordinar y acompañar visitas' },
              { valor: 'COMPARTIR', etiqueta: 'Compartir el inmueble con otros agentes' },
            ],
          },
          {
            clave: 'gastosPromocion',
            etiqueta: 'Gastos de promoción a cargo de',
            tipo: 'opcion',
            porDefecto: 'AGENTE',
            opciones: [
              { valor: 'AGENTE', etiqueta: 'El agente' },
              { valor: 'PROPIETARIO', etiqueta: 'El propietario' },
              { valor: 'COMPARTIDOS', etiqueta: 'Compartidos en partes iguales' },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // CORRETAJE EXCLUSIVO (punto 1.3)
  // -------------------------------------------------------------------------
  CORRETAJE_EXCLUSIVO: {
    titulo: 'Corretaje exclusivo',
    descripcion: 'El propietario encarga la gestión únicamente a ti durante el plazo pactado.',
    ayuda: 'Solo tú gestionas el inmueble durante el plazo. Te protege si el propietario vende por otro lado.',
    nombreDocumento: 'CONTRATO DE CORRETAJE INMOBILIARIO — MODALIDAD EXCLUSIVA',
    requiereInmueble: true,
    secciones: [
      parte('propietario', 'Datos del propietario'),
      CATASTRO,
      {
        clave: 'objeto',
        titulo: 'Objeto y precio',
        campos: [
          OBJETO_CORRETAJE,
          { clave: 'precioSalida', etiqueta: 'Precio de salida acordado', tipo: 'dinero', obligatorio: true },
        ],
      },
      {
        clave: 'exclusividad',
        titulo: 'Exclusividad',
        descripcion: 'Durante este plazo el inmueble se gestiona únicamente a través de ti.',
        campos: [
          {
            clave: 'plazoExclusividadMeses',
            etiqueta: 'Plazo de exclusividad (meses)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '4',
          },
          {
            clave: 'renovacionAutomatica',
            etiqueta: '¿Se renueva automáticamente al vencer?',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'NO',
            opciones: SI_NO,
            ayuda: 'Con "No", el plazo termina si nadie avisa. Con "Sí", se renueva salvo que una parte avise 15 días antes.',
          },
        ],
      },
      { clave: 'honorarios', titulo: 'Honorarios', campos: HONORARIOS_CORRETAJE },
      {
        clave: 'proteccion',
        titulo: 'Si el propietario opera por fuera',
        descripcion: 'Qué comisión se te debe si, durante la exclusividad, el inmueble se negocia sin ti.',
        campos: [
          {
            clave: 'comisionVentaDirecta',
            etiqueta: 'Comisión si el propietario negocia directamente (%)',
            tipo: 'porcentaje',
            obligatorio: true,
            porDefecto: '3',
          },
          {
            clave: 'comisionOtroAgente',
            etiqueta: 'Comisión si el propietario encarga a otro agente (%)',
            tipo: 'porcentaje',
            obligatorio: true,
            porDefecto: '3',
          },
        ],
      },
      facultadesCorretaje(),
    ],
  },

  // -------------------------------------------------------------------------
  // CORRETAJE ABIERTO (punto 1.3)
  // -------------------------------------------------------------------------
  CORRETAJE_ABIERTO: {
    titulo: 'Corretaje abierto',
    descripcion: 'El propietario puede encargar el inmueble a más de un agente o gestionarlo directamente.',
    ayuda: 'El propietario puede trabajar con varios agentes. Tu comisión se protege por los interesados que tú presentes.',
    nombreDocumento: 'CONTRATO DE CORRETAJE INMOBILIARIO — MODALIDAD ABIERTA',
    requiereInmueble: true,
    secciones: [
      parte('propietario', 'Datos del propietario'),
      CATASTRO,
      {
        clave: 'objeto',
        titulo: 'Objeto y precio',
        campos: [
          OBJETO_CORRETAJE,
          { clave: 'precioSalida', etiqueta: 'Precio de salida acordado', tipo: 'dinero', obligatorio: true },
        ],
      },
      {
        clave: 'vigencia',
        titulo: 'Vigencia del encargo',
        campos: [
          {
            clave: 'vigenciaMeses',
            etiqueta: 'Vigencia del encargo (meses)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '3',
          },
        ],
      },
      { clave: 'honorarios', titulo: 'Honorarios', campos: HONORARIOS_CORRETAJE },
      {
        clave: 'interesados',
        titulo: 'Interesados que tú presentas',
        descripcion:
          'Es lo que protege tu comisión en esta modalidad: la lista se anexa al contrato y puedes ampliarla por escrito mientras esté vigente.',
        campos: [
          {
            clave: 'interesadosPresentados',
            etiqueta: 'Interesados presentados a la fecha',
            tipo: 'area',
            ayuda: 'Un nombre por línea. Si todavía no has presentado a nadie, déjalo vacío: el anexo queda abierto.',
          },
        ],
      },
      facultadesCorretaje(),
    ],
  },

  ARRENDAMIENTO: {
    titulo: 'Contrato de arrendamiento',
    descripcion: 'Arriendo de un inmueble con canon y plazo pactados.',
    ayuda:
      'Este contrato tiene reglas legales que no dependen de lo que las partes acuerden. Recomendamos especialmente la revisión de un abogado.',
    nombreDocumento: 'CONTRATO DE ARRENDAMIENTO',
    requiereInmueble: true,
    secciones: [
      parte('arrendador', 'Datos del arrendador'),
      parte('arrendatario', 'Datos del arrendatario'),
      {
        clave: 'condiciones',
        titulo: 'Condiciones del arriendo',
        campos: [
          {
            clave: 'destino',
            etiqueta: 'Destino del inmueble',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'VIVIENDA',
            opciones: [
              { valor: 'VIVIENDA', etiqueta: 'Vivienda' },
              { valor: 'COMERCIAL', etiqueta: 'Comercial' },
              { valor: 'OTRO', etiqueta: 'Otro' },
            ],
          },
          { clave: 'canon', etiqueta: 'Canon mensual', tipo: 'dinero', obligatorio: true },
          { clave: 'diaPago', etiqueta: 'Día de pago de cada mes', tipo: 'numero', obligatorio: true, porDefecto: '5' },
          {
            clave: 'formaPagoCanon',
            etiqueta: 'Forma de pago del canon',
            tipo: 'opcion',
            obligatorio: true,
            porDefecto: 'TRANSFERENCIA',
            opciones: FORMAS_PAGO,
            ayuda: 'No se registra número de cuenta: esos datos se entregan por canal separado entre las partes.',
          },
          { clave: 'plazoMeses', etiqueta: 'Plazo (meses)', tipo: 'numero', obligatorio: true, porDefecto: '12' },
          { clave: 'fechaInicio', etiqueta: 'Fecha de inicio', tipo: 'fecha', obligatorio: true },
          { clave: 'garantia', etiqueta: 'Garantía o depósito', tipo: 'dinero', porDefecto: '' },
          {
            clave: 'garantiaDevolucion',
            etiqueta: 'Condiciones de devolución de la garantía',
            tipo: 'area',
            porDefecto:
              'Se devolverá dentro de los quince días siguientes a la entrega del inmueble, descontando los valores por daños o servicios pendientes.',
          },
          {
            clave: 'serviciosACargo',
            etiqueta: 'Servicios básicos a cargo de',
            tipo: 'opcion',
            porDefecto: 'ARRENDATARIO',
            opciones: [
              { valor: 'ARRENDATARIO', etiqueta: 'El arrendatario' },
              { valor: 'ARRENDADOR', etiqueta: 'El arrendador' },
            ],
          },
          {
            clave: 'alicuotaACargo',
            etiqueta: 'Alícuota a cargo de',
            tipo: 'opcion',
            porDefecto: 'ARRENDADOR',
            opciones: [
              { valor: 'ARRENDADOR', etiqueta: 'El arrendador' },
              { valor: 'ARRENDATARIO', etiqueta: 'El arrendatario' },
              { valor: 'NO_APLICA', etiqueta: 'No aplica' },
            ],
          },
          { clave: 'amoblado', etiqueta: '¿Se entrega amoblado?', tipo: 'opcion', porDefecto: 'NO', opciones: SI_NO },
          {
            clave: 'inventarioBienes',
            etiqueta: 'Inventario de bienes (si es amoblado)',
            tipo: 'area',
            ayuda: 'Se adjunta como parte del contrato.',
          },
          { clave: 'reajuste', etiqueta: '¿Se pacta reajuste del canon?', tipo: 'opcion', porDefecto: 'NO', opciones: SI_NO },
          { clave: 'reajusteCriterio', etiqueta: 'Criterio de reajuste', tipo: 'texto' },
        ],
      },
    ],
  },

  RESERVA_ARRIENDO: {
    titulo: 'Reserva de arrendamiento',
    descripcion: 'Reserva de un inmueble mientras se cumplen las condiciones del arriendo.',
    nombreDocumento: 'RESERVA DE ARRENDAMIENTO',
    requiereInmueble: true,
    secciones: [
      parte('interesado', 'Datos del interesado'),
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
            ayuda: 'De esto depende quién tiene que devolver el dinero si el arriendo no se concreta. La cláusula se redacta sola a partir de tu respuesta.',
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
            // ------------------------------------------------------------------
            // SIN VALOR POR DEFECTO, A PROPÓSITO. NO AÑADIR UNO.
            //
            // Un default aquí es una decisión que el sistema toma por el agente
            // sin que la note, y es justamente la cláusula que más conflictos
            // genera de todo el documento. Los dos toques extra de elegirla a
            // mano son el precio de que alguien la haya mirado.
            //
            // Si en el futuro alguien propone ponerle default "para mejorar la
            // usabilidad": la decisión ya se tomó y se ratificó. La usabilidad
            // que importa aquí es entender lo que se firma, no ahorrar un clic.
            // ------------------------------------------------------------------
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
          { clave: 'devolucionParcialDetalle', etiqueta: 'Detalle de la devolución parcial', tipo: 'texto' },
        ],
      },
    ],
  },

  RESERVA_COMPRAVENTA: {
    titulo: 'Reserva de compraventa',
    descripcion: 'Reserva de un inmueble mientras se prepara la escritura pública.',
    nombreDocumento: 'CONTRATO DE RESERVA DE COMPRAVENTA DE BIEN INMUEBLE',
    requiereInmueble: true,
    secciones: [
      parte('vendedor', 'Datos de la parte vendedora', { estadoCivil: true }),
      parte('comprador', 'Datos de la parte compradora', { estadoCivil: true }),
      {
        clave: 'antecedentes',
        titulo: 'Antecedentes (opcional)',
        descripcion: 'Si no los completas, el documento omite estas cláusulas en vez de dejarlas en blanco.',
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
            ayuda: 'De esto depende quién tiene que devolver o entregar el dinero si alguien desiste. La cláusula de penalidad se redacta sola a partir de tu respuesta.',
          },
          {
            clave: 'plazoDevolucionDias',
            etiqueta: 'Plazo para devolver o entregar el valor (días hábiles)',
            tipo: 'numero',
            obligatorio: true,
            porDefecto: '5',
          },
          { clave: 'plazoDias', etiqueta: 'Plazo de la reserva (días)', tipo: 'numero', obligatorio: true, porDefecto: '15' },
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
            etiqueta: 'Entidad que concede el crédito (si aplica)',
            tipo: 'texto',
            ayuda: 'Solo el nombre de la institución. Nunca un número de cuenta.',
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
            porDefecto: 'COMPRADOR',
            opciones: [
              { valor: 'COMPRADOR', etiqueta: 'La parte compradora' },
              { valor: 'VENDEDOR', etiqueta: 'La parte vendedora' },
              { valor: 'COMPARTIDOS', etiqueta: 'Compartidos en partes iguales' },
            ],
          },
          // La penalidad dejó de escribirse a mano. Se elige QUÉ pasa y la
          // plantilla redacta CÓMO pasa, en función de quién tiene el dinero:
          // un texto libre podía decir que el corredor devuelve un valor que,
          // según el resto del documento, nunca recibió.
          //
          // ------------------------------------------------------------------
          // LAS DOS OPCIONES DE DESISTIMIENTO VAN SIN VALOR POR DEFECTO, A
          // PROPÓSITO. NO AÑADIR UNO.
          //
          // Un default aquí es una decisión que el sistema toma por el agente
          // sin que la note, y es justamente la cláusula que más conflictos
          // genera de todo el documento. Los dos toques extra de elegirlas a
          // mano son el precio de que alguien las haya mirado.
          //
          // Si en el futuro alguien propone ponerles default "para mejorar la
          // usabilidad": la decisión ya se tomó y se ratificó. La usabilidad
          // que importa aquí es entender lo que se firma, no ahorrar un clic.
          // El texto de ayuda dice cuál es la costumbre del mercado; eso
          // orienta sin decidir.
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
};

// ---------------------------------------------------------------------------
// Selector de documento (puntos 1.1 y 1.2). El corretaje se presenta como un
// grupo con DOS TARJETAS de modalidad, porque elegir entre exclusivo y abierto
// es una decision del negocio y no un campo mas del formulario: cambia el
// documento entero, no un parrafo.
// ---------------------------------------------------------------------------
export type MenuEntrada =
  | { clase: 'tipo'; tipo: ContratoTipo }
  | { clase: 'grupo'; clave: string; titulo: string; descripcion: string; modalidades: ContratoTipo[] };

export const CONTRATO_MENU: MenuEntrada[] = [
  {
    clase: 'grupo',
    clave: 'CORRETAJE',
    titulo: 'Contrato de corretaje',
    descripcion:
      'Autorización del propietario para gestionar la venta o el arriendo. Eliges la modalidad en el paso siguiente.',
    modalidades: ['CORRETAJE_EXCLUSIVO', 'CORRETAJE_ABIERTO'],
  },
  { clase: 'tipo', tipo: 'RESERVA_COMPRAVENTA' },
  { clase: 'tipo', tipo: 'RESERVA_ARRIENDO' },
  { clase: 'tipo', tipo: 'ARRENDAMIENTO' },
];

// Roles firmantes por tipo, en el orden en que aparecen en el documento. El
// agente NO firma cuando es un tercero al negocio; si firma cuando el
// documento le impone obligaciones propias: corretaje, y reserva de
// compraventa cuando comparece como gestor de la negociacion, tal como lo hace
// el formato de referencia.
export const FIRMANTES_POR_TIPO: Record<ContratoTipo, Array<{ rol: string; etiqueta: string; esAgente?: boolean }>> = {
  CORRETAJE: [
    { rol: 'propietario', etiqueta: 'Propietario' },
    { rol: 'agente', etiqueta: 'Agente corredor', esAgente: true },
  ],
  CORRETAJE_EXCLUSIVO: [
    { rol: 'propietario', etiqueta: 'Cliente vendedor' },
    { rol: 'agente', etiqueta: 'Corredor inmobiliario', esAgente: true },
  ],
  CORRETAJE_ABIERTO: [
    { rol: 'propietario', etiqueta: 'Cliente vendedor' },
    { rol: 'agente', etiqueta: 'Corredor inmobiliario', esAgente: true },
  ],
  ARRENDAMIENTO: [
    { rol: 'arrendador', etiqueta: 'Arrendador' },
    { rol: 'arrendatario', etiqueta: 'Arrendatario' },
  ],
  RESERVA_ARRIENDO: [
    { rol: 'interesado', etiqueta: 'Interesado' },
    { rol: 'agente', etiqueta: 'Agente', esAgente: true },
  ],
  RESERVA_COMPRAVENTA: [
    { rol: 'vendedor', etiqueta: 'Parte vendedora' },
    { rol: 'comprador', etiqueta: 'Parte compradora' },
    { rol: 'agente', etiqueta: 'Corredor de bienes raíces', esAgente: true },
  ],
};

export function esContratoTipo(valor: unknown): valor is ContratoTipo {
  return typeof valor === 'string' && (CONTRATO_TIPOS as readonly string[]).includes(valor);
}

// Un contrato firmado no se puede editar (punto 4.3): solo anular o rehacer.
export function esEditable(estado: ContratoEstado): boolean {
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

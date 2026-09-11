// ===========================================================================
// DEFINICIONES DE TIPOS DE CONTRATO RETIRADOS
//
// Aquí viven los tipos que el agente YA NO PUEDE GENERAR, pero cuyos contratos
// existentes hay que seguir abriendo, imprimiendo y descargando: la reserva de
// compraventa, la reserva de arrendamiento y las dos modalidades separadas de
// corretaje, que se unificaron en una sola plantilla con la exclusividad como
// campo.
//
// POR QUÉ ESTÁ SEPARADO Y POR QUÉ SE COPIAN LOS AYUDANTES en vez de importarlos
// de ./tipos: este archivo está CONGELADO. Un contrato archivado tiene que
// reimprimirse exactamente igual que el día que se firmó, y eso incluye las
// etiquetas de sus campos de opción, que es de donde el generador saca el texto
// legible. Si compartiera los ayudantes con los tipos vivos, cualquier retoque
// futuro a una etiqueta cambiaría en silencio un documento ya suscrito.
//
// NO SE EDITA. Se agregan entradas cuando otro tipo se retire.
// ===========================================================================

import type { CampoDefinicion, SeccionDefinicion, TipoDefinicion } from './tipos';

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


export const DEFINICIONES_LEGADO: Record<string, TipoDefinicion> = {
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

// Roles firmantes de los tipos retirados, con el mismo criterio: se conservan
// para que la constancia de un documento archivado siga nombrando a cada parte
// como lo hacía cuando se firmó.
export const FIRMANTES_LEGADO: Record<string, Array<{ rol: string; etiqueta: string; esAgente?: boolean }>> = {
  CORRETAJE_EXCLUSIVO: [
    { rol: 'propietario', etiqueta: 'Cliente vendedor' },
    { rol: 'agente', etiqueta: 'Corredor inmobiliario', esAgente: true },
  ],
  CORRETAJE_ABIERTO: [
    { rol: 'propietario', etiqueta: 'Cliente vendedor' },
    { rol: 'agente', etiqueta: 'Corredor inmobiliario', esAgente: true },
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

// Contratos: tipos y configuracion de campos, compartidos entre cliente y
// servidor. Sin imports de Prisma para que el formulario del agente pueda
// importarlo sin arrastrar el backend.

export const CONTRATO_TIPOS = ['CORRETAJE', 'ARRENDAMIENTO', 'RESERVA_ARRIENDO', 'RESERVA_COMPRAVENTA'] as const;
export type ContratoTipo = (typeof CONTRATO_TIPOS)[number];

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
// formulario (punto 8): el agente no puede alterarlas, quitarlas ni
// reescribirlas. El generador de documentos las inserta siempre, tomandolas de
// estas constantes y no de los datos que envia el cliente.
// ---------------------------------------------------------------------------

// Nota al pie de TODOS los documentos (punto 0.4).
export const NOTA_PIE_OBLIGATORIA =
  'Documento generado en Redinmo. Se recomienda revisión por un profesional del derecho antes de su suscripción.';

// Naturaleza de la firma (puntos 0.2 y 3.10). Se muestra en el documento y en
// la pagina de firma, sin letra chica.
export const AVISO_FIRMA_ELECTRONICA =
  'La aceptación electrónica de este documento constituye una FIRMA ELECTRÓNICA SIMPLE con respaldo probatorio reforzado, conforme a la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos del Ecuador. NO es una firma electrónica certificada emitida por una entidad de certificación acreditada, ni sustituye a la escritura pública en los casos en que la ley la exige.';

// Advertencia obligatoria de la reserva de compraventa (puntos 0.3 y 2.4).
export const AVISO_RESERVA_NO_ES_PROMESA =
  'Este instrumento constituye una RESERVA y no una promesa de compraventa. Conforme a la legislación ecuatoriana, la promesa de compraventa de bienes inmuebles requiere escritura pública. Las partes deberán elevar a escritura pública el contrato definitivo dentro del plazo pactado.';

// Advertencia de la Ley de Inquilinato (punto 2.2).
export const AVISO_LEY_INQUILINATO =
  'El arrendamiento de inmuebles urbanos destinados a vivienda se rige por la Ley de Inquilinato, que contiene normas imperativas sobre plazo mínimo, causales de terminación y registro del contrato. Las partes y el agente deberán verificar el registro del contrato ante la Oficina de Inquilinato del cantón correspondiente cuando ello sea exigible.';

// Deslinde de la plataforma (punto 0.5).
export const AVISO_REDINMO_NO_ES_PARTE =
  'Redinmo no es parte de este contrato, no lo redacta a medida, no presta asesoría legal y no garantiza su idoneidad para el caso concreto. La responsabilidad por el contenido y por su suscripción corresponde exclusivamente a las partes.';

export type CampoTipo = 'texto' | 'cedula' | 'correo' | 'telefono' | 'numero' | 'dinero' | 'porcentaje' | 'fecha' | 'opcion' | 'multiple' | 'area';

export type CampoDefinicion = {
  clave: string;
  etiqueta: string;
  tipo: CampoTipo;
  obligatorio?: boolean;
  // Valor por defecto sensato (punto 1.4). Siempre editable.
  porDefecto?: string;
  opciones?: Array<{ valor: string; etiqueta: string }>;
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

const SI_NO = [
  { valor: 'SI', etiqueta: 'Sí' },
  { valor: 'NO', etiqueta: 'No' },
];

// El correo de cada parte es OBLIGATORIO en los cuatro tipos: es el canal por
// el que viaja el enlace de firma, sin el no hay documento que firmar.
function parte(rol: string, titulo: string, opciones: { estadoCivil?: boolean; direccion?: boolean; correo?: boolean } = {}): SeccionDefinicion {
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

// ---------------------------------------------------------------------------
// Definicion de campos por tipo (punto 2). Todo lo que el sistema ya sabe -
// agente e inmueble - se autocompleta y NO aparece aca: este es solo lo que
// hay que preguntar (punto 1.2).
// ---------------------------------------------------------------------------
export const CONTRATO_DEFINICION: Record<
  ContratoTipo,
  { titulo: string; descripcion: string; nombreDocumento: string; requiereInmueble: boolean; secciones: SeccionDefinicion[] }
> = {
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
          {
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
          },
          { clave: 'precioSalida', etiqueta: 'Precio de salida acordado', tipo: 'dinero', obligatorio: true },
          {
            clave: 'comisionPorcentaje',
            etiqueta: 'Comisión (%)',
            tipo: 'porcentaje',
            obligatorio: true,
            porDefecto: '3',
            ayuda: 'Habitual: 3% en venta. En arriendo suele pactarse un canon.',
          },
          {
            clave: 'comisionBase',
            etiqueta: 'La comisión se calcula sobre',
            tipo: 'opcion',
            porDefecto: 'PRECIO_VENTA',
            opciones: [
              { valor: 'PRECIO_VENTA', etiqueta: 'El precio final de venta' },
              { valor: 'PRECIO_SALIDA', etiqueta: 'El precio de salida' },
              { valor: 'UN_CANON', etiqueta: 'Un canon de arrendamiento' },
            ],
          },
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

  ARRENDAMIENTO: {
    titulo: 'Contrato de arrendamiento',
    descripcion: 'Arriendo de un inmueble con canon y plazo pactados.',
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
          { clave: 'diaPago', etiqueta: 'Día de pago de cada mes', tipo: 'numero', porDefecto: '5' },
          { clave: 'cuentaBancaria', etiqueta: 'Cuenta bancaria para el pago', tipo: 'texto' },
          { clave: 'plazoMeses', etiqueta: 'Plazo (meses)', tipo: 'numero', obligatorio: true, porDefecto: '12' },
          { clave: 'fechaInicio', etiqueta: 'Fecha de inicio', tipo: 'fecha', obligatorio: true },
          { clave: 'garantia', etiqueta: 'Garantía o depósito', tipo: 'dinero', porDefecto: '' },
          {
            clave: 'garantiaDevolucion',
            etiqueta: 'Condiciones de devolución de la garantía',
            tipo: 'area',
            porDefecto: 'Se devolverá dentro de los quince días siguientes a la entrega del inmueble, descontando los valores por daños o servicios pendientes.',
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
          { clave: 'formaPago', etiqueta: 'Forma de pago', tipo: 'texto', porDefecto: 'Transferencia bancaria' },
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
            tipo: 'opcion',
            // Sin default a proposito (punto 2.3): es la clausula que mas
            // conflictos genera y el agente tiene que elegirla conscientemente.
            obligatorio: true,
            opciones: [
              { valor: 'DEVOLUCION_TOTAL', etiqueta: 'Se devuelve en su totalidad' },
              { valor: 'DEVOLUCION_PARCIAL', etiqueta: 'Se devuelve parcialmente' },
              { valor: 'SE_PIERDE', etiqueta: 'Se pierde a favor del arrendador' },
            ],
            ayuda: 'Elige explícitamente: no hay valor por defecto para esta cláusula.',
          },
          { clave: 'devolucionParcialDetalle', etiqueta: 'Detalle de la devolución parcial', tipo: 'texto' },
        ],
      },
    ],
  },

  RESERVA_COMPRAVENTA: {
    titulo: 'Reserva de compraventa',
    descripcion: 'Reserva de un inmueble mientras se prepara la escritura pública.',
    nombreDocumento: 'RESERVA DE COMPRAVENTA',
    requiereInmueble: true,
    secciones: [
      parte('comprador', 'Datos del comprador', { estadoCivil: true }),
      parte('vendedor', 'Datos del vendedor', { estadoCivil: true }),
      {
        clave: 'reserva',
        titulo: 'Condiciones de la reserva',
        campos: [
          { clave: 'precioTotal', etiqueta: 'Precio total acordado', tipo: 'dinero', obligatorio: true },
          { clave: 'montoReserva', etiqueta: 'Monto de la reserva', tipo: 'dinero', obligatorio: true },
          { clave: 'formaPago', etiqueta: 'Forma de pago de la reserva', tipo: 'texto', porDefecto: 'Transferencia bancaria' },
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
          { clave: 'entidadFinanciera', etiqueta: 'Entidad financiera (si hay crédito)', tipo: 'texto' },
          { clave: 'plazoEscrituraDias', etiqueta: 'Plazo para suscribir la escritura pública (días)', tipo: 'numero', obligatorio: true, porDefecto: '60' },
          {
            clave: 'gastosNotariales',
            etiqueta: 'Gastos notariales y de registro a cargo de',
            tipo: 'opcion',
            porDefecto: 'COMPRADOR',
            opciones: [
              { valor: 'COMPRADOR', etiqueta: 'El comprador' },
              { valor: 'VENDEDOR', etiqueta: 'El vendedor' },
              { valor: 'COMPARTIDOS', etiqueta: 'Compartidos en partes iguales' },
            ],
          },
          {
            clave: 'siDesiste',
            etiqueta: 'Si alguna parte desiste',
            tipo: 'area',
            obligatorio: true,
            porDefecto:
              'Si el comprador desiste, perderá el valor de la reserva a favor del vendedor. Si el vendedor desiste, devolverá al comprador el doble del valor recibido.',
          },
        ],
      },
    ],
  },
};

// Roles firmantes por tipo, en el orden en que aparecen en el documento. El
// agente NO firma: es corredor, no parte, salvo en el corretaje donde si lo es.
export const FIRMANTES_POR_TIPO: Record<ContratoTipo, Array<{ rol: string; etiqueta: string; esAgente?: boolean }>> = {
  CORRETAJE: [
    { rol: 'propietario', etiqueta: 'Propietario' },
    { rol: 'agente', etiqueta: 'Agente corredor', esAgente: true },
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
    { rol: 'comprador', etiqueta: 'Comprador' },
    { rol: 'vendedor', etiqueta: 'Vendedor' },
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

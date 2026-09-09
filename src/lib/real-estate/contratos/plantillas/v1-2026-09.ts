// ===========================================================================
// PLANTILLAS DE CONTRATO — VERSIÓN v1-2026-09
//
// ⚠️  PROPUESTA PENDIENTE DE REVISIÓN LEGAL  ⚠️
//
// Este archivo es un BORRADOR redactado como punto de partida. NO ha sido
// revisado por un abogado habilitado en Ecuador y NO debe publicarse como
// definitivo. Antes de habilitarlo para agentes reales debe pasar por revisión
// profesional, en particular:
//   - Contrato de arrendamiento: contraste con la Ley de Inquilinato vigente
//     (plazo mínimo, causales de terminación, registro municipal).
//   - Reserva de compraventa: verificar que la redacción no configure una
//     promesa de compraventa, que exigiría escritura pública.
//   - Contrato de corretaje: causa de devengo de la comisión y su exigibilidad
//     en caso de venta directa durante la exclusividad.
//
// POR QUÉ ESTÁ EN UN ARCHIVO VERSIONADO Y NO EN UN COMPONENTE (punto 5.1):
// el texto legal cambia sin que cambie la aplicación. Cada documento generado
// guarda la VERSION que uso, de modo que si mañana se publica v2, los
// contratos ya firmados siguen mostrando exactamente el texto que las partes
// aceptaron (punto 5.2). Nunca se edita una version publicada: se crea otra.
// ===========================================================================

import {
  AVISO_LEY_INQUILINATO,
  AVISO_RESERVA_NO_ES_PROMESA,
  type ContratoTipo,
} from '../tipos';

export const PLANTILLA_VERSION = 'v1-2026-09';

// Marca visible en el documento mientras la version no tenga revision legal.
// Se quita cambiando esta bandera, no borrando texto de las clausulas.
export const PLANTILLA_REVISADA_POR_ABOGADO = false;

export const AVISO_PLANTILLA_SIN_REVISAR =
  'PLANTILLA EN REVISIÓN. El texto de este documento es una propuesta que aún no ha sido validada por un profesional del derecho. Revíselo con su abogado antes de suscribirlo.';

// Un bloque del documento. "clausula" numera automaticamente; "titulo",
// "parrafo" y "aviso" no.
export type BloqueDocumento =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'clausula'; titulo: string; texto: string }
  | { tipo: 'aviso'; texto: string }
  | { tipo: 'firmas' };

// Datos ya resueltos que la plantilla consume. La plantilla NO conoce Prisma
// ni el formulario: recibe strings listos para imprimir.
export type DatosDocumento = {
  ciudad: string;
  fechaLarga: string;
  agente: { nombre: string; cedula: string; ruc: string | null; direccion: string; telefono: string; correo: string };
  inmueble: { descripcion: string; ubicacion: string; caracteristicas: string };
  // Los campos del formulario, ya normalizados a texto legible.
  campo: (clave: string) => string;
  dinero: (clave: string) => string;
  // Etiqueta legible de un campo de opcion.
  opcion: (clave: string) => string;
  lista: (clave: string) => string[];
};

// Las etiquetas de opcion empiezan con articulo ('El comprador'), y al
// insertarlas tras una preposicion sale 'de el comprador'. Se contrae.
function contraer(preposicion: 'de' | 'a', frase: string): string {
  const texto = frase.trim().toLowerCase();
  if (preposicion === 'de' && texto.startsWith('el ')) return `del ${texto.slice(3)}`;
  if (preposicion === 'a' && texto.startsWith('el ')) return `al ${texto.slice(3)}`;
  return `${preposicion} ${texto}`;
}

function comparecientes(d: DatosDocumento, partes: Array<{ rol: string; titulo: string }>): BloqueDocumento[] {
  const bloques: BloqueDocumento[] = [{ tipo: 'subtitulo', texto: 'COMPARECIENTES' }];
  for (const p of partes) {
    const nombre = d.campo(`${p.rol}_nombre`);
    const cedula = d.campo(`${p.rol}_cedula`);
    const direccion = d.campo(`${p.rol}_direccion`);
    const estadoCivil = d.campo(`${p.rol}_estadoCivil`);
    const detalle = [
      estadoCivil ? `de estado civil ${estadoCivil}` : null,
      `titular de la cédula/RUC N.º ${cedula}`,
      direccion ? `con domicilio en ${direccion}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    bloques.push({
      tipo: 'parrafo',
      texto: `${p.titulo.toUpperCase()}: ${nombre}, ${detalle}, en adelante "${p.titulo}".`,
    });
  }
  return bloques;
}

function agenteCompareciente(d: DatosDocumento, etiqueta = 'EL AGENTE'): BloqueDocumento {
  const ruc = d.agente.ruc ? ` y RUC N.º ${d.agente.ruc}` : '';
  return {
    tipo: 'parrafo',
    texto: `${etiqueta}: ${d.agente.nombre}, titular de la cédula N.º ${d.agente.cedula}${ruc}, con oficina en ${d.agente.direccion}, en adelante "el Agente".`,
  };
}

function inmuebleAntecedente(d: DatosDocumento): BloqueDocumento {
  return {
    tipo: 'parrafo',
    texto: `El inmueble objeto de este contrato es: ${d.inmueble.descripcion}, ubicado en ${d.inmueble.ubicacion}. ${d.inmueble.caracteristicas}`.trim(),
  };
}

function jurisdiccion(d: DatosDocumento): BloqueDocumento[] {
  return [
    {
      tipo: 'clausula',
      titulo: 'NOTIFICACIONES',
      texto: `Las partes señalan como direcciones para notificaciones las indicadas en la comparecencia y los correos electrónicos consignados en la constancia de firma de este documento. Cualquier cambio deberá comunicarse por escrito.`,
    },
    {
      tipo: 'clausula',
      titulo: 'DOMICILIO Y JURISDICCIÓN',
      texto: `Para todos los efectos de este contrato las partes se someten a la jurisdicción de los jueces competentes de ${d.ciudad}, renunciando a fuero y domicilio distintos, y a los procedimientos previstos en la legislación ecuatoriana.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// 1. CORRETAJE
// ---------------------------------------------------------------------------
function corretaje(d: DatosDocumento): BloqueDocumento[] {
  const objeto = d.opcion('objeto').toLowerCase();
  const exclusiva = d.campo('exclusividad') === 'SI';
  const facultades = d.lista('facultades');

  return [
    { tipo: 'titulo', texto: 'CONTRATO DE CORRETAJE INMOBILIARIO' },
    ...comparecientes(d, [{ rol: 'propietario', titulo: 'El Propietario' }]),
    agenteCompareciente(d),
    { tipo: 'subtitulo', texto: 'ANTECEDENTES' },
    inmuebleAntecedente(d),
    {
      tipo: 'parrafo',
      texto: `El Propietario declara ser titular del derecho de dominio sobre el inmueble descrito y encontrarse facultado para autorizar su ${objeto}.`,
    },
    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },
    {
      tipo: 'clausula',
      titulo: 'OBJETO',
      texto: `El Propietario encarga al Agente la gestión de corretaje para la ${objeto} del inmueble descrito, por un precio de salida de ${d.dinero('precioSalida')}. El Agente actuará como intermediario y no adquiere la calidad de parte en el negocio que llegue a celebrarse.`,
    },
    {
      tipo: 'clausula',
      titulo: 'COMISIÓN Y CAUSA DE DEVENGO',
      texto: `Las partes pactan una comisión del ${d.campo('comisionPorcentaje')}% calculada sobre ${d.opcion('comisionBase').toLowerCase()}. La comisión se devenga cuando, por gestión del Agente, se perfeccione el negocio encargado o se suscriba el instrumento que lo formalice, aun cuando el pago del precio se difiera en el tiempo. La comisión se pagará contra la suscripción del referido instrumento.`,
    },
    exclusiva
      ? {
          tipo: 'clausula' as const,
          titulo: 'EXCLUSIVIDAD',
          texto: `El Propietario otorga al Agente exclusividad por ${d.campo('exclusividadMeses')} meses contados desde la suscripción. Durante ese plazo el Propietario se abstendrá de encargar la misma gestión a terceros. Si durante la vigencia de la exclusividad el Propietario celebra directamente el negocio con un interesado presentado por el Agente, o gestionado por éste, la comisión pactada se devengará íntegramente a favor del Agente.`,
        }
      : {
          tipo: 'clausula' as const,
          titulo: 'AUSENCIA DE EXCLUSIVIDAD',
          texto: `Este encargo se otorga sin exclusividad. El Propietario podrá encargar la misma gestión a terceros. La comisión se devengará únicamente a favor del agente cuya gestión sea causa determinante del negocio celebrado.`,
        },
    {
      tipo: 'clausula',
      titulo: 'FACULTADES DEL AGENTE',
      texto:
        facultades.length > 0
          ? `El Propietario autoriza expresamente al Agente a: ${facultades.map((f) => f.toLowerCase()).join('; ')}. Cualquier actuación distinta requerirá autorización previa por escrito.`
          : `El Agente ejercerá únicamente las gestiones que el Propietario autorice previamente y por escrito.`,
    },
    {
      tipo: 'clausula',
      titulo: 'GASTOS DE PROMOCIÓN',
      texto: `Los gastos de promoción y publicidad del inmueble estarán a cargo ${contraer('de', d.opcion('gastosPromocion'))}.`,
    },
    {
      tipo: 'clausula',
      titulo: 'OBLIGACIONES DEL PROPIETARIO',
      texto: `El Propietario se obliga a entregar información veraz y completa sobre el inmueble y su situación jurídica, a facilitar las visitas coordinadas por el Agente y a comunicarle de inmediato cualquier negociación directa que emprenda respecto del inmueble.`,
    },
    {
      tipo: 'clausula',
      titulo: 'VIGENCIA Y TERMINACIÓN ANTICIPADA',
      texto: `Este contrato tendrá una vigencia de ${d.campo('vigenciaMeses')} meses contados desde su suscripción. Cualquiera de las partes podrá darlo por terminado anticipadamente mediante comunicación escrita con quince días de anticipación, sin perjuicio del derecho del Agente a percibir la comisión respecto de los negocios cuya causa determinante haya sido su gestión anterior a la terminación.`,
    },
    ...jurisdiccion(d),
    { tipo: 'firmas' },
  ];
}

// ---------------------------------------------------------------------------
// 2. ARRENDAMIENTO
// ---------------------------------------------------------------------------
function arrendamiento(d: DatosDocumento): BloqueDocumento[] {
  const destino = d.opcion('destino').toLowerCase();
  const amoblado = d.campo('amoblado') === 'SI';
  const reajuste = d.campo('reajuste') === 'SI';

  const bloques: BloqueDocumento[] = [
    { tipo: 'titulo', texto: 'CONTRATO DE ARRENDAMIENTO' },
    ...comparecientes(d, [
      { rol: 'arrendador', titulo: 'El Arrendador' },
      { rol: 'arrendatario', titulo: 'El Arrendatario' },
    ]),
    { tipo: 'subtitulo', texto: 'ANTECEDENTES' },
    inmuebleAntecedente(d),
    {
      tipo: 'parrafo',
      texto: `El Arrendador declara estar facultado para dar en arrendamiento el inmueble descrito y el Arrendatario declara conocerlo y recibirlo a su entera satisfacción.`,
    },
    { tipo: 'aviso', texto: AVISO_LEY_INQUILINATO },
    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },
    {
      tipo: 'clausula',
      titulo: 'OBJETO Y DESTINO',
      texto: `El Arrendador da en arrendamiento al Arrendatario el inmueble descrito, que se destinará exclusivamente a ${destino}. El Arrendatario no podrá cambiar su destino ni subarrendarlo sin autorización escrita del Arrendador.`,
    },
    {
      tipo: 'clausula',
      titulo: 'CANON Y FORMA DE PAGO',
      texto: `El canon mensual de arrendamiento es de ${d.dinero('canon')}, pagadero por mensualidades anticipadas hasta el día ${d.campo('diaPago')} de cada mes.${
        d.campo('cuentaBancaria') ? ` El pago se realizará mediante depósito o transferencia a: ${d.campo('cuentaBancaria')}.` : ''
      }`,
    },
    {
      tipo: 'clausula',
      titulo: 'PLAZO',
      texto: `El plazo del arrendamiento es de ${d.campo('plazoMeses')} meses contados desde el ${d.campo('fechaInicio')}. Su terminación y eventual renovación se sujetan a las normas imperativas de la Ley de Inquilinato en lo que resulten aplicables.`,
    },
  ];

  if (d.campo('garantia')) {
    bloques.push({
      tipo: 'clausula',
      titulo: 'GARANTÍA',
      texto: `El Arrendatario entrega en este acto la suma de ${d.dinero('garantia')} en calidad de garantía. ${d.campo('garantiaDevolucion')}`,
    });
  }

  bloques.push(
    {
      tipo: 'clausula',
      titulo: 'SERVICIOS Y ALÍCUOTA',
      texto: `Los servicios básicos del inmueble estarán a cargo ${contraer('de', d.opcion('serviciosACargo'))}. La alícuota de condominio, cuando corresponda, estará a cargo ${contraer('de', d.opcion('alicuotaACargo'))}.`,
    },
    {
      tipo: 'clausula',
      titulo: 'ESTADO Y CONSERVACIÓN',
      texto: `El Arrendatario recibe el inmueble en buen estado y se obliga a conservarlo, a realizar las reparaciones locativas y a restituirlo en el mismo estado, salvo el deterioro natural por el uso legítimo.${
        amoblado ? ` El inmueble se entrega amoblado conforme al inventario que forma parte integrante de este contrato.` : ''
      }`,
    },
  );

  if (amoblado && d.campo('inventarioBienes')) {
    bloques.push({
      tipo: 'clausula',
      titulo: 'INVENTARIO DE BIENES',
      texto: d.campo('inventarioBienes'),
    });
  }

  bloques.push({
    tipo: 'clausula',
    titulo: 'REAJUSTE DEL CANON',
    texto: reajuste
      ? `Las partes pactan el reajuste del canon conforme al siguiente criterio: ${d.campo('reajusteCriterio')}, dentro de los límites que establezca la ley.`
      : `Las partes no pactan reajuste del canon durante el plazo inicial de este contrato.`,
  });

  bloques.push(
    {
      tipo: 'clausula',
      titulo: 'TERMINACIÓN',
      texto: `Este contrato terminará por las causales previstas en la Ley de Inquilinato y en el Código Civil, así como por mutuo acuerdo de las partes expresado por escrito. La mora en el pago de dos o más pensiones de arrendamiento faculta al Arrendador a exigir la terminación en la forma prevista por la ley.`,
    },
    {
      tipo: 'clausula',
      titulo: 'INTERVENCIÓN DEL AGENTE',
      texto: `${d.agente.nombre} intervino como agente inmobiliario en la gestión que dio origen a este contrato. El Agente no es parte del presente contrato ni asume obligación alguna derivada de él.`,
    },
    ...jurisdiccion(d),
    { tipo: 'firmas' },
  );

  return bloques;
}

// ---------------------------------------------------------------------------
// 3. RESERVA DE ARRENDAMIENTO
// ---------------------------------------------------------------------------
function reservaArriendo(d: DatosDocumento): BloqueDocumento[] {
  const destinoValor = d.campo('destinoValor') === 'GARANTIA' ? 'la garantía o depósito' : 'el primer canon de arrendamiento';
  const siNo = d.campo('siNoSeConcreta');
  const consecuencia =
    siNo === 'DEVOLUCION_TOTAL'
      ? 'el valor entregado será devuelto al Interesado en su totalidad, dentro de los cinco días hábiles siguientes.'
      : siNo === 'SE_PIERDE'
        ? 'el valor entregado quedará en favor del arrendador en concepto de indemnización por la indisponibilidad del inmueble.'
        : `el valor entregado será devuelto parcialmente conforme a lo siguiente: ${d.campo('devolucionParcialDetalle') || 'según lo que las partes acuerden por escrito'}.`;

  return [
    { tipo: 'titulo', texto: 'RESERVA DE ARRENDAMIENTO' },
    ...comparecientes(d, [{ rol: 'interesado', titulo: 'El Interesado' }]),
    agenteCompareciente(d),
    { tipo: 'subtitulo', texto: 'ANTECEDENTES' },
    inmuebleAntecedente(d),
    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },
    {
      tipo: 'clausula',
      titulo: 'OBJETO',
      texto: `El Interesado manifiesta su voluntad de arrendar el inmueble descrito y entrega la suma de ${d.dinero('montoReserva')} a fin de que el inmueble sea reservado a su favor y retirado temporalmente de la oferta.`,
    },
    {
      tipo: 'clausula',
      titulo: 'FORMA DE PAGO Y PLAZO',
      texto: `El valor de la reserva se paga mediante ${d.campo('formaPago').toLowerCase()}. La reserva tendrá una vigencia de ${d.campo('plazoDias')} días calendario contados desde la suscripción de este documento.`,
    },
    {
      tipo: 'clausula',
      titulo: 'CONDICIONES PARA LA SUSCRIPCIÓN DEL ARRENDAMIENTO',
      texto: `Dentro del plazo señalado deberán cumplirse las siguientes condiciones para la suscripción del contrato de arrendamiento: ${d.campo('condiciones')}`,
    },
    {
      tipo: 'clausula',
      titulo: 'IMPUTACIÓN DEL VALOR',
      texto: `Suscrito el contrato de arrendamiento, el valor entregado se imputará a ${destinoValor}.`,
    },
    {
      tipo: 'clausula',
      titulo: 'SI EL ARRENDAMIENTO NO SE CONCRETA',
      texto: `Si dentro del plazo de la reserva no se suscribe el contrato de arrendamiento, ${consecuencia}`,
    },
    {
      tipo: 'clausula',
      titulo: 'NATURALEZA DE ESTE DOCUMENTO',
      texto: `Este documento constituye una reserva y no un contrato de arrendamiento. Los derechos y obligaciones propios del arrendamiento nacerán únicamente con la suscripción del contrato respectivo.`,
    },
    ...jurisdiccion(d),
    { tipo: 'firmas' },
  ];
}

// ---------------------------------------------------------------------------
// 4. RESERVA DE COMPRAVENTA
// ---------------------------------------------------------------------------
function reservaCompraventa(d: DatosDocumento): BloqueDocumento[] {
  const saldo = d.opcion('formaPagoSaldo').toLowerCase();
  const entidad = d.campo('entidadFinanciera');

  return [
    { tipo: 'titulo', texto: 'RESERVA DE COMPRAVENTA' },
    // La advertencia va ARRIBA, antes de las clausulas: es lo primero que
    // tiene que leer quien firma, no una nota al final (puntos 0.3 y 2.4).
    { tipo: 'aviso', texto: AVISO_RESERVA_NO_ES_PROMESA },
    ...comparecientes(d, [
      { rol: 'vendedor', titulo: 'El Vendedor' },
      { rol: 'comprador', titulo: 'El Comprador' },
    ]),
    { tipo: 'subtitulo', texto: 'ANTECEDENTES' },
    inmuebleAntecedente(d),
    {
      tipo: 'parrafo',
      texto: `El Vendedor declara ser titular del derecho de dominio sobre el inmueble y que éste se encuentra libre de gravámenes que impidan su enajenación, salvo los que se declaren expresamente por escrito antes de la suscripción de la escritura pública.`,
    },
    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },
    {
      tipo: 'clausula',
      titulo: 'OBJETO',
      texto: `Las partes acuerdan reservar el inmueble descrito a favor del Comprador por el precio total de ${d.dinero('precioTotal')}, con el fin de preparar y suscribir la escritura pública de compraventa.`,
    },
    {
      tipo: 'clausula',
      titulo: 'VALOR DE LA RESERVA',
      texto: `El Comprador entrega en este acto la suma de ${d.dinero('montoReserva')} mediante ${d.campo('formaPago').toLowerCase()}, valor que se imputará al precio total al momento de la suscripción de la escritura pública.`,
    },
    {
      tipo: 'clausula',
      titulo: 'PLAZO DE LA RESERVA',
      texto: `La reserva tendrá una vigencia de ${d.campo('plazoDias')} días calendario contados desde la suscripción de este documento.`,
    },
    {
      tipo: 'clausula',
      titulo: 'FORMA DE PAGO DEL SALDO',
      texto: `El saldo del precio se pagará de la siguiente manera: ${saldo}.${
        entidad ? ` El crédito será tramitado ante ${entidad}.` : ''
      } Las partes dejan constancia de que la aprobación del financiamiento no depende de la voluntad de ninguna de ellas.`,
    },
    {
      tipo: 'clausula',
      titulo: 'SUSCRIPCIÓN DE LA ESCRITURA PÚBLICA',
      texto: `Las partes se obligan a suscribir la escritura pública de compraventa dentro de los ${d.campo('plazoEscrituraDias')} días calendario siguientes a la suscripción de este documento. La minuta será elaborada por el profesional del derecho que las partes designen.`,
    },
    {
      tipo: 'clausula',
      titulo: 'GASTOS',
      texto: `Los gastos notariales, de registro e impuestos que genere la transferencia de dominio estarán a cargo ${contraer('de', d.opcion('gastosNotariales'))}, salvo aquellos que la ley imponga expresamente a una de las partes.`,
    },
    {
      tipo: 'clausula',
      titulo: 'DESISTIMIENTO',
      texto: d.campo('siDesiste'),
    },
    {
      tipo: 'clausula',
      titulo: 'NATURALEZA DE ESTE DOCUMENTO',
      texto: AVISO_RESERVA_NO_ES_PROMESA,
    },
    ...jurisdiccion(d),
    { tipo: 'firmas' },
  ];
}

const CONSTRUCTORES: Record<ContratoTipo, (d: DatosDocumento) => BloqueDocumento[]> = {
  CORRETAJE: corretaje,
  ARRENDAMIENTO: arrendamiento,
  RESERVA_ARRIENDO: reservaArriendo,
  RESERVA_COMPRAVENTA: reservaCompraventa,
};

export function construirBloques(tipo: ContratoTipo, datos: DatosDocumento): BloqueDocumento[] {
  return CONSTRUCTORES[tipo](datos);
}

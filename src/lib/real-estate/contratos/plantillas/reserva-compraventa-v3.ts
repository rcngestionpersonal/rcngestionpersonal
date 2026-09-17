// ===========================================================================
// RESERVA DE COMPRAVENTA DE BIEN INMUEBLE — v3-2026-09
//
// ⚠️  PENDIENTE DE REVISIÓN LEGAL  ⚠️  (igual que la v2)
//
// Es la v2, que se retiró el 2026-09-11 y vuelve a ofrecerse, con los cambios
// indispensables para el módulo actual y ninguno de fondo:
//
//   - Cada cláusula tiene clave, para el editor de cláusulas; las referencias
//     "la cláusula de objeto" o "de penalidad" pasan a su número, que se
//     recalcula solo.
//   - Las partes pueden ser compañías con su representante legal, y el
//     corredor puede comparecer por su empresa.
//   - Las notificaciones ya no remiten a la "constancia de firma", que no
//     existe: van a los domicilios y correos de la comparecencia.
//
// Sigue sin número de cuenta, entidad ni titular, y la penalidad sigue
// derivándose de quién tiene el dinero.
// ===========================================================================

import {
  aceptacionYRatificacion,
  comparecenciaParte,
  contraer,
  opcional,
  proteccionDatos,
  type BloqueDocumento,
  type DatosDocumento,
} from './base';

export const PLANTILLA_VERSION = 'reserva-compraventa-v3-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = false;
export const AVISO_PLANTILLA_SIN_REVISAR =
  'PLANTILLA EN REVISIÓN. El texto de este documento es una propuesta que aún no ha sido validada por un profesional del derecho. Revíselo con su abogado antes de suscribirlo.';

// Advertencia de la v2, que va arriba del documento: es lo primero que tiene
// que leer quien lo revisa.
const AVISO_RESERVA_NO_ES_PROMESA =
  'Este instrumento constituye una RESERVA y no una promesa de compraventa. Conforme a la legislación ecuatoriana, la promesa de compraventa de bienes inmuebles requiere escritura pública. Las partes deberán elevar a escritura pública el contrato definitivo dentro del plazo pactado.';

type Tenedor = 'VENDEDOR' | 'CORREDOR';

// Quien devuelve es siempre quien tiene el dinero en la mano.
function siDesisteLaCompradora(d: DatosDocumento, tenedor: Tenedor, plazo: string): string {
  const laTiene = tenedor === 'CORREDOR' ? 'el Corredor' : 'la Parte Vendedora';
  const detalle = d.campo('siDesisteCompradorDetalle') || 'según lo que las Partes acuerden por escrito';

  switch (d.campo('siDesisteComprador')) {
    case 'DEVOLUCION_TOTAL':
      return `Si la Parte Compradora decide no continuar con la adquisición, ${laTiene} le devolverá íntegramente el valor de la reserva dentro de los ${plazo} días hábiles siguientes.`;
    case 'DEVOLUCION_PARCIAL':
      return tenedor === 'CORREDOR'
        ? `Si la Parte Compradora decide no continuar con la adquisición, el Corredor le devolverá parcialmente el valor de la reserva, conforme a lo siguiente: ${detalle}, dentro de los ${plazo} días hábiles siguientes, y entregará el saldo a la Parte Vendedora en el mismo plazo.`
        : `Si la Parte Compradora decide no continuar con la adquisición, la Parte Vendedora le devolverá parcialmente el valor de la reserva, conforme a lo siguiente: ${detalle}, dentro de los ${plazo} días hábiles siguientes, y conservará el saldo a su favor.`;
    case 'SE_PIERDE':
      return tenedor === 'CORREDOR'
        ? `Si la Parte Compradora decide no continuar con la adquisición, el valor entregado en calidad de reserva no le será reembolsable, y el Corredor lo entregará a la Parte Vendedora dentro de los ${plazo} días hábiles siguientes.`
        : 'Si la Parte Compradora decide no continuar con la adquisición, el valor entregado en calidad de reserva no le será reembolsable y quedará definitivamente a favor de la Parte Vendedora, que ya lo tiene en su poder, sin que deba realizarse desembolso alguno.';
    default:
      return `Si la Parte Compradora decide no continuar con la adquisición, ${opcional('')}.`;
  }
}

function siDesisteLaVendedora(d: DatosDocumento, tenedor: Tenedor, plazo: string): string {
  const laTiene = tenedor === 'CORREDOR' ? 'el Corredor' : 'la Parte Vendedora';
  const eleccion = d.campo('siDesisteVendedor');

  if (eleccion === 'DEVUELVE_SIMPLE') {
    const sujeto = tenedor === 'CORREDOR' ? `${laTiene} devolverá` : 'devolverá';
    return `Si la Parte Vendedora decide voluntariamente no continuar con la venta, ${sujeto} a la Parte Compradora el valor íntegro de la reserva dentro de los ${plazo} días hábiles siguientes, sin recargo alguno.`;
  }
  if (eleccion !== 'DEVUELVE_DOBLE') {
    return `Si la Parte Vendedora decide voluntariamente no continuar con la venta, ${opcional('')}.`;
  }
  // Se imprime la cifra de la indemnización, para que nadie tenga que
  // calcularla el día que haya que pagarla.
  const indemnizacion = d.dinero('montoReserva');
  return tenedor === 'CORREDOR'
    ? `Si la Parte Vendedora decide voluntariamente no continuar con la venta, el Corredor devolverá a la Parte Compradora el valor de la reserva dentro de los ${plazo} días hábiles siguientes, y la Parte Vendedora le pagará directamente, en el mismo plazo, una suma equivalente al mismo monto, esto es ${indemnizacion}, en concepto de indemnización.`
    : `Si la Parte Vendedora decide voluntariamente no continuar con la venta, devolverá a la Parte Compradora el valor de la reserva y le pagará además una suma equivalente al mismo monto, esto es ${indemnizacion}, en concepto de indemnización, todo ello dentro de los ${plazo} días hábiles siguientes.`;
}

// El estado civil se imprime solo para personas: una compañía no lo tiene.
function calificacion(d: DatosDocumento, rol: string): string {
  const estadoCivil = d.campo(`${rol}_estadoCivil`);
  return !d.parte(rol).juridica && estadoCivil ? `de estado civil ${estadoCivil}` : '';
}

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const saldo = Math.max(0, d.numero('precioTotal') - d.numero('montoReserva'));
  const formaPago = d.opcion('formaPago').toLowerCase();
  const alCorredor = d.campo('reservaEntregadaA') === 'CORREDOR';
  const tenedorClave: Tenedor = alCorredor ? 'CORREDOR' : 'VENDEDOR';
  const tenedor = alCorredor ? 'el Corredor' : 'la Parte Vendedora';
  const plazoDevolucion = d.campo('plazoDevolucionDias') || '5';
  const representacion = d.campo('representacion');
  const tituloDominio = d.campo('tituloDominio');
  const predio = d.campo('predio');
  const entidad = d.campo('entidadFinanciera');
  const hayCredito = d.campo('formaPagoSaldo') === 'CREDITO' || d.campo('formaPagoSaldo') === 'MIXTO';

  return [
    { tipo: 'titulo', texto: 'CONTRATO DE RESERVA DE COMPRAVENTA DE BIEN INMUEBLE' },
    { tipo: 'aviso', texto: AVISO_RESERVA_NO_ES_PROMESA },

    {
      tipo: 'ficha',
      titulo: 'FICHA RESUMEN DE LA NEGOCIACIÓN',
      filas: [
        { etiqueta: 'Inmueble', valor: `${d.inmueble.descripcion}, ${d.inmueble.ubicacion}` },
        { etiqueta: 'Precio total', valor: d.dinero('precioTotal') },
        { etiqueta: 'Valor de la reserva', valor: `${d.dinero('montoReserva')} (imputable al precio)` },
        { etiqueta: 'La reserva queda en poder de', valor: tenedor },
        { etiqueta: 'Saldo', valor: d.dineroDe(saldo) },
        { etiqueta: 'Plazo de cierre', valor: `${d.campo('plazoEscrituraDias')} días calendario desde la suscripción` },
      ],
    },

    {
      tipo: 'parrafo',
      texto: `En ${d.ciudad}, a ${d.fechaLarga}, comparecen a la celebración del presente Contrato de Reserva de Compraventa las personas que se detallan a continuación, todas ellas legalmente capaces para contratar y obligarse, quienes de manera libre, voluntaria y sin vicio alguno del consentimiento convienen en suscribirlo al tenor de las siguientes cláusulas.`,
    },
    { tipo: 'subtitulo', texto: 'COMPARECIENTES' },
    { tipo: 'parrafo', texto: `LA PARTE VENDEDORA: ${comparecenciaParte(d, 'vendedor', 'la Parte Vendedora', calificacion(d, 'vendedor'))}.` },
    { tipo: 'parrafo', texto: `LA PARTE COMPRADORA: ${comparecenciaParte(d, 'comprador', 'la Parte Compradora', calificacion(d, 'comprador'))}.` },
    {
      tipo: 'parrafo',
      texto: `EL CORREDOR DE BIENES RAÍCES: ${comparecenciaParte(
        d,
        'corredor',
        'el Corredor',
        'en su calidad de corredor de bienes raíces y gestor de la negociación',
      )}, quien comparece únicamente para los efectos de las cláusulas sobre entrega del valor de la reserva, penalidad por desistimiento y protección de datos. Cuando se haga referencia conjunta a la Parte Vendedora y a la Parte Compradora se las denominará "las Partes".`,
    },

    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },

    {
      tipo: 'clausula',
      clave: 'antecedentes',
      titulo: 'ANTECEDENTES Y REPRESENTACIÓN',
      texto: [
        'La Parte Vendedora declara que es legítima propietaria del bien inmueble detallado en la cláusula {{ref:objeto}} y ha manifestado su voluntad de transferirlo a título de compraventa.',
        representacion ? `Representación: ${representacion}` : null,
        tituloDominio ? `La titularidad actual de la Parte Vendedora se acredita con: ${tituloDominio}` : null,
      ]
        .filter((f): f is string => Boolean(f))
        .map((f) => (/[.:;!?]$/.test(f.trim()) ? f.trim() : `${f.trim()}.`))
        .join(' '),
    },
    {
      tipo: 'clausula',
      clave: 'naturaleza',
      titulo: 'NATURALEZA JURÍDICA DEL CONTRATO',
      texto:
        'El presente instrumento constituye un contrato preparatorio de reserva, mediante el cual las Partes formalizan su voluntad de negociación y aseguran la exclusividad del inmueble a favor de la Parte Compradora durante el plazo pactado. No constituye, por sí mismo, promesa de compraventa, ni transfiere dominio alguno. Las Partes se obligan a celebrar la escritura pública de compraventa definitiva dentro del plazo señalado. Si resultare necesario suscribir previamente una promesa de compraventa, ésta deberá otorgarse por escritura pública, conforme a la ley.',
    },
    {
      tipo: 'clausula',
      clave: 'objeto',
      titulo: 'OBJETO DE LA RESERVA',
      texto: `El objeto del presente contrato es la reserva del siguiente bien inmueble: ${d.inmueble.descripcion}, ubicado en ${
        d.inmueble.ubicacion
      }${predio ? `, predio N.º ${predio}` : ''}. ${
        d.inmueble.caracteristicas
      } Los linderos, dimensiones y superficie son los que constan en el título de dominio vigente y serán reproducidos en la escritura pública definitiva. El inmueble se reserva y se venderá como cuerpo cierto, en el estado en que se encuentra, que la Parte Compradora declara conocer y aceptar, con todos sus usos, costumbres y servidumbres que por su naturaleza le corresponden.`.replace(
        /\s+/g,
        ' ',
      ),
    },
    {
      tipo: 'clausula',
      clave: 'precio',
      titulo: 'PRECIO, FORMA DE PAGO DEL SALDO Y PLAZO',
      texto: `El precio total pactado por el inmueble es de ${d.dinero('precioTotal')}. Imputado el valor de la reserva, el saldo asciende a ${d.dineroDe(
        saldo,
      )}, que la Parte Compradora pagará bajo la siguiente modalidad: ${d.opcion('formaPagoSaldo').toLowerCase()}.${
        hayCredito ? ` El crédito será tramitado ante ${entidad || 'la entidad financiera que la Parte Compradora designe'}.` : ''
      }${
        hayCredito ? ' Las Partes dejan constancia de que la aprobación del financiamiento no depende de la voluntad de ninguna de ellas.' : ''
      } El plazo para la suscripción de la escritura pública de compraventa definitiva y el pago del saldo total es de ${d.campo(
        'plazoEscrituraDias',
      )} días calendario contados desde la suscripción de este documento. Si el vencimiento recayere en día feriado o no laborable, se entenderá prorrogado hasta el siguiente día hábil. Si la escritura no pudiere otorgarse dentro del plazo por causas atribuibles a trámites administrativos, registrales o notariales no imputables a la voluntad de las Partes, el plazo podrá prorrogarse por hasta treinta (30) días calendario adicionales, mediante acuerdo escrito suscrito por ambas, sin que ello genere penalidad alguna.`,
    },
    {
      tipo: 'clausula',
      clave: 'entrega-reserva',
      titulo: 'ENTREGA Y RESPALDO DEL VALOR DE LA RESERVA',
      texto: `La Parte Compradora entrega ${alCorredor ? 'al Corredor' : 'a la Parte Vendedora'}, en calidad de reserva, la suma de ${d.dinero(
        'montoReserva',
      )}, imputable al precio, el ${d.campo(
        'fechaEntrega',
      )} mediante ${formaPago}. Las Partes dejan constancia de que el respaldo del pago es el comprobante emitido en la respectiva transacción, documento que cada parte conservará y que se considera parte integrante del presente instrumento. La entrega de los datos necesarios para efectuar el pago se realiza por canal separado entre las Partes y no forma parte de este documento.${
        alCorredor
          ? ' El Corredor conservará el valor recibido hasta el cierre de la operación o hasta que proceda su entrega o devolución conforme a la cláusula {{ref:penalidad}}.'
          : ''
      }`,
    },
    {
      tipo: 'clausula',
      clave: 'exclusividad',
      titulo: 'EXCLUSIVIDAD Y OBLIGACIONES DE LA PARTE VENDEDORA',
      texto:
        'Entregado el valor de la reserva, la Parte Vendedora se obliga, durante toda la vigencia de este contrato, a: suspender de manera inmediata toda publicidad, promoción, oferta, negociación y visita del inmueble con terceros, quedando éste reservado en forma exclusiva a favor de la Parte Compradora; abstenerse de gravar, hipotecar, arrendar, prometer en venta o enajenar el inmueble a favor de tercero alguno; mantener al día, hasta la fecha de entrega material, el pago de los servicios básicos y tributos que graven la propiedad; y concurrir oportunamente, por sí y en representación de sus poderdantes cuando corresponda, a la notaría designada para el otorgamiento de la escritura pública.',
    },
    {
      tipo: 'clausula',
      clave: 'declaraciones',
      titulo: 'DECLARACIONES Y GARANTÍAS DE LA PARTE VENDEDORA',
      texto:
        'La Parte Vendedora declara y garantiza a la Parte Compradora que: el inmueble le pertenece en legítimo dominio y se encuentra libre de hipotecas, embargos, prohibiciones de enajenar, patrimonio familiar, litigios pendientes, juicios coactivos o cualquier otro gravamen o limitación de dominio, salvo los que se declaren expresamente por escrito antes de la suscripción de la escritura pública; no existen obligaciones tributarias, municipales ni de servicios pendientes de pago que afecten al inmueble; el inmueble no se encuentra ocupado por terceros ni sujeto a contrato de arrendamiento, comodato o cualquier otro título que impida su entrega material libre de ocupantes; y no pesa sobre el inmueble ni sobre sus propietarios medida alguna dictada dentro de procesos de extinción de dominio, insolvencia o similares.',
    },
    {
      tipo: 'clausula',
      clave: 'penalidad',
      titulo: 'PENALIDAD POR DESISTIMIENTO',
      texto: [
        `Las Partes dejan constancia de que el valor de la reserva se encuentra en poder ${
          alCorredor ? 'del Corredor' : 'de la Parte Vendedora'
        }. Para el caso de desistimiento voluntario e injustificado se establece lo siguiente.`,
        siDesisteLaCompradora(d, tenedorClave, plazoDevolucion),
        siDesisteLaVendedora(d, tenedorClave, plazoDevolucion),
        alCorredor
          ? 'El Corredor conserva el valor de la reserva en calidad de simple depositario. Su obligación se limita a entregarlo o devolverlo en los términos de esta cláusula, hasta el monto efectivamente recibido, y no responde con su patrimonio por la indemnización que corresponda pagar a la Parte Vendedora ni por el cumplimiento de las demás obligaciones de las Partes.'
          : null,
      ]
        .filter(Boolean)
        .join(' '),
    },
    {
      tipo: 'clausula',
      clave: 'gastos',
      titulo: 'GASTOS E IMPUESTOS',
      texto: `Los honorarios notariales y los gastos de otorgamiento e inscripción de la escritura pública de compraventa, así como el impuesto de alcabalas y la tasa del Consejo Provincial, estarán a cargo ${contraer(
        'de',
        d.opcion('gastosNotariales'),
      )}. La Parte Vendedora asumirá el Impuesto a la Utilidad en la Transferencia de Predios Urbanos (plusvalía) y la Contribución Especial de Mejoras, conforme a la liquidación municipal correspondiente.`,
    },
    {
      tipo: 'clausula',
      clave: 'entrega-material',
      titulo: 'ENTREGA MATERIAL DEL INMUEBLE',
      texto:
        'La entrega material del inmueble, libre de ocupantes y de bienes ajenos a la negociación, se realizará el mismo día de la suscripción de la escritura pública de compraventa definitiva, salvo acuerdo escrito en contrario.',
    },
    { ...proteccionDatos('del Corredor'), clave: 'datos' } as BloqueDocumento,
    {
      tipo: 'clausula',
      clave: 'acuerdo',
      titulo: 'ACUERDO ÍNTEGRO Y MODIFICACIONES',
      texto:
        'Este documento contiene el acuerdo íntegro de las Partes sobre la reserva del inmueble y reemplaza a cualquier entendimiento anterior sobre la materia. Toda modificación deberá constar por escrito y ser aceptada por ambas Partes.',
    },
    {
      tipo: 'clausula',
      clave: 'notificaciones',
      titulo: 'NOTIFICACIONES',
      texto:
        'Las partes señalan como direcciones para notificaciones los domicilios y correos electrónicos indicados en la comparecencia. Cualquier cambio deberá comunicarse por escrito.',
    },
    {
      tipo: 'clausula',
      clave: 'jurisdiccion',
      titulo: 'DOMICILIO Y JURISDICCIÓN',
      texto: `Para todos los efectos de este contrato las partes se someten a la jurisdicción de los jueces competentes de ${d.ciudad}, renunciando a fuero y domicilio distintos, y a los procedimientos previstos en la legislación ecuatoriana.`,
    },
    { ...aceptacionYRatificacion(d.ciudad), clave: 'aceptacion' } as BloqueDocumento,
    { tipo: 'firmas' },
  ];
}

// ===========================================================================
// RESERVA DE ARRENDAMIENTO — v2-2026-09
//
// ⚠️  PENDIENTE DE REVISIÓN LEGAL  ⚠️
//
// Es la v1 con un solo cambio de fondo (punto 2): la cláusula de forma de pago
// pasa a consignar monto, forma de pago y fecha de entrega, y remite el
// respaldo al comprobante de la transacción. Ni aquí ni en ningún otro punto
// del documento se escribe un número de cuenta, una entidad o un titular.
// El resto de las cláusulas conserva la redacción de la v1.
// ===========================================================================

import {
  agenteCompareciente,
  comparecientes,
  inmuebleAntecedente,
  jurisdiccion,
  type BloqueDocumento,
  type DatosDocumento,
} from './base';

export const PLANTILLA_VERSION = 'reserva-arriendo-v2-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = false;
export const AVISO_PLANTILLA_SIN_REVISAR =
  'PLANTILLA EN REVISIÓN. El texto de este documento es una propuesta que aún no ha sido validada por un profesional del derecho. Revíselo con su abogado antes de suscribirlo.';

// Quién devuelve el dinero es quien lo tiene. El agente elige el tenedor y la
// consecuencia; la redacción sale de cruzar ambos, y no puede quedar diciendo
// que devuelve alguien que nunca recibió nada.
function consecuenciaSiNoSeConcreta(d: DatosDocumento): string {
  const enPoderDelAgente = d.campo('reservaEntregadaA') !== 'ARRENDADOR';
  const laTiene = enPoderDelAgente ? 'el Agente' : 'el arrendador';
  const plazo = d.campo('plazoDevolucionDias') || '5';

  switch (d.campo('siNoSeConcreta')) {
    case 'DEVOLUCION_TOTAL':
      return `${laTiene} devolverá al Interesado el valor entregado en su totalidad, dentro de los ${plazo} días hábiles siguientes.`;
    case 'SE_PIERDE':
      return enPoderDelAgente
        ? `el valor entregado no será reembolsable al Interesado, y el Agente lo entregará al arrendador dentro de los ${plazo} días hábiles siguientes, en concepto de indemnización por la indisponibilidad del inmueble.`
        : 'el valor entregado no será reembolsable al Interesado y quedará en favor del arrendador, que ya lo tiene en su poder, en concepto de indemnización por la indisponibilidad del inmueble.';
    default: {
      const detalle = d.campo('devolucionParcialDetalle') || 'según lo que las partes acuerden por escrito';
      return enPoderDelAgente
        ? `el Agente devolverá al Interesado una parte del valor entregado, conforme a lo siguiente: ${detalle}, dentro de los ${plazo} días hábiles siguientes, y entregará el saldo al arrendador en el mismo plazo.`
        : `el arrendador devolverá al Interesado una parte del valor entregado, conforme a lo siguiente: ${detalle}, dentro de los ${plazo} días hábiles siguientes, y conservará el saldo a su favor.`;
    }
  }
}

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const destinoValor = d.campo('destinoValor') === 'GARANTIA' ? 'la garantía o depósito' : 'el primer canon de arrendamiento';
  const enPoderDelAgente = d.campo('reservaEntregadaA') !== 'ARRENDADOR';
  const tenedor = enPoderDelAgente ? 'el Agente' : 'el arrendador';
  const consecuencia = consecuenciaSiNoSeConcreta(d);

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
      texto: `El Interesado manifiesta su voluntad de arrendar el inmueble descrito y entrega la suma de ${d.dinero(
        'montoReserva',
      )} a fin de que el inmueble sea reservado a su favor y retirado temporalmente de la oferta.`,
    },
    // ÚNICO cambio de fondo respecto de la v1 (puntos 2.3 y 2.4).
    {
      tipo: 'clausula',
      titulo: 'ENTREGA Y RESPALDO DEL VALOR DE LA RESERVA',
      texto: `El Interesado entrega el valor de la reserva a ${tenedor} el ${d.campo('fechaEntrega')} mediante ${d
        .opcion('formaPago')
        .toLowerCase()}. Las partes dejan constancia de que el respaldo del pago es el comprobante emitido en la respectiva transacción, documento que cada parte conservará y que se considera parte integrante del presente instrumento. La entrega de los datos necesarios para efectuar el pago se realiza por canal separado entre las partes y no forma parte de este documento.${
        enPoderDelAgente
          ? ' El Agente conserva el valor en calidad de simple depositario, hasta que proceda su imputación al arrendamiento, su entrega al arrendador o su devolución al Interesado conforme a las cláusulas siguientes.'
          : ''
      }`,
    },
    {
      tipo: 'clausula',
      titulo: 'PLAZO',
      texto: `La reserva tendrá una vigencia de ${d.campo(
        'plazoDias',
      )} días calendario contados desde la suscripción de este documento.`,
    },
    {
      tipo: 'clausula',
      titulo: 'CONDICIONES PARA LA SUSCRIPCIÓN DEL ARRENDAMIENTO',
      texto: `Dentro del plazo señalado deberán cumplirse las siguientes condiciones para la suscripción del contrato de arrendamiento: ${d.campo(
        'condiciones',
      )}`,
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
      texto:
        'Este documento constituye una reserva y no un contrato de arrendamiento. Los derechos y obligaciones propios del arrendamiento nacerán únicamente con la suscripción del contrato respectivo.',
    },
    ...jurisdiccion(d),
    { tipo: 'firmas' },
  ];
}

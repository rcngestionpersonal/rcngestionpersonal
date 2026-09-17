// ===========================================================================
// RESERVA DE ARRENDAMIENTO — v3-2026-09
//
// ⚠️  PENDIENTE DE REVISIÓN LEGAL  ⚠️  (igual que la v2)
//
// Es la v2, que se retiró el 2026-09-11 y vuelve a ofrecerse, con los cambios
// indispensables para el módulo actual y ninguno de fondo:
//
//   - Cada cláusula tiene clave, para el editor de cláusulas.
//   - El interesado puede ser una compañía con su representante legal, y el
//     agente puede comparecer por su empresa.
//   - Las notificaciones ya no remiten a la "constancia de firma", que no
//     existe: van a los domicilios y correos de la comparecencia.
//
// Sigue sin número de cuenta, entidad ni titular, y quién devuelve el dinero
// sigue derivándose de quién lo tiene.
// ===========================================================================

import { comparecenciaParte, inmuebleAntecedente, opcional, type BloqueDocumento, type DatosDocumento } from './base';

export const PLANTILLA_VERSION = 'reserva-arriendo-v3-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = false;
export const AVISO_PLANTILLA_SIN_REVISAR =
  'PLANTILLA EN REVISIÓN. El texto de este documento es una propuesta que aún no ha sido validada por un profesional del derecho. Revíselo con su abogado antes de suscribirlo.';

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
    case 'DEVOLUCION_PARCIAL': {
      const detalle = d.campo('devolucionParcialDetalle') || 'según lo que las partes acuerden por escrito';
      return enPoderDelAgente
        ? `el Agente devolverá al Interesado una parte del valor entregado, conforme a lo siguiente: ${detalle}, dentro de los ${plazo} días hábiles siguientes, y entregará el saldo al arrendador en el mismo plazo.`
        : `el arrendador devolverá al Interesado una parte del valor entregado, conforme a lo siguiente: ${detalle}, dentro de los ${plazo} días hábiles siguientes, y conservará el saldo a su favor.`;
    }
    default:
      return `${opcional('')}.`;
  }
}

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const destinoValor = d.campo('destinoValor') === 'GARANTIA' ? 'la garantía o depósito' : 'el primer canon de arrendamiento';
  const enPoderDelAgente = d.campo('reservaEntregadaA') !== 'ARRENDADOR';
  const tenedor = enPoderDelAgente ? 'el Agente' : 'el arrendador';
  const condiciones = d.campo('condiciones').trim();

  return [
    { tipo: 'titulo', texto: 'RESERVA DE ARRENDAMIENTO' },
    { tipo: 'subtitulo', texto: 'COMPARECIENTES' },
    { tipo: 'parrafo', texto: `EL INTERESADO: ${comparecenciaParte(d, 'interesado', 'el Interesado')}.` },
    { tipo: 'parrafo', texto: `EL AGENTE: ${comparecenciaParte(d, 'corredor', 'el Agente')}.` },
    { tipo: 'subtitulo', texto: 'ANTECEDENTES' },
    inmuebleAntecedente(d),
    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },
    {
      tipo: 'clausula',
      clave: 'objeto',
      titulo: 'OBJETO',
      texto: `El Interesado manifiesta su voluntad de arrendar el inmueble descrito y entrega la suma de ${d.dinero(
        'montoReserva',
      )} a fin de que el inmueble sea reservado a su favor y retirado temporalmente de la oferta.`,
    },
    {
      tipo: 'clausula',
      clave: 'entrega-reserva',
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
      clave: 'plazo',
      titulo: 'PLAZO',
      texto: `La reserva tendrá una vigencia de ${d.campo('plazoDias')} días calendario contados desde la suscripción de este documento.`,
    },
    {
      tipo: 'clausula',
      clave: 'condiciones',
      titulo: 'CONDICIONES PARA LA SUSCRIPCIÓN DEL ARRENDAMIENTO',
      texto: `Dentro del plazo señalado deberán cumplirse las siguientes condiciones para la suscripción del contrato de arrendamiento: ${
        condiciones ? (/[.:;!?]$/.test(condiciones) ? condiciones : `${condiciones}.`) : `${opcional('')}.`
      }`,
    },
    {
      tipo: 'clausula',
      clave: 'imputacion',
      titulo: 'IMPUTACIÓN DEL VALOR',
      texto: `Suscrito el contrato de arrendamiento, el valor entregado se imputará a ${destinoValor}.`,
    },
    {
      tipo: 'clausula',
      clave: 'no-concreta',
      titulo: 'SI EL ARRENDAMIENTO NO SE CONCRETA',
      texto: `Si dentro del plazo de la reserva no se suscribe el contrato de arrendamiento, ${consecuenciaSiNoSeConcreta(d)}`,
    },
    {
      tipo: 'clausula',
      clave: 'naturaleza',
      titulo: 'NATURALEZA DE ESTE DOCUMENTO',
      texto:
        'Este documento constituye una reserva y no un contrato de arrendamiento. Los derechos y obligaciones propios del arrendamiento nacerán únicamente con la suscripción del contrato respectivo.',
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
    { tipo: 'firmas' },
  ];
}

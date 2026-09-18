// ===========================================================================
// CORRETAJE INMOBILIARIO — CONSIGNACIÓN PARA VENTA — v4-2026-09
//
// Es la v3 con los cambios pedidos por el agente:
//
//   1. SIN señal ni depósito de trato: ese dinero pertenece a los contratos de
//      reserva, no al encargo de comercializar.
//   2. SIN linderos: basta la descripción del inmueble.
//   3. El inmueble se describe con el texto que escribe el agente (en el
//      corretaje todavía se está captando y no está en "Tus inmuebles"), y ese
//      texto sale completo en su propia cláusula.
//   4. "Número de catastro" pasa a "Número de predio".
//   5. La cláusula de controversias se arma según el mecanismo elegido:
//      mediación y jueces, arbitraje, o solo jueces, en la ciudad elegida.
//   6. El cierre solo acepta y suscribe: ya no arrastra nada de señales ni de
//      consignación de valores.
//
// La v3 sigue registrada: nunca se edita una versión publicada.
// ===========================================================================

import { comparecenciaParteNeutra, jurisdiccionDe, opcional, textoControversias, type BloqueDocumento, type DatosDocumento } from './base';

export const PLANTILLA_VERSION = 'corretaje-v4-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = true;
export const AVISO_PLANTILLA_SIN_REVISAR = '';

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const conExclusividad = d.campo('exclusividad') === 'CON';
  const rotulo = d.campo('rotuloAutorizado') !== 'NO';
  const iva = d.campo('ivaTarifa');
  const licencia = `con licencia profesional N.º ${opcional(d.agente.licencia ?? '')}`;
  const jurisdiccion = jurisdiccionDe(d, d.campo('propiedadCiudad'));
  const predio = d.campo('propiedadPredio') || d.campo('propiedadCatastro');

  return [
    {
      tipo: 'titulo',
      texto: `CONTRATO DE CORRETAJE INMOBILIARIO · ENCARGO DE VENTA ${
        conExclusividad ? '(CON EXCLUSIVIDAD)' : '(SIN EXCLUSIVIDAD)'
      }`,
    },

    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },

    {
      tipo: 'clausula',
      clave: 'comparecientes',
      titulo: 'COMPARECIENTES',
      texto: `Comparecen a la celebración del presente contrato, por una parte, ${comparecenciaParteNeutra(
        d,
        'corredor',
        'el Corredor',
        licencia,
      )}; y, por otra, ${comparecenciaParteNeutra(
        d,
        'propietario',
        'el Propietario',
      )}. Las partes convienen en celebrar el presente contrato de corretaje, por el cual el Propietario encarga al Corredor la comercialización y venta del inmueble descrito en la cláusula {{ref:inmueble}}.`,
    },
    {
      tipo: 'clausula',
      clave: 'inmueble',
      titulo: 'EL INMUEBLE',
      texto: `El encargo recae sobre el siguiente inmueble, descrito por el Propietario y el Corredor: ${opcional(
        d.campo('inmuebleDescripcion'),
      )} El inmueble está ubicado en ${opcional(d.campo('propiedadDireccion'))}, cantón ${opcional(
        d.campo('propiedadCiudad'),
      )}, provincia ${opcional(d.campo('propiedadProvincia'))}${predio ? `, con número de predio ${predio}` : ''}. El precio de venta acordado consta en el resumen que cierra este contrato y forma parte de él.`,
    },
    {
      tipo: 'clausula',
      clave: 'rotulo',
      titulo: 'AUTORIZACIÓN DE RÓTULO O AVISO',
      texto: rotulo
        ? 'El Propietario autoriza al Corredor a colocar rótulo o aviso de venta en el inmueble. El rótulo es de cargo y propiedad del Corredor, quien lo retirará al terminar este contrato y responderá por los daños que su instalación cause al inmueble.'
        : 'El Propietario no autoriza la colocación de rótulo ni aviso de venta en el inmueble. El Corredor promocionará el inmueble por los demás medios a su alcance.',
    },
    {
      tipo: 'clausula',
      clave: 'honorarios',
      titulo: 'HONORARIOS',
      texto: `El Propietario pagará al Corredor, como honorarios por su gestión, el ${d.campo(
        'honorariosPorcentaje',
      )}% del precio real de venta, más el impuesto al valor agregado a la tarifa vigente${
        iva ? ` del ${iva}%` : ''
      } al momento de la emisión de la factura correspondiente. Los honorarios se devengan al formalizarse la venta, entendiéndose por tal la suscripción del instrumento que la perfeccione, con independencia de la forma o el calendario en que se pague el precio. El pago se realizará dentro de los ${d.campo(
        'honorariosPlazoDias',
      )} días hábiles siguientes a esa suscripción, previa emisión de la factura. Los gastos de promoción y publicidad son de cuenta del Corredor y se entienden comprendidos en sus honorarios; si la venta no se concreta, el Propietario no adeuda valor alguno por ese concepto.`,
    },
    {
      tipo: 'clausula',
      clave: 'comprador-presentado',
      titulo: 'ALCANCE DEL COMPRADOR PRESENTADO',
      texto:
        'Se entiende comprador presentado por el Corredor aquel a quien éste puso en contacto con el inmueble o con el Propietario por primera vez, sea mediante visita, envío de información o coordinación de la negociación. El alcance de la presentación se extiende a los parientes del interesado dentro del cuarto grado de consanguinidad y segundo de afinidad, a sus herederos, a los beneficiarios que designe, a sus socios, y a las sociedades o personas jurídicas en las que tenga participación o cuya representación ejerza. Si la venta se celebra con cualquiera de ellos, los honorarios se devengan íntegramente a favor del Corredor, aunque el cierre se materialice por otra vía.',
    },
    {
      tipo: 'clausula',
      clave: 'documentos',
      titulo: 'DOCUMENTOS QUE ENTREGA EL PROPIETARIO',
      texto: `Dentro de los ${d.campo(
        'documentosPlazoDias',
      )} días hábiles siguientes a la suscripción, el Propietario entregará al Corredor copia de: a) la escritura de adquisición del inmueble; b) el documento de identidad de cada propietario${
        d.parte('propietario').juridica ? ', y el nombramiento vigente de quien representa a la compañía' : ''
      }; c) el certificado de impuesto predial del año más reciente; y d) el poder de representación, cuando quien suscribe actúe por otro. El Propietario declara que la información que entrega es veraz y se obliga a comunicar al Corredor cualquier cambio en la situación jurídica del inmueble. La demora en la entrega de estos documentos suspende los plazos que dependan de ellos, sin que ello altere la vigencia de este contrato.`,
    },
    {
      tipo: 'clausula',
      clave: 'vigencia',
      titulo: 'VIGENCIA Y PRÓRROGA',
      texto: `Este contrato tiene una vigencia de ${d.campo(
        'vigenciaMeses',
      )} meses contados desde la fecha de su suscripción. Vencido el plazo, se prorroga automáticamente por períodos iguales, salvo que cualquiera de las partes comunique por escrito su voluntad de no prorrogarlo con al menos ${d.campo(
        'prorrogaAvisoDias',
      )} días hábiles de anticipación al vencimiento en curso.`,
    },
    {
      tipo: 'clausula',
      clave: 'exclusividad',
      titulo: conExclusividad ? 'EXCLUSIVIDAD' : 'AUSENCIA DE EXCLUSIVIDAD',
      texto: conExclusividad
        ? 'El encargo se otorga en exclusiva. Durante la vigencia, el Propietario se abstiene de comercializar el inmueble por cuenta propia o por medio de otros agentes, y canalizará por el Corredor toda oferta que reciba. Si durante la vigencia el inmueble se vende por una vía distinta, el Propietario pagará al Corredor los honorarios pactados en la cláusula {{ref:honorarios}}, calculados sobre el precio real de esa venta.'
        : 'El encargo se otorga sin exclusividad. El Propietario conserva la facultad de comercializar el inmueble por cuenta propia o por medio de otros agentes, sin que ello constituya incumplimiento de este contrato. Los honorarios se devengan únicamente cuando la venta se celebre con un comprador presentado por el Corredor, en los términos de la cláusula {{ref:comprador-presentado}}.',
    },
    {
      tipo: 'clausula',
      clave: 'terminacion',
      titulo: 'CAUSALES DE TERMINACIÓN',
      texto: `Este contrato termina por: a) el vencimiento del plazo, cuando alguna de las partes haya comunicado su voluntad de no prorrogarlo; b) el cumplimiento de su objeto, con la venta del inmueble; c) la renuncia del Corredor, notificada por escrito con al menos ${d.campo(
        'renunciaAvisoDias',
      )} días hábiles de anticipación; y d) la destrucción o pérdida del inmueble que impida su enajenación. La terminación no afecta al derecho del Corredor a percibir los honorarios correspondientes a las ventas que se celebren con compradores presentados por él durante la vigencia.`,
    },
    {
      tipo: 'clausula',
      clave: 'controversias',
      titulo: 'LEY APLICABLE Y SOLUCIÓN DE CONTROVERSIAS',
      texto: textoControversias(jurisdiccion),
    },
    {
      tipo: 'clausula',
      clave: 'aceptacion',
      titulo: 'ACEPTACIÓN Y SUSCRIPCIÓN',
      texto: `Las partes declaran que han leído íntegramente este contrato, que entienden su contenido y que lo aceptan en todas sus partes. En constancia, lo suscriben en ${jurisdiccion.ciudad}, en dos ejemplares de igual valor, en la fecha indicada al inicio.`,
    },

    { tipo: 'firmas' },

    {
      tipo: 'ficha',
      titulo: 'INFORMACIÓN DE LA PROPIEDAD',
      filas: [
        { etiqueta: 'Precio de venta', valor: d.dinero('precio') },
        { etiqueta: 'Dirección', valor: opcional(d.campo('propiedadDireccion')) },
        { etiqueta: 'Ciudad', valor: opcional(d.campo('propiedadCiudad')) },
        { etiqueta: 'Provincia', valor: opcional(d.campo('propiedadProvincia')) },
        { etiqueta: 'Número de predio', valor: opcional(predio) },
      ],
    },
  ];
}

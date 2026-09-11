// ===========================================================================
// CORRETAJE INMOBILIARIO — CONSIGNACIÓN PARA VENTA — v2-2026-09
//
// Redacción propia, elaborada sobre la base de formatos de uso común entre
// asociaciones de corredores de bienes raíces del Ecuador. No reproduce el
// texto de ningún documento concreto ni menciona entidad alguna.
//
// Sustituye a las dos plantillas separadas de modalidad exclusiva y abierta:
// la exclusividad pasa a ser un campo, y solo cambia la cláusula séptima.
//
// Numeración correlativa, sin saltos: las once cláusulas se emiten siempre, en
// el mismo orden, y ninguna depende de un dato para existir. Lo que varía es el
// texto de la séptima y el detalle de la octava.
// ===========================================================================

import { opcional, type BloqueDocumento, type DatosDocumento } from './base';

export const PLANTILLA_VERSION = 'corretaje-v2-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = true;
export const AVISO_PLANTILLA_SIN_REVISAR = '';

function conDocumento(d: DatosDocumento, rol: string): string {
  const tipo = d.campo(`${rol}_tipoDocumento`) === 'PASAPORTE' ? 'pasaporte' : 'cédula';
  return `portador de ${tipo === 'cédula' ? 'la cédula' : 'el pasaporte'} N.º ${d.campo(`${rol}_cedula`)}`;
}

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const conExclusividad = d.campo('exclusividad') === 'CON';
  const rotulo = d.campo('rotuloAutorizado') !== 'NO';
  const iva = d.campo('ivaTarifa');
  const enPoderDelCorredor = d.campo('depositoEnPoderDe') !== 'PROPIETARIO';
  const ciudad = d.campo('ciudadJurisdiccion') || d.ciudad;

  const licencia = d.agente.licencia
    ? `, con licencia profesional N.º ${d.agente.licencia}`
    : `, con licencia profesional N.º ${opcional('')}`;

  // Qué pasa con la señal si el interesado se retira.
  const siDesiste = (() => {
    switch (d.campo('siDesisteComprador')) {
      case 'DEVOLUCION_TOTAL':
        return `se devolverá íntegramente al interesado dentro de los ${d.campo('devolucionPlazoDias')} días hábiles siguientes.`;
      case 'DEVOLUCION_PARCIAL':
        return `se devolverá parcialmente al interesado, conforme a lo siguiente: ${opcional(
          d.campo('retencionDetalle'),
        )}, dentro de los ${d.campo('devolucionPlazoDias')} días hábiles siguientes, y el saldo quedará a favor del Propietario.`;
      default:
        return enPoderDelCorredor
          ? `quedará a favor del Propietario, a quien el Corredor la entregará dentro de los ${d.campo('devolucionPlazoDias')} días hábiles siguientes.`
          : 'quedará a favor del Propietario, que ya la tiene en su poder, sin que deba realizarse desembolso alguno.';
    }
  })();

  return [
    {
      tipo: 'titulo',
      texto: `CONTRATO DE CORRETAJE INMOBILIARIO · CONSIGNACIÓN PARA VENTA ${
        conExclusividad ? '(CON EXCLUSIVIDAD)' : '(SIN EXCLUSIVIDAD)'
      }`,
    },

    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },

    {
      tipo: 'clausula',
      titulo: 'COMPARECIENTES',
      texto: `EL CORREDOR: ${d.agente.nombre}, portador de la cédula N.º ${d.agente.cedula}${licencia}, domiciliado en ${d.agente.direccion}, correo electrónico ${d.agente.correo}, teléfono ${d.agente.telefono}. EL PROPIETARIO: ${d.campo(
        'propietario_nombre',
      )}, ${conDocumento(d, 'propietario')}, domiciliado en ${d.campo('propietario_direccion')}, correo electrónico ${d.campo(
        'propietario_correo',
      )}, teléfono ${d.campo(
        'propietario_telefono',
      )}. Las partes convienen en celebrar el presente contrato de corretaje, por el cual el Propietario consigna al Corredor la venta del inmueble identificado en el bloque INFORMACIÓN DE LA PROPIEDAD, que forma parte integrante de este instrumento.`,
    },
    {
      tipo: 'clausula',
      titulo: 'AUTORIZACIÓN DE RÓTULO O AVISO',
      texto: rotulo
        ? 'El Propietario autoriza al Corredor a colocar rótulo o aviso de venta en el inmueble. El rótulo es de cargo y propiedad del Corredor, quien lo retirará al terminar este contrato y responderá por los daños que su instalación cause al inmueble.'
        : 'El Propietario no autoriza la colocación de rótulo ni aviso de venta en el inmueble. El Corredor promocionará el inmueble por los demás medios a su alcance.',
    },
    {
      tipo: 'clausula',
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
      titulo: 'ALCANCE DEL COMPRADOR PRESENTADO',
      texto:
        'Se entiende comprador presentado por el Corredor aquel a quien éste puso en contacto con el inmueble o con el Propietario por primera vez, sea mediante visita, envío de información o coordinación de la negociación. El alcance de la presentación se extiende a los parientes del interesado dentro del cuarto grado de consanguinidad y segundo de afinidad, a sus herederos, a los beneficiarios que designe, a sus socios, y a las sociedades o personas jurídicas en las que tenga participación o cuya representación ejerza. Si la venta se celebra con cualquiera de ellos, los honorarios se devengan íntegramente a favor del Corredor, aunque el cierre se materialice por otra vía.',
    },
    {
      tipo: 'clausula',
      titulo: 'DOCUMENTOS QUE ENTREGA EL PROPIETARIO',
      texto: `Dentro de los ${d.campo(
        'documentosPlazoDias',
      )} días hábiles siguientes a la suscripción, el Propietario entregará al Corredor copia de: a) la escritura de adquisición del inmueble; b) el documento de identidad de cada propietario; c) el certificado de impuesto predial del año más reciente; y d) el poder de representación, cuando quien suscribe actúe por otro. El Propietario declara que la información que entrega es veraz y se obliga a comunicar al Corredor cualquier cambio en la situación jurídica del inmueble. La demora en la entrega de estos documentos suspende los plazos que dependan de ellos, sin que ello altere la vigencia de este contrato.`,
    },
    {
      tipo: 'clausula',
      titulo: 'VIGENCIA Y PRÓRROGA',
      texto: `Este contrato tiene una vigencia de ${d.campo(
        'vigenciaMeses',
      )} meses contados desde la fecha de su suscripción. Vencido el plazo, se prorroga automáticamente por períodos iguales, salvo que cualquiera de las partes comunique por escrito su voluntad de no prorrogarlo con al menos ${d.campo(
        'prorrogaAvisoDias',
      )} días hábiles de anticipación al vencimiento en curso.`,
    },
    {
      tipo: 'clausula',
      titulo: conExclusividad ? 'EXCLUSIVIDAD' : 'AUSENCIA DE EXCLUSIVIDAD',
      texto: conExclusividad
        ? 'La consignación se otorga en exclusiva. Durante la vigencia, el Propietario se abstiene de comercializar el inmueble por cuenta propia o por medio de otros agentes, y canalizará por el Corredor toda oferta que reciba. Si durante la vigencia el inmueble se vende por una vía distinta, el Propietario pagará al Corredor los honorarios pactados en la cláusula tercera, calculados sobre el precio real de esa venta.'
        : 'La consignación se otorga sin exclusividad. El Propietario conserva la facultad de comercializar el inmueble por cuenta propia o por medio de otros agentes, sin que ello constituya incumplimiento de este contrato. Los honorarios se devengan únicamente cuando la venta se celebre con un comprador presentado por el Corredor, en los términos de la cláusula cuarta.',
    },
    {
      tipo: 'clausula',
      titulo: 'DEPÓSITO O SEÑAL DE TRATO',
      texto: `Cuando un interesado entregue una cantidad en concepto de señal o depósito para asegurar la negociación, ésta quedará en poder ${
        enPoderDelCorredor ? 'del Corredor' : 'del Propietario'
      } y se imputará al precio si la venta se formaliza. Si la venta no se formaliza por desistimiento del interesado, la señal ${siDesiste} Si no se formaliza por desistimiento del Propietario, la señal se devuelve íntegramente al interesado dentro de los ${d.campo(
        'devolucionPlazoDias',
      )} días hábiles siguientes. Si no se formaliza por causa ajena a la voluntad de ambos, la señal se devuelve al interesado sin recargo, en el mismo plazo.${
        enPoderDelCorredor
          ? ' El Corredor conserva la señal en calidad de simple depositario y su obligación se limita a entregarla o devolverla en los términos de esta cláusula, hasta el monto efectivamente recibido.'
          : ''
      }`,
    },
    {
      tipo: 'clausula',
      titulo: 'CAUSALES DE TERMINACIÓN',
      texto: `Este contrato termina por: a) el vencimiento del plazo, cuando alguna de las partes haya comunicado su voluntad de no prorrogarlo; b) el cumplimiento de su objeto, con la venta del inmueble; c) la renuncia del Corredor, notificada por escrito con al menos ${d.campo(
        'renunciaAvisoDias',
      )} días hábiles de anticipación; y d) la destrucción o pérdida del inmueble que impida su enajenación. La terminación no afecta al derecho del Corredor a percibir los honorarios correspondientes a las ventas que se celebren con compradores presentados por él durante la vigencia.`,
    },
    {
      tipo: 'clausula',
      titulo: 'LEY APLICABLE, MEDIACIÓN Y JUECES COMPETENTES',
      texto: `Este contrato se rige por la legislación ecuatoriana. Ante cualquier divergencia, las partes procurarán un acuerdo directo y, de no alcanzarlo, acudirán a mediación en un centro legalmente autorizado antes de iniciar cualquier acción. Agotada la mediación sin acuerdo, las partes se someten a los jueces competentes de ${ciudad} y al procedimiento que corresponda.`,
    },
    {
      tipo: 'clausula',
      titulo: 'ACEPTACIÓN',
      texto:
        'Las partes declaran haber leído íntegramente este contrato, entender su contenido y aceptarlo, y lo suscriben en la fecha indicada.',
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
        { etiqueta: 'Número de catastro', valor: opcional(d.campo('propiedadCatastro')) },
        { etiqueta: 'Lindero norte', valor: opcional(d.campo('linderoNorte')) },
        { etiqueta: 'Lindero sur', valor: opcional(d.campo('linderoSur')) },
        { etiqueta: 'Lindero este', valor: opcional(d.campo('linderoEste')) },
        { etiqueta: 'Lindero oeste', valor: opcional(d.campo('linderoOeste')) },
      ],
    },
  ];
}

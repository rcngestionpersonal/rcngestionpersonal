// ===========================================================================
// ARRENDAMIENTO COMERCIAL — v1-2026-09
//
// Base: un contrato de arrendamiento de local comercial ya notariado, de
// dieciocho cláusulas, con estas correcciones:
//
//   - Numeración correlativa. La muestra saltaba 8.3 y 12.3 y subnumeraba las
//     cláusulas 14 a 17 como 15 a 18.
//   - Sin datos bancarios: el pago va a la cuenta que el arrendador comunique
//     por escrito.
//   - Sin cita de artículos de ley. La fuerza mayor remite a la ley.
//   - 11.2 corregido: el que no tiene derecho a reembolso por mejoras es el
//     arrendatario, no el arrendador.
//   - "Sin necesidad de desahucio" sale del plazo y pasa a una cláusula
//     opcional apagada, como las demás renuncias discutibles.
//   - Lo propio de un caso concreto queda parametrizado (áreas y marca) o como
//     cláusula opcional (actividad gastronómica).
//   - 8.3 nuevo sobre alícuotas: el título de la cláusula las nombraba sin
//     regularlas.
// ===========================================================================

import { opcional, type BloqueDocumento, type DatosDocumento } from './base';
import {
  comparecencia,
  desalojo,
  literales,
  renunciaCanon,
  renunciaDesahucio,
  subnumerar,
  tituloEjecutivo,
  v,
  type Denominaciones,
} from './arrendamiento-comun-v1';

export const PLANTILLA_VERSION = 'arrendamiento-comercial-v1-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = true;
export const AVISO_PLANTILLA_SIN_REVISAR = '';

const DEN: Denominaciones = { arrendador: 'EL ARRENDADOR', arrendatario: 'EL ARRENDATARIO' };

const TITULO_POR_TIPO: Record<string, string> = {
  LOCAL: 'CONTRATO DE ARRENDAMIENTO DE LOCAL COMERCIAL',
  OFICINA: 'CONTRATO DE ARRENDAMIENTO DE OFICINA',
  CONSULTORIO: 'CONTRATO DE ARRENDAMIENTO DE CONSULTORIO',
};

function canones(d: DatosDocumento, clave: string): string {
  const n = d.campo(clave);
  if (!n) return `${opcional('')} cánones mensuales`;
  return `${n} ${n === '1' ? 'canon mensual' : 'cánones mensuales'}`;
}

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const ciudad = d.campo('ciudadJurisdiccion') || d.ciudad;
  const canton = v(d, 'inmuebleCiudad');
  const alicuota = d.campo('alicuota') || 'ARRENDATARIO';
  const predio = d.campo('predio');
  const distribucion = d.campo('areaDistribucion');
  const destinoDetalle = d.campo('destinoDetalle');
  const incremento = d.campo('incrementoPorcentaje');
  const primerCanon = d.campo('primerCanonMes');

  return [
    { tipo: 'titulo', texto: TITULO_POR_TIPO[d.campo('tipoLocal')] ?? TITULO_POR_TIPO.LOCAL },
    ...comparecencia(d, DEN),

    {
      tipo: 'clausula',
      clave: 'antecedentes',
      titulo: 'ANTECEDENTES Y DECLARACIONES',
      texto: subnumerar([
        `EL ARRENDADOR declara ser propietario del inmueble de naturaleza comercial ubicado en ${v(d, 'inmuebleDireccion')}, parroquia ${v(
          d,
          'inmuebleParroquia',
        )}, cantón ${canton}, provincia de ${v(
          d,
          'inmuebleProvincia',
        )}, inmueble que se encuentra debidamente inscrito a su nombre en el Registro de la Propiedad del cantón ${canton}${
          predio ? `, predio N.º ${predio}` : ''
        }.`,
        'EL ARRENDADOR declara que el inmueble objeto de este contrato se encuentra libre de gravámenes, prohibiciones de enajenar, embargos, litigios pendientes y de cualquier otro impedimento que limite o afecte el goce pacífico del bien por parte de EL ARRENDATARIO, y que se halla al día en el pago de impuestos prediales y demás tributos que le corresponden como propietario.',
        'EL ARRENDATARIO declara conocer el estado actual del inmueble, haberlo inspeccionado a su entera satisfacción y aceptarlo en el estado en que se encuentra.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'objeto',
      titulo: 'OBJETO DEL CONTRATO',
      texto: subnumerar([
        `Con los antecedentes expuestos, EL ARRENDADOR da en arrendamiento a EL ARRENDATARIO, y éste recibe en tal calidad, ${v(
          d,
          'areaArrendada',
        )} del inmueble descrito en la cláusula {{ref:antecedentes}}, en todas sus áreas, dependencias, instalaciones y servicios, incluidas las áreas de uso exclusivo que le correspondan.`,
        `El área arrendada suma aproximadamente ${v(d, 'areaM2')} metros cuadrados${distribucion ? `, distribuidos de la siguiente manera: ${distribucion.replace(/\.$/, '')}` : ''}.`,
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'destino',
      titulo: 'DESTINO DEL INMUEBLE',
      texto: subnumerar([
        `El inmueble arrendado se destinará al giro de ${v(d, 'giro').replace(/\.$/, '')}.`,
        destinoDetalle ? `A la fecha de suscripción de este contrato, EL ARRENDATARIO declara que destinará ${destinoDetalle.replace(/\.$/, '')}.` : null,
        'EL ARRENDATARIO será el único responsable de obtener y mantener vigentes, a su costo, la licencia municipal de funcionamiento, el permiso de funcionamiento del Cuerpo de Bomberos y todos los demás permisos, patentes y autorizaciones que la normativa municipal y nacional exija para el desarrollo de su actividad. EL ARRENDADOR se obliga a prestar la colaboración documental razonable que dichos trámites requieran en su calidad de propietario.',
        'La negativa, demora o revocatoria de cualquier permiso por causas imputables a EL ARRENDATARIO o a la naturaleza de su actividad no lo libera de sus obligaciones de pago ni constituye causal de terminación anticipada del contrato sin responsabilidad.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'plazo',
      titulo: 'PLAZO',
      texto: subnumerar([
        `El plazo de duración del presente contrato es de ${v(d, 'plazoMeses')} meses, contados desde el ${v(d, 'fechaInicio')} hasta el ${v(
          d,
          'fechaFin',
        )}, fecha en la cual el contrato terminará.`,
        'Las partes declaran que el plazo pactado es forzoso para ambas, por lo que ninguna de ellas podrá darlo por terminado unilateralmente antes de su vencimiento, salvo por las causales expresamente previstas en la cláusula {{ref:terminacion}} de este contrato o por mutuo acuerdo escrito.',
        `Si EL ARRENDATARIO deseare renovar el contrato por un nuevo periodo, deberá comunicarlo por escrito a EL ARRENDADOR con al menos ${v(
          d,
          'renovacionAvisoDias',
        )} días de anticipación al vencimiento del plazo, a fin de que las partes negocien las nuevas condiciones. Esta comunicación no genera por sí sola obligación de renovar para EL ARRENDADOR.`,
      ]),
    },
    renunciaDesahucio(),
    {
      tipo: 'clausula',
      clave: 'canon',
      titulo: 'CANON DE ARRENDAMIENTO E INCREMENTO ANUAL',
      texto: subnumerar([
        `El canon de arrendamiento mensual que EL ARRENDATARIO pagará a EL ARRENDADOR es de ${d.dinero(
          'canon',
        )}, más el Impuesto al Valor Agregado (IVA) a la tarifa vigente a la fecha de cada emisión.`,
        incremento
          ? `Las partes acuerdan expresamente que, a partir del ${v(
              d,
              'incrementoDesde',
            )}, y en cada aniversario subsiguiente del contrato, el canon mensual se incrementará automáticamente en ${incremento}% respecto del canon mensual vigente en el mes inmediato anterior. En consecuencia, el nuevo canon se determinará aplicando dicho porcentaje sobre el canon efectivamente pagado en el período inmediatamente anterior.`
          : null,
        'Todos los valores señalados se entienden en dólares de los Estados Unidos de América y NO INCLUYEN el Impuesto al Valor Agregado (IVA), el cual se adicionará a cada canon a la tarifa legal vigente y será asumido por EL ARRENDATARIO.',
        'EL ARRENDADOR se obliga a emitir y entregar a EL ARRENDATARIO la correspondiente factura electrónica por cada canon mensual, con el desglose del IVA, dentro de los plazos que establece la normativa tributaria. La entrega de la factura es condición para la exigibilidad de las obligaciones tributarias formales, mas no suspende la obligación de pago del canon.',
        'En caso de que EL ARRENDATARIO tenga la calidad de agente de retención conforme a la normativa tributaria vigente, efectuará las retenciones en la fuente que legalmente correspondan sobre el canon y entregará los comprobantes de retención respectivos; los valores retenidos se imputarán al pago y no se considerarán mora ni pago incompleto.',
      ]),
    },
    renunciaCanon(DEN),
    {
      tipo: 'clausula',
      clave: 'pago',
      titulo: 'FORMA, LUGAR Y OPORTUNIDAD DE PAGO',
      texto: subnumerar([
        `EL ARRENDATARIO pagará el canon mensual por mensualidades anticipadas, dentro de los ${v(d, 'diaPago')} primeros días de cada mes.${
          primerCanon ? ` El primer canon, correspondiente al mes de ${primerCanon}, se pagará dentro de ese mismo plazo.` : ''
        }`,
        'Los pagos se efectuarán mediante transferencia o depósito bancario a la cuenta de titularidad de EL ARRENDADOR que éste comunique por escrito a EL ARRENDATARIO.',
        'El comprobante de la transferencia o depósito constituirá prueba suficiente del pago, siempre que corresponda íntegramente al valor debido. Cualquier cambio de cuenta bancaria deberá ser comunicado por EL ARRENDADOR por escrito, con al menos quince días de anticipación; mientras no medie dicha comunicación, los pagos efectuados en la cuenta previamente comunicada se reputan válidamente realizados y liberan a EL ARRENDATARIO.',
        'Los gastos y comisiones bancarias que genere la transferencia serán de cuenta de EL ARRENDATARIO, debiendo acreditarse en la cuenta de EL ARRENDADOR el valor íntegro del canon más el IVA, menos las retenciones legales que correspondan.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'garantia',
      titulo: 'GARANTÍA',
      texto: subnumerar([
        `A la suscripción del presente contrato, EL ARRENDATARIO entrega a EL ARRENDADOR la suma de ${d.dinero(
          'garantia',
        )}, en calidad de garantía del fiel cumplimiento de todas y cada una de las obligaciones asumidas en este instrumento. EL ARRENDADOR declara recibir dicho valor a su entera satisfacción, sirviendo la suscripción de este contrato como el recibo más amplio y suficiente.`,
        'La garantía no constituye anticipo ni pago de canon alguno, por lo que EL ARRENDATARIO no podrá imputarla al pago de los últimos meses de arrendamiento ni a ninguna otra mensualidad. La garantía no genera intereses a favor de EL ARRENDATARIO.',
        `A la terminación del contrato y previa entrega material del inmueble, EL ARRENDADOR devolverá la garantía a EL ARRENDATARIO dentro del plazo máximo de ${v(
          d,
          'garantiaDevolucionDias',
        )} días hábiles, deduciendo de ella, de ser el caso: (i) el costo de las reparaciones de daños al inmueble distintos del deterioro natural por el uso normal; y (ii) las multas o penalidades causadas conforme a este contrato. Si las deducciones superaren el monto de la garantía, EL ARRENDATARIO pagará la diferencia dentro de los diez días siguientes al requerimiento escrito.`,
        'La devolución de la garantía queda condicionada a la presentación, por parte de EL ARRENDATARIO, de los comprobantes que acrediten el pago íntegro de los servicios básicos y demás rubros a su cargo hasta la fecha de entrega del inmueble.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'servicios',
      titulo: 'SERVICIOS BÁSICOS, ALÍCUOTAS Y TRIBUTOS',
      texto: subnumerar([
        'Son de cuenta exclusiva de EL ARRENDATARIO, durante toda la vigencia del contrato, el pago puntual de los servicios de energía eléctrica, agua potable, telefonía, internet, recolección de basura y cualquier otro servicio que contrate o consuma en el inmueble arrendado.',
        'El impuesto predial, las contribuciones especiales de mejoras y los demás tributos que graven la propiedad del inmueble serán de cuenta exclusiva de EL ARRENDADOR.',
        alicuota === 'NO_APLICA'
          ? null
          : `Las alícuotas ordinarias de administración y mantenimiento que correspondan al inmueble serán de cuenta de ${
              alicuota === 'ARRENDADOR' ? 'EL ARRENDADOR' : 'EL ARRENDATARIO'
            }; las cuotas extraordinarias, de cuenta de EL ARRENDADOR.`,
        'Al inicio del contrato, las partes dejarán constancia de las lecturas de los medidores y del estado de cuenta de cada servicio. EL ARRENDATARIO deberá presentar a EL ARRENDADOR, cuando éste lo requiera, los comprobantes de pago de los servicios a su cargo.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'obligaciones-arrendatario',
      titulo: 'OBLIGACIONES DE EL ARRENDATARIO',
      texto: literales('Sin perjuicio de las demás obligaciones establecidas en este contrato y en la ley, EL ARRENDATARIO se obliga a:', [
        'pagar puntualmente el canon de arrendamiento más el IVA, en la forma y plazos pactados',
        'destinar el inmueble únicamente al uso convenido',
        'mantener el inmueble en buen estado de conservación, y efectuar a su costo las reparaciones locativas y todas aquellas que se deriven del uso del inmueble o de actos u omisiones suyos, de sus dependientes, clientes o visitantes',
        'informar a EL ARRENDADOR, dentro de las cuarenta y ocho horas de conocido, de todo daño, filtración, desperfecto estructural o hecho que amenace la integridad del inmueble',
        'restituir el inmueble, a la terminación del contrato, en el mismo estado en que lo recibió, salvo el deterioro natural derivado del uso normal',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'obligaciones-arrendador',
      titulo: 'OBLIGACIONES DE EL ARRENDADOR',
      texto: literales('Sin perjuicio de las demás obligaciones establecidas en este contrato y en la ley, EL ARRENDADOR se obliga a:', [
        `entregar el inmueble a EL ARRENDATARIO el ${v(d, 'fechaEntrega')}, en condiciones adecuadas para el uso convenido`,
        'garantizar a EL ARRENDATARIO el uso y goce pacífico del inmueble durante toda la vigencia del contrato',
        'efectuar a su costo las reparaciones necesarias que no sean locativas, en especial las que afecten a la estructura del inmueble, dentro de un plazo razonable desde la notificación de EL ARRENDATARIO',
        'emitir y entregar oportunamente la factura correspondiente a cada canon mensual',
        'mantenerse al día en el pago del impuesto predial y demás tributos y obligaciones que le corresponden como propietario',
        'notificar a EL ARRENDATARIO, con al menos treinta días de anticipación, cualquier acto de enajenación del inmueble, haciendo constar en el título correspondiente la obligación del adquirente de respetar íntegramente este contrato hasta su vencimiento',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'mejoras',
      titulo: 'MEJORAS Y ADECUACIONES',
      texto: subnumerar([
        'EL ARRENDATARIO podrá realizar en el inmueble las adecuaciones necesarias para el desarrollo de su actividad, previa autorización escrita de EL ARRENDADOR, la cual no podrá ser negada injustificadamente. Toda obra que comprometa la estructura, la fachada, la cubierta o las instalaciones matrices requerirá, además, el respaldo técnico y los permisos municipales que correspondan.',
        'Las mejoras adheridas de manera permanente al inmueble quedarán en beneficio de éste a la terminación del contrato, sin derecho a reembolso, indemnización ni retención alguna a favor de EL ARRENDATARIO, salvo pacto escrito en contrario.',
        'Las instalaciones, equipos, mobiliario y rótulos que puedan retirarse sin causar daño al inmueble podrán ser retirados por EL ARRENDATARIO a la terminación del contrato, quedando obligado a reparar a su costo cualquier deterioro que el retiro ocasione.',
        'EL ARRENDATARIO podrá instalar en las áreas arrendadas y en la fachada correspondiente a las mismas la rotulación y publicidad de las marcas que opere, previa obtención de los permisos municipales de publicidad exterior y aprobación de EL ARRENDADOR respecto de las dimensiones y del punto de anclaje. A la terminación del contrato, EL ARRENDATARIO retirará dicha rotulación y reparará los anclajes y la superficie afectada.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'actividad-gastronomica',
      titulo: 'OBLIGACIONES PROPIAS DE LA ACTIVIDAD GASTRONÓMICA',
      // Propia de un local de comida: no es una renuncia discutible, es un
      // caso particular. Apagada y sin nota.
      opcional: { activaPorDefecto: false },
      texto:
        'Atendiendo al giro señalado en la cláusula {{ref:destino}}, EL ARRENDATARIO se obliga a implementar y mantener, a su costo y conforme a la normativa técnica aplicable: sistemas de extracción y filtrado de olores y grasas; trampas de grasa en las descargas; instalaciones de gas centralizado con sus respectivas certificaciones; y sistemas de detección y extinción de incendios en las áreas de cocina. Los ductos de extracción que atraviesen la fachada, la cubierta o áreas comunes del edificio requerirán autorización de EL ARRENDADOR y, de ser el caso, de la autoridad municipal competente.',
    },
    {
      tipo: 'clausula',
      clave: 'cesion',
      titulo: 'PROHIBICIÓN DE CESIÓN Y SUBARRIENDO',
      texto: subnumerar([
        'Queda expresamente prohibido a EL ARRENDATARIO ceder, traspasar o subarrendar, total o parcialmente, el inmueble objeto de este contrato, así como transferir a cualquier título los derechos que de él emanan, sin la autorización previa y escrita de EL ARRENDADOR.',
        'En consecuencia, EL ARRENDATARIO no podrá, sin autorización previa y escrita de EL ARRENDADOR: (i) suscribir contrato alguno que transfiera a un tercero, incluido el titular de cualquiera de las marcas que opere, la explotación directa, la administración o la tenencia de todo o parte del inmueble; (ii) permitir que un tercero facture al público desde el inmueble en nombre propio; ni (iii) registrar el inmueble como domicilio, establecimiento o local de un tercero ante la autoridad tributaria o municipal. La autorización que EL ARRENDADOR llegare a otorgar para cualquiera de estos supuestos no liberará a EL ARRENDATARIO de sus obligaciones, salvo pacto escrito expreso en contrario.',
        'La infracción de lo dispuesto en esta cláusula constituye causal de terminación inmediata del contrato, sin perjuicio de las indemnizaciones a que hubiere lugar.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'terminacion',
      titulo: 'TERMINACIÓN DEL CONTRATO',
      texto: [
        literales('{{n}}.1. El presente contrato terminará por las siguientes causales:', [
          'por el vencimiento del plazo pactado en la cláusula {{ref:plazo}}',
          'por mutuo acuerdo escrito de las partes',
          'por falta de pago de dos o más cánones de arrendamiento consecutivos',
          'por destinar el inmueble a un uso distinto del convenido o a actividades ilícitas',
          'por cesión o subarriendo no autorizados, conforme a la cláusula {{ref:cesion}}',
          'por daños graves causados al inmueble por dolo o culpa de EL ARRENDATARIO, o por obras no autorizadas que comprometan su estructura',
          'por destrucción total o parcial del inmueble que impida su uso',
          'por las demás causales previstas en la ley',
        ]),
        `{{n}}.2. Si EL ARRENDATARIO diere por terminado unilateralmente el contrato antes del vencimiento del plazo, sin causa legal imputable a EL ARRENDADOR, deberá notificarlo por escrito con noventa días de anticipación y pagar, a título de indemnización, el equivalente a ${canones(
          d,
          'indemnizacionArrendatario',
        )} vigentes a la fecha de la terminación, sin perjuicio de la liquidación de los valores adeudados hasta la entrega efectiva del inmueble. EL ARRENDADOR podrá imputar la garantía a esta indemnización.`,
        `{{n}}.3. Si EL ARRENDADOR diere por terminado unilateralmente el contrato antes del vencimiento del plazo, sin causa legal imputable a EL ARRENDATARIO, pagará a éste, a título de indemnización, el equivalente a ${canones(
          d,
          'indemnizacionArrendador',
        )} vigentes a la fecha de la terminación, además de la devolución íntegra e inmediata de la garantía.`,
      ].join('\n'),
    },
    desalojo(d, DEN),
    {
      tipo: 'clausula',
      clave: 'entrega',
      titulo: 'ENTREGA Y RESTITUCIÓN DEL INMUEBLE',
      texto: subnumerar([
        `La entrega material del inmueble se efectuará el ${v(
          d,
          'fechaEntrega',
        )}, mediante acta en la que se dejará constancia del estado de la infraestructura, acabados, instalaciones, llaves entregadas y lecturas de medidores.`,
        'A la terminación del contrato, por cualquier causa, EL ARRENDATARIO restituirá el inmueble a EL ARRENDADOR completamente desocupado de personas y bienes, en el mismo estado en que lo recibió, salvo el deterioro natural por el uso normal, y con los servicios básicos y demás rubros a su cargo íntegramente pagados.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'fuerza-mayor',
      titulo: 'CASO FORTUITO Y FUERZA MAYOR',
      texto: subnumerar([
        'Ninguna de las partes será responsable por el incumplimiento de sus obligaciones, salvo las de carácter pecuniario ya causadas, cuando éste obedezca a caso fortuito o fuerza mayor debidamente comprobados, conforme a la ley.',
        'Si por tales causas el inmueble resultare total o parcialmente inutilizable para el destino convenido, las partes acordarán por escrito la suspensión o reducción proporcional del canon mientras dure el impedimento; de prolongarse éste por más de noventa días, cualquiera de las partes podrá dar por terminado el contrato sin responsabilidad ni indemnización.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'notificaciones',
      titulo: 'DOMICILIO Y NOTIFICACIONES',
      texto: subnumerar([
        'Para todos los efectos de este contrato, las partes señalan como sus domicilios y direcciones de notificación los indicados en la comparecencia, incluidas las direcciones de correo electrónico allí consignadas, las cuales se reputan válidas y suficientes para toda comunicación entre las partes.',
        'Todo cambio de domicilio, teléfono o correo electrónico deberá ser notificado por escrito a la otra parte dentro de los cinco días siguientes; mientras ello no ocurra, las notificaciones cursadas a las direcciones aquí señaladas surtirán plenos efectos.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'controversias',
      titulo: 'CONTROVERSIAS',
      texto: subnumerar([
        'Las partes se comprometen a resolver de buena fe, mediante trato directo, cualquier divergencia derivada de la interpretación, ejecución o terminación de este contrato.',
        `De no lograrse un acuerdo directo dentro de los quince días siguientes a la notificación de la controversia, las partes se someterán a un proceso de mediación en el Centro de Mediación de la Cámara de Comercio de ${ciudad}, y el acta de mediación tendrá efecto de sentencia ejecutoriada y cosa juzgada.`,
        `De no llegarse a acuerdo en mediación, las partes se someten a la jurisdicción de los jueces competentes de la ciudad de ${ciudad} y al procedimiento que corresponda según la ley, renunciando a fuero y domicilio.`,
      ]),
    },
    tituloEjecutivo(),
    {
      tipo: 'clausula',
      clave: 'aceptacion',
      titulo: 'ACEPTACIÓN',
      texto: `Las partes comparecientes, luego de haber leído íntegramente el presente contrato y de haber comprendido su alcance, contenido y efectos, lo aceptan en todas y cada una de sus cláusulas y se ratifican en él, suscribiéndolo en tres ejemplares de igual tenor y valor, en la ciudad de ${canton}, en la fecha indicada al inicio.`,
    },

    { tipo: 'firmas' },
  ];
}

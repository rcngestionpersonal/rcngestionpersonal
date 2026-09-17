// ===========================================================================
// ARRENDAMIENTO INDUSTRIAL / BODEGA — v1-2026-09
//
// Base: un contrato real de arrendamiento de bodegas entre compañías, sin sus
// datos. Aporta lo que los otros no tienen: comparecencia entre compañías con
// su representante, descripción técnica del inmueble, área de maniobras, rubro
// de guardianía y limpieza separado del canon, fuerza mayor con sus cinco
// supuestos, derecho de inspección con aviso, terminación por insolvencia o
// concurso preventivo y prohibición de inflamables y explosivos.
//
// Correcciones sobre la base: numeración correlativa (saltaba de la décima a la
// décima segunda), sin número de cuenta bancaria, sin cita del Código Civil, y
// el ingreso de interesados ya no depende de un "aviso de desahucio" sino de los
// días finales del contrato.
// ===========================================================================

import type { BloqueDocumento, DatosDocumento } from './base';
import {
  comparecencia,
  controversiasTexto,
  desalojo,
  literales,
  renunciaCanon,
  renunciaDesahucio,
  subnumerar,
  tituloEjecutivo,
  v,
  type Denominaciones,
} from './arrendamiento-comun-v1';

export const PLANTILLA_VERSION = 'arrendamiento-industrial-v1-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = true;
export const AVISO_PLANTILLA_SIN_REVISAR = '';

const DEN: Denominaciones = { arrendador: 'LA ARRENDADORA', arrendatario: 'LA ARRENDATARIA' };

const TITULO_POR_TIPO: Record<string, string> = {
  BODEGA: 'CONTRATO DE ARRENDAMIENTO DE BODEGA',
  GALPON: 'CONTRATO DE ARRENDAMIENTO DE GALPÓN',
  NAVE: 'CONTRATO DE ARRENDAMIENTO DE NAVE INDUSTRIAL',
};

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const parroquia = d.campo('inmuebleParroquia');
  const oficina = d.campo('areaOficina');
  const altillo = d.campo('areaAltillo');
  const vestidores = d.campo('vestidores');
  const suministro = d.campo('suministroElectrico');
  const maniobras = d.campo('areaManiobras');
  const rubro = d.campo('rubroAdicional');
  const reajuste = d.campo('reajusteAnual');
  const garantiaCanones = d.campo('garantiaCanones');
  const sustancias = d.campo('sustanciasPermitidas');

  const cubierta = [
    `área total cubierta de ${v(d, 'areaCubierta')} m²`,
    oficina || altillo
      ? `que comprende ${[oficina ? `una oficina de ${oficina} m²` : null, altillo ? `un altillo de ${altillo} m²` : null].filter(Boolean).join(' y ')}`
      : null,
  ]
    .filter(Boolean)
    .join(', ');
  const instalaciones = [
    'instalaciones eléctricas e iluminación',
    suministro ? `suministro eléctrico ${suministro}` : null,
    d.campo('generador') === 'SI' ? 'generador de emergencia' : null,
    d.campo('redHidrica') === 'NO' ? null : 'agua potable y red hídrica',
  ]
    .filter(Boolean)
    .join(', ');

  return [
    { tipo: 'titulo', texto: TITULO_POR_TIPO[d.campo('tipoInmueble')] ?? TITULO_POR_TIPO.BODEGA },
    ...comparecencia(d, DEN),

    {
      tipo: 'clausula',
      clave: 'antecedentes',
      titulo: 'ANTECEDENTES',
      texto: subnumerar([
        `LA ARRENDADORA es propietaria de ${v(d, 'inmuebleDescripcion')}, ubicado en ${v(d, 'inmuebleDireccion')}${
          parroquia ? `, parroquia ${parroquia}` : ''
        }, en la ciudad de ${v(d, 'inmuebleCiudad')}.`,
        `LA ARRENDATARIA es ${v(d, 'actividadArrendataria').replace(/\.$/, '')}, que requiere las instalaciones antes referidas para su uso como ${v(
          d,
          'usoPrevisto',
        ).replace(/\.$/, '')}.`,
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'objeto',
      titulo: 'OBJETO Y DESCRIPCIÓN TÉCNICA',
      texto: literales(
        `Con base en los antecedentes enunciados, LA ARRENDADORA entrega en arrendamiento a LA ARRENDATARIA el inmueble destinado exclusivamente a ${v(
          d,
          'usoPrevisto',
        ).replace(/\.$/, '')}, de acuerdo al siguiente detalle:`,
        [
          cubierta,
          vestidores ? vestidores.replace(/\.$/, '') : null,
          instalaciones,
          maniobras
            ? `área exterior de maniobras de ${maniobras} m², para estacionamiento, carga y descarga, de uso ${
                d.campo('maniobrasUso') === 'COMPARTIDO' ? 'compartido' : 'exclusivo'
              } de LA ARRENDATARIA`
            : null,
        ],
      ),
    },
    {
      tipo: 'clausula',
      clave: 'canon',
      titulo: 'CANON',
      texto: subnumerar([
        `Las partes, de común acuerdo, fijan el canon mensual de arrendamiento en ${d.dinero(
          'canon',
        )}, más el Impuesto al Valor Agregado a la tarifa vigente, pagadero por mensualidades anticipadas dentro de los ${v(
          d,
          'diaPago',
        )} primeros días de cada mes, mediante transferencia o depósito a la cuenta que LA ARRENDADORA comunique por escrito.`,
        'LA ARRENDADORA emitirá la factura electrónica correspondiente a cada canon. Si LA ARRENDATARIA tiene la calidad de agente de retención, efectuará las retenciones que legalmente correspondan y entregará los comprobantes respectivos; los valores retenidos se imputarán al pago.',
        reajuste ? `A partir del primer aniversario del contrato, el canon se reajustará en un ${reajuste}% anual.` : null,
      ]),
    },
    renunciaCanon(DEN),
    {
      tipo: 'clausula',
      clave: 'rubros',
      titulo: rubro ? 'GUARDIANÍA, LIMPIEZA Y SERVICIOS' : 'SERVICIOS',
      texto: rubro
        ? subnumerar([
            `Además del canon, y por separado, LA ARRENDATARIA pagará mensualmente la suma de ${d.dinero(
              'rubroAdicional',
            )} por concepto de ${v(d, 'rubroConceptos').replace(/\.$/, '')}, junto con el canon.`,
            'Los consumos de energía eléctrica, agua potable y telefonía del área arrendada serán de cuenta de LA ARRENDATARIA.',
          ])
        : 'Los consumos de energía eléctrica, agua potable y telefonía del área arrendada serán de cuenta de LA ARRENDATARIA.',
    },
    {
      tipo: 'clausula',
      clave: 'garantia',
      titulo: 'GARANTÍA',
      texto: `LA ARRENDATARIA entrega un depósito de garantía de ${d.dinero('garantia')}${
        garantiaCanones ? `, equivalente a ${garantiaCanones} ${garantiaCanones === '1' ? 'canon' : 'cánones'} de arrendamiento` : ''
      }, destinado a cubrir cualquier daño al inmueble y el cumplimiento de sus obligaciones. Este valor no podrá utilizarse para el pago de cánones impagos. Su devolución, dentro de los ${v(
        d,
        'garantiaDevolucionDias',
      )} días siguientes a la restitución, estará sujeta a la entrega del inmueble en las mismas condiciones en que fue recibido, salvo el deterioro normal por el uso, previa deducción de los valores que correspondan.`,
    },
    {
      tipo: 'clausula',
      clave: 'plazo',
      titulo: 'PLAZO',
      texto: `Sin perjuicio de la fecha de su suscripción, la duración del presente contrato es de ${v(d, 'plazoTexto')}, forzoso para las partes, desde el ${v(
        d,
        'fechaInicio',
      )} hasta el ${v(d, 'fechaFin')}. Si las partes decidieren prorrogarlo o renovarlo, deberán acordarlo por escrito, estipulando las nuevas condiciones.`,
    },
    renunciaDesahucio(),
    {
      tipo: 'clausula',
      clave: 'entrega',
      titulo: 'ENTREGA, ESTADO DEL INMUEBLE Y MEJORAS',
      texto: subnumerar([
        `LA ARRENDATARIA deja constancia expresa de que recibe el inmueble${
          maniobras ? ' y el área de maniobras' : ''
        } en el estado que consta en el acta de entrega-recepción que las partes suscriben en este mismo acto y que forma parte integrante de este contrato, y se compromete a devolverlo en el mismo estado, salvo el deterioro proveniente del uso normal.`,
        `Toda mejora o modificación que LA ARRENDATARIA quiera introducir en el inmueble, sus equipos e instalaciones solo podrá realizarse previo aviso y aprobación escrita de LA ARRENDADORA, que expresará su decisión dentro de los ${v(
          d,
          'respuestaMejorasDias',
        )} días siguientes a la solicitud. Las mejoras no darán derecho a LA ARRENDATARIA a exigir compensación ni reembolso alguno.`,
        'Serán de cuenta de LA ARRENDATARIA los tributos relacionados con su actividad, y de cuenta de LA ARRENDADORA los que graven el inmueble como tal.',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'uso',
      titulo: 'USO, PERMISOS Y SEGURIDAD',
      texto: subnumerar([
        'LA ARRENDATARIA destinará el inmueble exclusivamente al uso pactado y obtendrá y mantendrá vigentes, a su costo, los permisos municipales, de bomberos y demás que requiera su actividad.',
        `Queda prohibido introducir al inmueble${
          maniobras ? ' o al área de maniobras' : ''
        } sustancias inflamables o explosivas que puedan poner en peligro la seguridad del inmueble, así como la vida y los bienes de sus ocupantes${
          sustancias ? `, salvo las propias de su actividad que se detallan a continuación, almacenadas conforme a la normativa aplicable: ${sustancias.replace(/\.$/, '')}` : ''
        }.`,
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'inspeccion',
      titulo: 'DERECHO DE INSPECCIÓN E INGRESO DE LA ARRENDADORA',
      texto: subnumerar([
        'LA ARRENDADORA tiene derecho a inspeccionar el inmueble durante las horas hábiles de trabajo, previa notificación escrita dirigida a los representantes legales de LA ARRENDATARIA y en presencia de un representante de ésta, para constatar su buen mantenimiento. Este derecho podrá ejercerlo personalmente o por intermedio de un representante autorizado.',
        `Durante los ${v(
          d,
          'ingresoInteresadosDias',
        )} días anteriores a la terminación del contrato, LA ARRENDATARIA permitirá, con el mismo aviso y durante las horas hábiles, el ingreso de personas interesadas en arrendar el inmueble.`,
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'fuerza-mayor',
      titulo: 'FUERZA MAYOR Y CASO FORTUITO',
      texto: [
        literales(
          '{{n}}.1. Ninguna de las partes será responsable, ni se le considerará incumplida, como resultado de una falla, demora o incumplimiento de sus obligaciones causado por circunstancias imprevisibles e inevitables, fuera de su control razonable, incluyendo condiciones meteorológicas severas, actos de autoridad, huelgas, paros, actos de guerra, motines, sabotaje, incendios, inundaciones, explosiones incluidas las de tipo volcánico, embargos, hostilidades, alborotos civiles, levantamientos, acciones militares, guerrilleras o terroristas o amenazas de ellas, vandalismo y cualquier otro hecho que la ley califique como fuerza mayor o caso fortuito, siempre que:',
          [
            'la parte que alegue la fuerza mayor dé a la otra, dentro de las cuarenta y ocho horas siguientes, aviso por escrito detallando las circunstancias del evento',
            'la suspensión del cumplimiento de los términos del contrato se produzca como consecuencia de la fuerza mayor',
            'la parte que la alegue use sus mejores esfuerzos para remediar su incapacidad de cumplir',
            'en cuanto pueda reasumir sus obligaciones, la parte afectada lo comunique lo antes posible por escrito a la otra',
            'la fuerza mayor no haya sido causada por, ni esté relacionada con, negligencia grave o conducta intencional, errores u omisiones de la parte que la alegue',
          ],
        ),
        '{{n}}.2. No podrá alegar caso fortuito ni fuerza mayor la parte que se hubiere encontrado en mora en el cumplimiento de sus obligaciones antes de que el hecho sobreviniera, o cuando éste se haya producido por su propia culpa.',
        `{{n}}.3. Si el inmueble quedare inutilizable para el uso pactado, las partes acordarán por escrito la suspensión o reducción proporcional del canon mientras dure el impedimento; si éste se prolongare por más de ${v(
          d,
          'inutilizableDias',
        )} días, cualquiera de las partes podrá dar por terminado el contrato sin indemnización.`,
      ].join('\n'),
    },
    {
      tipo: 'clausula',
      clave: 'terminacion',
      titulo: 'TERMINACIÓN',
      texto: literales(
        'Son causales de terminación del contrato, además de las contempladas en la ley, los siguientes hechos:',
        [
          'la falta de pago de dos mensualidades de arrendamiento consecutivas',
          `el cambio de destino del inmueble${maniobras ? ' o del área de maniobras' : ''}`,
          `la realización de modificaciones o mejoras en el inmueble${maniobras ? ' o en el área de maniobras' : ''} sin el consentimiento previo y por escrito de LA ARRENDADORA`,
          'el subarriendo o la cesión, total o parcial, del inmueble',
          'la introducción de sustancias prohibidas conforme a la cláusula {{ref:uso}}',
          'que LA ARRENDATARIA fuere declarada en insolvencia o quiebra, se encontrare en cesación de pagos, o hubiere solicitado ser admitida a un proceso de concurso preventivo, o que esta solicitud hubiere sido presentada por algún acreedor suyo',
        ],
        'En tales casos, LA ARRENDADORA podrá dar por terminado el contrato y exigir el pago de los valores vencidos, la indemnización que corresponda y la restitución del inmueble, conforme a la ley.',
      ),
    },
    desalojo(d, DEN),
    {
      tipo: 'clausula',
      clave: 'controversias',
      titulo: 'RESOLUCIÓN DE CONTROVERSIAS',
      texto: `Las partes convienen en que el presente contrato será cumplido de buena fe y que cualquier controversia tratará de ser resuelta por ellas con el mismo espíritu y de mutuo acuerdo. ${controversiasTexto(
        d,
        d.campo('numeroArbitros') === 'TRES' ? 'TRES' : 'UNO',
      )}`,
    },
    {
      tipo: 'clausula',
      clave: 'modificaciones',
      titulo: 'MODIFICACIONES Y NOTIFICACIONES',
      texto:
        'Los cambios o complementos de este contrato que se realicen con posterioridad a su celebración serán válidos solamente si se los acuerda por escrito. Las notificaciones entre las partes se dirigirán a los domicilios y correos electrónicos indicados en la comparecencia, a la atención de sus representantes legales.',
    },
    tituloEjecutivo(),
    {
      tipo: 'clausula',
      clave: 'aceptacion',
      titulo: 'ACEPTACIÓN',
      texto: `Las partes aceptan y se ratifican en todas las cláusulas de este contrato, y declaran que la nulidad de alguna de ellas no afectará la validez de las demás. Para constancia, lo suscriben por triplicado en la ciudad de ${v(
        d,
        'inmuebleCiudad',
      )}, en la fecha indicada al inicio.`,
    },

    { tipo: 'firmas' },
  ];
}

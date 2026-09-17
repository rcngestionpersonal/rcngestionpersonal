// ===========================================================================
// ARRENDAMIENTO RESIDENCIAL — v1-2026-09
//
// Base: un contrato de arrendamiento de vivienda real, conciso, combinado con
// la estructura de un formato de una asociación de corredores. Sin sus datos,
// sin las guías entre paréntesis del formato y sin número de cuenta bancaria:
// el pago va a la cuenta que el arrendador comunique por escrito.
//
// Doce cláusulas. Las cuatro renuncias de validez discutible existen como
// opcionales apagadas, junto a la cláusula a la que se refieren.
// ===========================================================================

import { opcional, type BloqueDocumento, type DatosDocumento } from './base';
import {
  comparecencia,
  controversiasTexto,
  desalojo,
  literales,
  renunciaCanon,
  renunciaDesahucio,
  tituloEjecutivo,
  v,
  type Denominaciones,
} from './arrendamiento-comun-v1';

export const PLANTILLA_VERSION = 'arrendamiento-residencial-v1-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = true;
export const AVISO_PLANTILLA_SIN_REVISAR = '';

const DEN: Denominaciones = { arrendador: 'EL ARRENDADOR', arrendatario: 'EL ARRENDATARIO' };

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const alicuota = d.campo('alicuota') || 'ARRENDATARIO';
  const edificio = d.campo('inmuebleEdificio');
  const hayAdministracion = Boolean(edificio) || alicuota !== 'NO_APLICA';
  const delEdificio = edificio ? `del ${edificio}` : 'del edificio o conjunto';
  const parroquia = d.campo('inmuebleParroquia');
  const titulo = d.campo('tituloPropiedad');
  const ocupantes = d.campo('ocupantesMaximo');
  const pagadosHasta = d.campo('serviciosPagadosHasta');
  const reajuste = d.campo('reajusteAnual');
  const indemnizacion = Number(d.campo('indemnizacionCanones') || 0);

  return [
    { tipo: 'titulo', texto: 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA' },
    ...comparecencia(d, DEN),

    {
      tipo: 'clausula',
      clave: 'antecedentes',
      titulo: 'ANTECEDENTES',
      texto: `EL ARRENDADOR es propietario del inmueble que consiste en ${v(d, 'inmuebleDescripcion')}, ubicado en ${v(
        d,
        'inmuebleDireccion',
      )}${edificio ? `, ${edificio}` : ''}${parroquia ? `, parroquia ${parroquia}` : ''}, ciudad de ${v(d, 'inmuebleCiudad')}, provincia de ${v(
        d,
        'inmuebleProvincia',
      )}.${titulo ? ` El inmueble fue adquirido mediante ${titulo.replace(/\.$/, '')}.` : ''}`,
    },
    {
      tipo: 'clausula',
      clave: 'objeto',
      titulo: 'OBJETO Y ESTADO DEL INMUEBLE',
      texto: `Con estos antecedentes, EL ARRENDADOR da en arrendamiento a EL ARRENDATARIO el inmueble descrito en la cláusula {{ref:antecedentes}}, que se entrega ${v(
        d,
        'estadoEntrega',
      )}, con sus instalaciones eléctricas y sanitarias en funcionamiento.${
        d.campo('amoblado') === 'SI'
          ? ' Se incluyen los bienes muebles detallados en el inventario que las partes suscriben por separado y que forma parte de este contrato.'
          : ''
      }${pagadosHasta ? ` Los servicios básicos se encuentran pagados hasta ${pagadosHasta}.` : ''}`,
    },
    {
      tipo: 'clausula',
      clave: 'destino',
      titulo: 'DESTINO Y PROHIBICIÓN DE SUBARRIENDO',
      texto: `El inmueble se destinará única y exclusivamente a vivienda${
        ocupantes ? ` de hasta ${ocupantes} personas` : ''
      }. EL ARRENDATARIO no podrá destinarlo a otro fin, ni subarrendarlo, cederlo o permitir su uso a terceros, total o parcialmente, sin autorización previa y escrita de EL ARRENDADOR.`,
    },
    {
      tipo: 'clausula',
      clave: 'canon',
      titulo: 'CANON',
      texto: `Las partes pactan un canon mensual de ${d.dinero('canon')}${
        alicuota === 'INCLUIDA' ? ', que incluye la alícuota ordinaria de administración' : alicuota === 'ARRENDATARIO' ? ', que no incluye la alícuota ordinaria de administración' : ''
      }. EL ARRENDATARIO lo pagará por mensualidades anticipadas, dentro de los ${v(
        d,
        'diaPago',
      )} primeros días de cada mes, mediante transferencia o depósito a la cuenta que EL ARRENDADOR le comunique por escrito. El comprobante de pago constituye prueba suficiente del mismo.${
        reajuste ? ` A partir del primer aniversario del contrato, el canon se reajustará en un ${reajuste}% anual.` : ''
      }`,
    },
    renunciaCanon(DEN),
    {
      tipo: 'clausula',
      clave: 'alicuotas',
      titulo: hayAdministracion ? 'ALÍCUOTAS Y SERVICIOS' : 'SERVICIOS',
      texto: [
        alicuota === 'INCLUIDA'
          ? `La alícuota ordinaria mensual fijada por la administración ${delEdificio} está incluida en el canon y será pagada por EL ARRENDADOR.`
          : alicuota === 'ARRENDATARIO'
            ? `La alícuota ordinaria mensual fijada por la administración ${delEdificio} será de cuenta de EL ARRENDATARIO.`
            : '',
        alicuota !== 'NO_APLICA' ? 'Las cuotas extraordinarias serán de cuenta de EL ARRENDADOR.' : '',
        'Los consumos de energía eléctrica, agua potable, internet, telefonía y demás servicios que se utilicen o contraten en el inmueble serán de cuenta exclusiva de EL ARRENDATARIO.',
      ]
        .filter(Boolean)
        .join(' '),
    },
    {
      tipo: 'clausula',
      clave: 'garantia',
      titulo: 'GARANTÍA',
      texto: literales(
        `EL ARRENDATARIO entrega a EL ARRENDADOR la suma de ${d.dinero(
          'garantia',
        )} en garantía del cumplimiento de sus obligaciones, incluido el pago de cánones, alícuotas y servicios a su cargo, y la reparación de daños distintos del deterioro normal por el uso. La garantía no genera intereses ni podrá imputarse al pago de cánones. EL ARRENDADOR la devolverá dentro de los ${v(
          d,
          'garantiaDevolucionDias',
        )} días siguientes a la restitución del inmueble, siempre que:`,
        [
          'el inmueble se entregue en el estado en que se recibió, salvo el deterioro normal por el uso',
          `EL ARRENDATARIO haya pagado los cánones${alicuota === 'ARRENDATARIO' ? ', alícuotas' : ''} y servicios a su cargo hasta la fecha de desocupación`,
          'no existan daños pendientes de reparación',
        ],
        'Si hubiere daños, EL ARRENDADOR podrá descontar su costo de la garantía, entregando a EL ARRENDATARIO el detalle de los gastos. Si la garantía no alcanzare, EL ARRENDATARIO pagará la diferencia dentro de los diez días siguientes al requerimiento escrito.',
      ),
    },
    {
      tipo: 'clausula',
      clave: 'plazo',
      titulo: 'PLAZO, RENOVACIÓN Y TERMINACIÓN ANTICIPADA',
      texto: `El plazo de este contrato es de ${v(d, 'plazoMeses')} meses contados desde el ${v(
        d,
        'fechaInicio',
      )}. Las partes podrán renovarlo por acuerdo escrito, que procurarán alcanzar con al menos ${v(
        d,
        'renovacionAvisoDias',
      )} días de anticipación al vencimiento. Si EL ARRENDATARIO decidiere desocupar el inmueble antes del vencimiento, lo comunicará por escrito con al menos ${v(
        d,
        'desocupacionAvisoDias',
      )} días de anticipación${indemnizacion > 0 ? ` y pagará, a título de indemnización, ${indemnizacion} ${indemnizacion === 1 ? 'canon mensual' : 'cánones mensuales'}` : ''}.`,
    },
    renunciaDesahucio(),
    {
      tipo: 'clausula',
      clave: 'obligaciones',
      titulo: 'OBLIGACIONES DE EL ARRENDATARIO',
      texto: literales('EL ARRENDATARIO se obliga a:', [
        'usar el inmueble con el cuidado debido, respetando las normas de convivencia y la tranquilidad de los vecinos',
        hayAdministracion ? `cumplir el reglamento interno ${delEdificio} y las disposiciones de su administración` : null,
        'efectuar a su costo las reparaciones locativas y las de los daños que causen él o las personas que lo visiten',
        'no cambiar cerraduras ni instalar seguridades sin autorización de EL ARRENDADOR',
        'permitir que EL ARRENDADOR, o quien éste designe por escrito, visite el inmueble previo aviso con al menos veinticuatro horas de anticipación, para verificar su estado o mostrarlo a posibles compradores o arrendatarios',
        'restituir el inmueble a la terminación del contrato, con todas sus llaves y controles, en el estado en que lo recibió, salvo el deterioro normal por el uso',
      ]),
    },
    {
      tipo: 'clausula',
      clave: 'mejoras',
      titulo: 'MEJORAS',
      texto:
        'EL ARRENDATARIO no podrá efectuar cambios ni obras en el inmueble sin autorización escrita de EL ARRENDADOR. Las mejoras autorizadas quedarán en beneficio del inmueble sin que EL ARRENDADOR deba reconocer valor alguno, salvo que al autorizarlas se haya pactado por escrito su retiro, en cuyo caso EL ARRENDATARIO devolverá el inmueble en su estado original.',
    },
    {
      tipo: 'clausula',
      clave: 'terminacion',
      titulo: 'TERMINACIÓN',
      texto: literales(
        'Además de las causales previstas en la ley, serán causales para que EL ARRENDADOR dé por terminado el contrato:',
        [
          'la falta de pago de dos cánones mensuales consecutivos',
          `la falta de pago de dos meses consecutivos de ${alicuota === 'ARRENDATARIO' ? 'alícuotas o ' : ''}servicios a cargo de EL ARRENDATARIO`,
          'destinar el inmueble a un uso distinto del pactado, o subarrendarlo o cederlo sin autorización',
          'causar daños graves al inmueble o realizar obras no autorizadas',
          hayAdministracion ? 'el incumplimiento reiterado del reglamento interno que genere sanciones de la administración' : null,
        ],
        'La terminación del contrato y la restitución del inmueble se tramitarán conforme a la normativa vigente.',
      ),
    },
    desalojo(d, DEN),
    {
      tipo: 'clausula',
      clave: 'controversias',
      titulo: 'CONTROVERSIAS Y NOTIFICACIONES',
      texto: `Las partes procurarán resolver de buena fe cualquier divergencia sobre la interpretación o ejecución de este contrato. ${controversiasTexto(
        d,
      )} Para todo efecto, las partes señalan como domicilios y correos electrónicos de notificación los indicados en la comparecencia; cualquier cambio deberá comunicarse por escrito.`,
    },
    tituloEjecutivo(),
    {
      tipo: 'clausula',
      clave: 'aceptacion',
      titulo: 'ACEPTACIÓN',
      texto: `Las partes aceptan y se ratifican en todas las cláusulas de este contrato. Si alguna de ellas fuere declarada nula, las demás conservarán su validez. En constancia, lo suscriben en tres ejemplares de igual tenor y valor, en la ciudad de ${opcional(
        d.campo('inmuebleCiudad') || d.ciudad,
      )}, en la fecha indicada al inicio.`,
    },

    { tipo: 'firmas' },
  ];
}

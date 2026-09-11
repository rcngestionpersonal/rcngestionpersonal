// ===========================================================================
// ARRENDAMIENTO — v3-2026-09
//
// Redacción propia, elaborada sobre la base de formatos de uso común entre
// asociaciones de corredores de bienes raíces del Ecuador. No reproduce el
// texto de ningún documento concreto ni menciona entidad alguna.
//
// LO QUE DELIBERADAMENTE NO CONTIENE, y no debe añadirse:
//   - Renuncia al trámite de desahucio.
//   - Facultad del arrendador de desalojar bienes por cuenta propia.
//   - Renuncia a los cánones fijados por la autoridad municipal.
//   - Renuncia a la jurisdicción ordinaria.
// Son derechos irrenunciables bajo la Ley de Inquilinato: incluirlos no
// fortalece el contrato, lo debilita, porque una cláusula inaplicable arrastra
// consigo la credibilidad del resto. En su lugar, la terminación remite a la
// normativa vigente y las controversias a mediación previa.
//
// Numeración correlativa, sin saltos: las catorce cláusulas se emiten siempre.
// ===========================================================================

import { opcional, type BloqueDocumento, type DatosDocumento } from './base';

export const PLANTILLA_VERSION = 'arrendamiento-v3-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = true;
export const AVISO_PLANTILLA_SIN_REVISAR = '';

function persona(d: DatosDocumento, rol: string): string {
  const profesion = d.campo(`${rol}_profesion`);
  return [
    d.campo(`${rol}_nombre`),
    `portador de la cédula N.º ${d.campo(`${rol}_cedula`)}`,
    profesion ? `de profesión ${profesion}` : null,
    `domiciliado en ${d.campo(`${rol}_direccion`)}`,
    d.campo(`${rol}_parroquia`) ? `parroquia ${d.campo(`${rol}_parroquia`)}` : null,
    d.campo(`${rol}_ciudad`) ? `ciudad de ${d.campo(`${rol}_ciudad`)}` : null,
    `teléfono ${d.campo(`${rol}_telefono`)}`,
    `correo electrónico ${d.campo(`${rol}_correo`)}`,
  ]
    .filter(Boolean)
    .join(', ');
}

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const destino = d.opcion('destino');
  const esComercial = d.campo('destino') !== 'VIVIENDA';
  const incluyeAlicuotas = d.campo('canonIncluyeAlicuotas') === 'SI';
  const cuenta = d.campo('cuentaBancaria');
  const ciudad = d.campo('ciudadJurisdiccion') || d.ciudad;

  const bloques: BloqueDocumento[] = [
    { tipo: 'titulo', texto: `CONTRATO DE ARRENDAMIENTO · ${destino.toUpperCase()}` },

    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },

    {
      tipo: 'clausula',
      titulo: 'COMPARECIENTES',
      texto: `EL ARRENDADOR: ${persona(d, 'arrendador')}. EL ARRENDATARIO: ${persona(
        d,
        'arrendatario',
      )}. Las partes, libres y voluntariamente, convienen en celebrar el presente contrato de arrendamiento.`,
    },
    {
      tipo: 'clausula',
      titulo: 'ANTECEDENTES',
      texto: `El Arrendador es propietario del inmueble ubicado en ${d.campo('inmuebleDireccion')}, parroquia ${opcional(
        d.campo('inmuebleParroquia'),
      )}, cantón ${d.campo('inmuebleCanton')}, provincia ${d.campo(
        'inmuebleProvincia',
      )}. Su título de dominio consta en la escritura otorgada el ${opcional(
        d.campo('tituloFecha'),
      )} ante la Notaría ${opcional(d.campo('tituloNotaria'))} del cantón ${opcional(
        d.campo('tituloCanton'),
      )}, inscrita en el Registro de la Propiedad ${opcional(
        d.campo('tituloInscripcion'),
      )}. El Arrendador declara estar facultado para arrendar el inmueble y que éste se encuentra libre de gravámenes que lo impidan.`,
    },
    {
      tipo: 'clausula',
      titulo: 'OBJETO Y CARACTERÍSTICAS DEL INMUEBLE',
      texto: `El Arrendador entrega en arrendamiento al Arrendatario el inmueble descrito, que se compone de: ${d.campo(
        'espacios',
      )}. Estado de mantenimiento a la entrega: ${opcional(d.campo('estadoMantenimiento'))}. Servicios con que cuenta: ${opcional(
        d.campo('servicios'),
      )}. Áreas comunales de uso permitido: ${opcional(d.campo('areasComunales'))}. Equipos que se entregan y su estado: ${opcional(
        d.campo('equipos'),
      )}. Si el inmueble se entrega amoblado, el inventario de bienes consta como anexo y forma parte integrante de este contrato: ${opcional(
        d.campo('inventario'),
      )}. El Arrendatario declara haber inspeccionado el inmueble y recibirlo a satisfacción en el estado descrito.`,
    },
    {
      tipo: 'clausula',
      titulo: 'DESTINO Y USO',
      texto: `El inmueble se destina exclusivamente a ${destino}, y será ocupado por ${d.campo(
        'numeroOcupantes',
      )} personas. El Arrendatario no podrá variar el destino ni dedicarlo a actividad distinta sin autorización escrita del Arrendador.${
        esComercial
          ? ' Corresponde al Arrendatario obtener y mantener vigentes los permisos, patentes y licencias que la actividad requiera, y cumplir la normativa aplicable. El Arrendador no responde por la negativa o la demora de la autoridad en concederlos.'
          : ''
      }`,
    },
    {
      tipo: 'clausula',
      titulo: 'VISITAS DEL ARRENDADOR',
      texto: `El Arrendador podrá inspeccionar el inmueble durante la vigencia, previo aviso al Arrendatario con al menos ${d.campo(
        'visitaAvisoHoras',
      )} horas de anticipación y en horario razonable. Las visitas se realizarán sin perturbar el uso pacífico del inmueble.`,
    },
    {
      tipo: 'clausula',
      titulo: 'PLAZO, RENOVACIÓN Y ENTREGA AL VENCIMIENTO',
      texto: `El plazo es de ${d.campo('plazoMeses')} meses, contados desde el ${d.campo(
        'fechaInicio',
      )}. Su renovación se sujeta a la normativa vigente y a lo que las partes acuerden por escrito. Al vencimiento, el Arrendatario entregará el inmueble en el estado en que lo recibió, salvo el deterioro natural derivado del uso legítimo.`,
    },
    {
      tipo: 'clausula',
      titulo: 'GARANTÍA',
      texto: `El Arrendatario entrega en este acto la suma de ${d.dinero(
        'garantiaMonto',
      )} en concepto de garantía. La garantía responde por los daños al inmueble, por los servicios y alícuotas impagos y por las obligaciones pendientes a la terminación; no se imputa al pago del canon. Se devolverá dentro de los ${d.campo(
        'garantiaDevolucionDias',
      )} días hábiles siguientes a la entrega del inmueble, deducidos los valores que correspondan. Para la liquidación de daños, las partes acuerdan los valores referenciales que constan en el cuadro VALORES DE LIQUIDACIÓN DE DAÑOS de este instrumento. Los daños no previstos en ese cuadro se liquidarán según el costo real de reparación, acreditado con el comprobante respectivo.`,
    },
    {
      tipo: 'clausula',
      titulo: 'CANON DE ARRENDAMIENTO',
      texto: `El canon mensual es de ${d.dinero('canonMonto')}, pagadero hasta el día ${d.campo(
        'canonDiaPago',
      )} de cada mes. El canon ${
        incluyeAlicuotas ? 'incluye' : 'no incluye'
      } las alícuotas de condominio. El pago se efectuará mediante ${d.opcion('formaPago')}${
        cuenta ? `, a la cuenta ${cuenta}` : ''
      }. El comprobante de cada pago constituye el respaldo de la obligación cumplida, y ambas partes lo conservarán.`,
    },
  ];

  // Declaración mutua sobre el canon. Configurable y activa por defecto. Es una
  // declaración de ambas partes, no una renuncia del arrendatario: no dice que
  // deje de poder reclamar, dice cómo y con qué criterio se fijó el valor.
  if (d.campo('declaracionCanon') !== 'NO') {
    bloques.push({
      tipo: 'clausula',
      titulo: 'DECLARACIÓN DE LAS PARTES SOBRE EL CANON',
      texto:
        'Las partes declaran que el canon fue acordado de forma libre y voluntaria, atendiendo al estado, la condición, la ubicación y las características actuales del inmueble, así como a las condiciones vigentes del mercado. Declaran conocer el marco legal aplicable a la fijación de pensiones de arrendamiento y ratifican el valor pactado como justo y ajustado a la realidad del bien. El Arrendatario declara haber conocido y aceptado el canon con anterioridad a la suscripción de este contrato, y se obliga a pagarlo en los términos convenidos.',
    });
  }

  bloques.push(
    {
      tipo: 'clausula',
      titulo: 'SERVICIOS BÁSICOS Y ALÍCUOTAS',
      texto: `Son de cuenta del Arrendatario los servicios básicos del inmueble, así como las alícuotas de condominio cuando no estén incluidas en el canon conforme a la cláusula anterior. El Arrendatario acreditará su pago cuando el Arrendador lo requiera, y los mantendrá al día hasta la entrega del inmueble.`,
    },
    {
      tipo: 'clausula',
      titulo: 'CAUSALES DE TERMINACIÓN',
      texto:
        'Además de las causales previstas en la normativa vigente, este contrato podrá terminar por: a) la mora en el pago de los servicios básicos; b) la mora en el pago de las alícuotas a cargo del Arrendatario; c) los daños causados al inmueble por dolo o negligencia; d) las modificaciones a la estructura o a las instalaciones sin autorización escrita del Arrendador; e) el incumplimiento reiterado del reglamento interno del edificio o conjunto; y f) el cambio de cerraduras sin autorización escrita del Arrendador. La terminación se tramitará conforme a la normativa vigente, y cada parte podrá ejercer las acciones legales que correspondan.',
    },
    {
      tipo: 'clausula',
      titulo: 'ENTREGA Y DEVOLUCIÓN',
      texto: `El Arrendador entrega el inmueble y ${d.campo(
        'numeroLlaves',
      )} juegos de llaves en la fecha de inicio. A la terminación, el Arrendatario devolverá el inmueble desocupado, libre de bienes ajenos al inventario, con los servicios al día y con la totalidad de las llaves recibidas. Las partes suscribirán un acta de entrega y otra de devolución, que dejarán constancia del estado del inmueble en cada momento.`,
    },
    {
      tipo: 'clausula',
      titulo: 'SUBARRIENDO Y CESIÓN',
      texto:
        'El Arrendatario no podrá subarrendar el inmueble, ni ceder este contrato, ni permitir su ocupación por terceros, sin autorización escrita del Arrendador.',
    },
    {
      tipo: 'clausula',
      titulo: 'SOLUCIÓN DE CONTROVERSIAS',
      texto: `Ante cualquier divergencia, las partes procurarán un acuerdo directo y, de no alcanzarlo, acudirán a mediación en un centro legalmente autorizado. Agotada la mediación sin acuerdo, las partes podrán ejercer las acciones que les franquea la ley ante los jueces competentes de ${ciudad}.`,
    },
    {
      tipo: 'clausula',
      titulo: 'NOTIFICACIONES Y ACEPTACIÓN',
      texto:
        'Las partes señalan para notificaciones los domicilios y los correos electrónicos consignados en la cláusula primera. Todo cambio deberá comunicarse por escrito. Las partes declaran haber leído íntegramente este contrato, entender su contenido y aceptarlo, y lo suscriben en la fecha indicada.',
    },

    {
      tipo: 'ficha',
      titulo: 'VALORES DE LIQUIDACIÓN DE DAÑOS',
      filas: [
        { etiqueta: 'Pintura, por m²', valor: d.campo('valorPinturaM2') ? d.dinero('valorPinturaM2') : opcional('') },
        { etiqueta: 'Piso, por m²', valor: d.campo('valorPisoM2') ? d.dinero('valorPisoM2') : opcional('') },
        { etiqueta: 'Cerradura, por unidad', valor: d.campo('valorCerradura') ? d.dinero('valorCerradura') : opcional('') },
        {
          etiqueta: opcional(d.campo('conceptoLibre'), 'Otro concepto'),
          valor: d.campo('valorLibre')
            ? `${d.dinero('valorLibre')} por ${opcional(d.campo('unidadLibre'), 'unidad')}`
            : opcional(''),
        },
      ],
    },

    { tipo: 'firmas' },
  );

  return bloques;
}

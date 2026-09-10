// ===========================================================================
// ARRENDAMIENTO — v2-2026-09
//
// ⚠️  PENDIENTE DE REVISIÓN LEGAL  ⚠️
// ⚠️  PLANTILLA PUENTE  ⚠️
//
// Es la v1 con dos cambios y ninguno más:
//
//   1. La cláusula de canon ya NO imprime cuenta bancaria. Consigna la forma
//      de pago (transferencia, depósito, efectivo o cheque) y el día de pago
//      mensual (punto 2.6). El campo de cuenta desapareció del formulario.
//   2. El aviso de la Ley de Inquilinato usa la redacción del punto 5.6.
//
// Es una PLANTILLA PUENTE: existe para que el arrendamiento deje de registrar
// datos bancarios hoy mismo. La reescritura completa del arrendamiento, con
// sus dos variantes (vivienda y local comercial u oficina) del punto 5.4, se
// publicará como v3 una vez aprobada la propuesta. Esta versión NO cubre esa
// separación.
// ===========================================================================

import { AVISO_LEY_INQUILINATO } from '../tipos';
import {
  comparecientes,
  contraer,
  inmuebleAntecedente,
  jurisdiccion,
  type BloqueDocumento,
  type DatosDocumento,
} from './base';

export const PLANTILLA_VERSION = 'arrendamiento-v2-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = false;
export const AVISO_PLANTILLA_SIN_REVISAR =
  'PLANTILLA EN REVISIÓN. El texto de este documento es una propuesta que aún no ha sido validada por un profesional del derecho. Revíselo con su abogado antes de suscribirlo.';

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
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
      texto:
        'El Arrendador declara estar facultado para dar en arrendamiento el inmueble descrito y el Arrendatario declara conocerlo y recibirlo a su entera satisfacción.',
    },
    { tipo: 'aviso', texto: AVISO_LEY_INQUILINATO },
    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },
    {
      tipo: 'clausula',
      titulo: 'OBJETO Y DESTINO',
      texto: `El Arrendador da en arrendamiento al Arrendatario el inmueble descrito, que se destinará exclusivamente a ${destino}. El Arrendatario no podrá cambiar su destino ni subarrendarlo sin autorización escrita del Arrendador.`,
    },
    // CAMBIO 1: forma de pago en vez de cuenta bancaria (punto 2.6).
    {
      tipo: 'clausula',
      titulo: 'CANON Y FORMA DE PAGO',
      texto: `El canon mensual de arrendamiento es de ${d.dinero(
        'canon',
      )}, pagadero por mensualidades anticipadas hasta el día ${d.campo('diaPago')} de cada mes, mediante ${d
        .opcion('formaPagoCanon')
        .toLowerCase()}. El respaldo de cada pago es el comprobante emitido en la respectiva transacción, que ambas partes conservarán. Los datos necesarios para efectuar el pago se entregan por canal separado entre las partes y no forman parte de este documento.`,
    },
    {
      tipo: 'clausula',
      titulo: 'PLAZO',
      texto: `El plazo del arrendamiento es de ${d.campo('plazoMeses')} meses contados desde el ${d.campo(
        'fechaInicio',
      )}. Su terminación y eventual renovación se sujetan a las normas imperativas de la Ley de Inquilinato en lo que resulten aplicables.`,
    },
  ];

  if (d.campo('garantia')) {
    bloques.push({
      tipo: 'clausula',
      titulo: 'GARANTÍA',
      texto: `El Arrendatario entrega en este acto la suma de ${d.dinero('garantia')} en calidad de garantía. ${d.campo(
        'garantiaDevolucion',
      )}`,
    });
  }

  bloques.push(
    {
      tipo: 'clausula',
      titulo: 'SERVICIOS Y ALÍCUOTA',
      texto: `Los servicios básicos del inmueble estarán a cargo ${contraer(
        'de',
        d.opcion('serviciosACargo'),
      )}. La alícuota de condominio, cuando corresponda, estará a cargo ${contraer('de', d.opcion('alicuotaACargo'))}.`,
    },
    {
      tipo: 'clausula',
      titulo: 'ESTADO Y CONSERVACIÓN',
      texto: `El Arrendatario recibe el inmueble en buen estado y se obliga a conservarlo, a realizar las reparaciones locativas y a restituirlo en el mismo estado, salvo el deterioro natural por el uso legítimo.${
        amoblado ? ' El inmueble se entrega amoblado conforme al inventario que forma parte integrante de este contrato.' : ''
      }`,
    },
  );

  if (amoblado && d.campo('inventarioBienes')) {
    bloques.push({ tipo: 'clausula', titulo: 'INVENTARIO DE BIENES', texto: d.campo('inventarioBienes') });
  }

  bloques.push({
    tipo: 'clausula',
    titulo: 'REAJUSTE DEL CANON',
    texto: reajuste
      ? `Las partes pactan el reajuste del canon conforme al siguiente criterio: ${d.campo(
          'reajusteCriterio',
        )}, dentro de los límites que establezca la ley.`
      : 'Las partes no pactan reajuste del canon durante el plazo inicial de este contrato.',
  });

  bloques.push(
    {
      tipo: 'clausula',
      titulo: 'TERMINACIÓN',
      texto:
        'Este contrato terminará por las causales previstas en la Ley de Inquilinato y en el Código Civil, así como por mutuo acuerdo de las partes expresado por escrito. La mora en el pago de dos o más pensiones de arrendamiento faculta al Arrendador a exigir la terminación en la forma prevista por la ley.',
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

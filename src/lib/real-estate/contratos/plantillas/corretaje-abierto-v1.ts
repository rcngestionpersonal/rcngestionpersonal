// ===========================================================================
// CORRETAJE INMOBILIARIO — MODALIDAD ABIERTA (NO EXCLUSIVA) — v1-2026-09
//
// ⚠️  PENDIENTE DE REVISIÓN LEGAL  ⚠️
//
// DERIVADA de corretaje-exclusivo-v1 (punto 3.2). Estas son las cláusulas que
// cambiaron respecto de la exclusiva, y ninguna otra:
//
//   1. TÍTULO y cláusula OBJETO — dicen ABIERTA / NO EXCLUSIVA. Se eliminó
//      "de manera exclusiva y como agente único" y la prohibición de encargar
//      la gestión a terceros. Se dice expresamente que el propietario puede
//      trabajar con varios agentes o gestionar por su cuenta (punto 1.5).
//   2. PLAZO — es "vigencia del encargo" (3 meses por defecto), sin
//      exclusividad y sin la opción de renovación automática, que en esta
//      modalidad no tiene efecto útil.
//   3. DEVENGO DE LA COMISIÓN — cláusula NUEVA, que no existe en la
//      exclusiva. Es el corazón de esta modalidad: la comisión se devenga a
//      favor del agente que efectivamente presentó al comprador o
//      arrendatario (punto 1.3).
//   4. INTERESADOS PRESENTADOS — cláusula NUEVA con su anexo. La lista de
//      personas que este corredor presentó es lo que prueba el devengo.
//      Sustituye a "BASE DE CONTACTOS Y RESERVA" de la exclusiva, que tenía
//      otra función: reportar contactos al cierre del encargo.
//   5. SE ELIMINÓ la cláusula "OPERACIONES CELEBRADAS POR FUERA DE ESTE
//      ENCARGO" con sus dos porcentajes. En un encargo abierto no hay "por
//      fuera": que el propietario negocie con otro es justamente lo pactado.
//   6. SE ELIMINÓ, de la cláusula de declaraciones, la presunción de que todo
//      interesado espontáneo es fruto del trabajo de este corredor. Es propia
//      de la exclusividad y en un encargo abierto sería contradictoria con la
//      regla de devengo.
//
// Sin cambios respecto de la exclusiva: comparecencia, descripción del
// inmueble, PRECIO, FACILIDADES, PROMOCIÓN, HONORARIOS, hipoteca y plusvalía
// dentro de declaraciones, TERMINACIÓN, jurisdicción y ratificación.
// ===========================================================================

import {
  aceptacionYRatificacion,
  agenteCompareciente,
  comparecientes,
  contraer,
  enMediaFrase,
  fichaInmuebleCorretaje,
  mediacionYArbitraje,
  nombresDeLista,
  type BloqueDocumento,
  type DatosDocumento,
} from './base';

export const PLANTILLA_VERSION = 'corretaje-abierto-v1-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = false;
export const AVISO_PLANTILLA_SIN_REVISAR =
  'PLANTILLA EN REVISIÓN. El texto de este documento es una propuesta que aún no ha sido validada por un profesional del derecho. Revíselo con su abogado antes de suscribirlo.';

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const objeto = d.opcion('objeto').toLowerCase();
  const meses = d.campo('vigenciaMeses');
  const facultades = d.lista('facultades');
  const hipotecado = d.campo('hipotecado') === 'SI';
  const interesados = nombresDeLista(d.campo('interesadosPresentados'));

  const bloques: BloqueDocumento[] = [
    // CAMBIO 1: el título declara la modalidad.
    { tipo: 'titulo', texto: `CONTRATO DE CORRETAJE INMOBILIARIO — ${objeto.toUpperCase()} (ABIERTO, NO EXCLUSIVO)` },

    ...comparecientes(d, [{ rol: 'propietario', titulo: 'El Cliente Vendedor' }]),
    agenteCompareciente(d, 'EL CORREDOR INMOBILIARIO', 'el Corredor Inmobiliario'),
    {
      tipo: 'parrafo',
      texto:
        'Ambas partes convienen en celebrar el presente contrato de corretaje en MODALIDAD ABIERTA, es decir NO EXCLUSIVA, bajo las cláusulas que siguen.',
    },

    fichaInmuebleCorretaje(d),
    {
      tipo: 'parrafo',
      texto: 'El Cliente Vendedor comparece en calidad de propietario del inmueble descrito. Fuente: cédula catastral.',
    },

    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },

    // CAMBIO 1: la modalidad se declara también en la primera cláusula
    // (punto 1.5), y se dice sin rodeos qué puede hacer el propietario.
    {
      tipo: 'clausula',
      titulo: 'OBJETO Y MODALIDAD ABIERTA',
      texto: `El Cliente Vendedor encarga al Corredor Inmobiliario, EN MODALIDAD ABIERTA Y NO EXCLUSIVA, que oferte e intermedie en la ${objeto} del inmueble descrito. En consecuencia, el Cliente Vendedor conserva la facultad de encargar la misma gestión a otros agentes y de gestionar el inmueble directamente, sin que ello constituya incumplimiento de este contrato. El Corredor Inmobiliario podrá accionar solo o en coordinación con otros corredores.`,
    },
    {
      tipo: 'clausula',
      titulo: 'PRECIO',
      texto: `El precio se fija en ${d.dinero('precioSalida')}, CON CARÁCTER DE NEGOCIABLE. El precio final deberá recibir la aceptación unánime del Cliente Vendedor y de la contraparte.`,
    },
    // CAMBIO 2: vigencia del encargo, sin exclusividad ni renovación automática.
    {
      tipo: 'clausula',
      titulo: 'VIGENCIA DEL ENCARGO',
      texto: `El presente encargo tendrá una vigencia de ${meses} meses contados a partir de la presente fecha. Vencido el plazo, el encargo termina sin necesidad de declaración alguna, salvo que las partes lo prorroguen por escrito. La terminación no afecta al derecho del Corredor Inmobiliario sobre las operaciones que se concreten con los interesados que él hubiere presentado, conforme a la cláusula de devengo de la comisión.`,
    },
    // CAMBIO 3: cláusula nueva. Es la regla que define esta modalidad.
    {
      tipo: 'clausula',
      titulo: 'DEVENGO DE LA COMISIÓN',
      texto: `Habiendo varios agentes autorizados, la comisión se devenga a favor de aquel que efectivamente haya presentado al comprador o arrendatario con el que se celebre la operación. Se entiende que un interesado fue presentado por el Corredor Inmobiliario cuando éste lo puso en contacto con el inmueble o con el Cliente Vendedor por primera vez, sea mediante visita, envío de información o coordinación de la negociación. Si la operación se concreta con un interesado presentado por el Corredor Inmobiliario, el Cliente Vendedor le pagará íntegramente la comisión pactada, aunque el cierre se haya materializado por medio de otro agente o directamente entre las partes, y aunque ocurra después de vencido el plazo de este encargo. Ningún otro agente devengará comisión respecto de ese mismo interesado por parte del Cliente Vendedor.`,
    },
    // CAMBIO 4: cláusula nueva, con la lista como anexo (punto 1.3).
    {
      tipo: 'clausula',
      titulo: 'REGISTRO DE INTERESADOS PRESENTADOS',
      texto:
        interesados.length > 0
          ? `A la fecha de suscripción, el Corredor Inmobiliario deja constancia de haber presentado a las siguientes personas, que forman el anexo de interesados presentados y parte integrante de este contrato: ${interesados.join(
              '; ',
            )}. El Corredor Inmobiliario podrá ampliar esta lista durante la vigencia del encargo mediante comunicación escrita al Cliente Vendedor, que se entenderá incorporada al anexo desde su recepción. La lista prueba el devengo previsto en la cláusula anterior.`
          : 'El Corredor Inmobiliario irá comunicando por escrito al Cliente Vendedor los interesados que presente durante la vigencia del encargo. Cada comunicación se entenderá incorporada, desde su recepción, al anexo de interesados presentados, que forma parte integrante de este contrato y prueba el devengo previsto en la cláusula anterior.',
    },
    {
      tipo: 'clausula',
      titulo: 'FACILIDADES',
      texto:
        facultades.length > 0
          ? `El Cliente Vendedor prestará al Corredor Inmobiliario las facilidades necesarias para cumplir su labor, tales como copias de documentos y autorización para visitar e inspeccionar el inmueble, y lo autoriza expresamente a: ${facultades
              .map((f) => f.toLowerCase())
              .join('; ')}. Cualquier actuación distinta requerirá autorización previa por escrito.`
          : 'El Cliente Vendedor prestará al Corredor Inmobiliario las facilidades necesarias para cumplir su labor, tales como copias de documentos y autorización para visitar e inspeccionar el inmueble. El Corredor ejercerá únicamente las gestiones que el Cliente Vendedor autorice previamente y por escrito.',
    },
    {
      tipo: 'clausula',
      titulo: 'PROMOCIÓN',
      texto: `Los gastos de publicidad, promoción y transporte correrán por cuenta ${contraer(
        'de',
        d.opcion('gastosPromocion'),
      )} y estarán devengados con los honorarios si la operación se concreta. Si no se concreta dentro del plazo pactado, el Cliente Vendedor no pagará valor alguno de publicidad y promoción al Corredor Inmobiliario.`,
    },
    {
      tipo: 'clausula',
      titulo: 'HONORARIOS',
      texto: `Devengada la comisión conforme a este contrato, el Cliente Vendedor pagará al Corredor Inmobiliario, en concepto de honorarios, el ${d.campo(
        'comisionPorcentaje',
      )}% ${contraer('de', d.opcion('comisionBase'))} (más IVA). Los honorarios se pagarán así: si la operación es de contado, ${enMediaFrase(
        d.campo('honorariosContado') || 'a la suscripción del instrumento que la formalice.',
      )} Si la operación es financiada, ${enMediaFrase(
        d.campo('honorariosFinanciado') || 'a la suscripción del instrumento que la formalice.',
      )}`,
    },
    // CAMBIO 6: sin la presunción de captación propia de la exclusividad.
    {
      tipo: 'clausula',
      titulo: 'DECLARACIONES DEL CLIENTE VENDEDOR',
      texto: `El Cliente Vendedor declara que el inmueble materia de este contrato ${
        hipotecado ? 'SÍ se encuentra hipotecado' : 'NO se encuentra hipotecado'
      }, y que será de su responsabilidad preparar y proporcionar los documentos habilitantes para la transferencia de dominio. Se obliga a informar al Corredor Inmobiliario, de manera oportuna y por escrito, sobre las negociaciones que emprenda respecto del inmueble por otras vías, con el único fin de determinar quién presentó al interesado. Declara, por último, que conoce de antemano los valores de impuestos de utilidad (plusvalía) y de obras que le corresponde cancelar ante las entidades competentes como consecuencia de la transferencia.`,
    },
    {
      tipo: 'clausula',
      titulo: 'TERMINACIÓN ANTICIPADA',
      texto:
        'Cualquiera de las partes podrá dar por terminado este encargo antes de su vencimiento mediante comunicación escrita con quince (15) días de anticipación, sin perjuicio del derecho del Corredor Inmobiliario sobre las operaciones que se concreten con los interesados que él hubiere presentado, conforme a la cláusula de devengo de la comisión.',
    },
    ...mediacionYArbitraje(d),
    aceptacionYRatificacion(d.ciudad, 'triplicado'),
    { tipo: 'firmas' },
  ];

  return bloques;
}

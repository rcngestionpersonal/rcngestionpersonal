// ===========================================================================
// CORRETAJE INMOBILIARIO — MODALIDAD EXCLUSIVA — v1-2026-09
//
// ⚠️  PENDIENTE DE REVISIÓN LEGAL  ⚠️
//
// Redactada sobre el formato real "Contrato de Corretaje Inmobiliario – Venta
// (Exclusivo)" entregado por el negocio, respetando su estructura y su
// redacción (punto 3.1). Lo que se añadió respecto de ese formato:
//
//   - Cláusula NOVENA: los dos porcentajes del punto 1.3 (comisión si el
//     propietario negocia directamente y comisión si encarga a otro agente).
//     El formato original solo decía que "reconocerá íntegramente sus
//     honorarios", sin distinguir los dos supuestos ni permitir pactar un
//     porcentaje distinto para cada uno.
//   - Cláusula CUARTA: la renovación automática pasó a ser una opción
//     explícita (sí/no, por defecto no). El formato original solo contemplaba
//     el aviso previo de 15 días.
//   - El plazo se expresa en MESES y no en días, porque es como se pacta y
//     como lo pide el punto 1.3.
//
// Esta versión NO se edita una vez que exista un contrato que la use: se
// publica otra (punto 5.2).
// ===========================================================================

import {
  aceptacionYRatificacion,
  agenteCompareciente,
  comparecientes,
  contraer,
  enMediaFrase,
  fichaInmuebleCorretaje,
  mediacionYArbitraje,
  type BloqueDocumento,
  type DatosDocumento,
} from './base';

export const PLANTILLA_VERSION = 'corretaje-exclusivo-v1-2026-09';
export const PLANTILLA_REVISADA_POR_ABOGADO = false;
export const AVISO_PLANTILLA_SIN_REVISAR =
  'PLANTILLA EN REVISIÓN. El texto de este documento es una propuesta que aún no ha sido validada por un profesional del derecho. Revíselo con su abogado antes de suscribirlo.';

export function construirBloques(d: DatosDocumento): BloqueDocumento[] {
  const objeto = d.opcion('objeto').toLowerCase();
  const meses = d.campo('plazoExclusividadMeses');
  const renovacion = d.campo('renovacionAutomatica') === 'SI';
  const facultades = d.lista('facultades');
  const hipotecado = d.campo('hipotecado') === 'SI';

  return [
    { tipo: 'titulo', texto: `CONTRATO DE CORRETAJE INMOBILIARIO — ${objeto.toUpperCase()} (EXCLUSIVO)` },

    ...comparecientes(d, [{ rol: 'propietario', titulo: 'El Cliente Vendedor' }]),
    agenteCompareciente(d, 'EL CORREDOR INMOBILIARIO', 'el Corredor Inmobiliario'),
    {
      tipo: 'parrafo',
      texto:
        'Ambas partes convienen en celebrar el presente contrato de corretaje en MODALIDAD EXCLUSIVA, bajo las cláusulas que siguen.',
    },

    fichaInmuebleCorretaje(d),
    { tipo: 'parrafo', texto: 'El Cliente Vendedor comparece en calidad de propietario del inmueble descrito. Fuente: cédula catastral.' },

    { tipo: 'subtitulo', texto: 'CLÁUSULAS' },

    // La modalidad se declara en la PRIMERA cláusula, además del título
    // (punto 1.5).
    {
      tipo: 'clausula',
      titulo: 'OBJETO Y MODALIDAD EXCLUSIVA',
      texto: `El Cliente Vendedor contrata y encarga DE MANERA EXCLUSIVA Y COMO AGENTE ÚNICO al Corredor Inmobiliario, para que oferte e intermedie en la ${objeto} del inmueble descrito. Durante la vigencia de este contrato el Cliente Vendedor no podrá encargar la misma gestión a otro agente ni gestionarla por su cuenta, sin perjuicio de lo previsto en la cláusula sobre operaciones celebradas por fuera de este encargo. El Corredor Inmobiliario podrá accionar solo o en coordinación con otros corredores para la promoción y ${objeto} del citado inmueble.`,
    },
    {
      tipo: 'clausula',
      titulo: 'PRECIO',
      texto: `El precio se fija en ${d.dinero('precioSalida')}, CON CARÁCTER DE NEGOCIABLE. El precio final deberá recibir la aceptación unánime del Cliente Vendedor y de la contraparte.`,
    },
    {
      tipo: 'clausula',
      titulo: 'PLAZO DE EXCLUSIVIDAD Y RENOVACIÓN',
      texto: renovacion
        ? `El presente contrato tendrá una vigencia de ${meses} meses contados a partir de la presente fecha, y se renovará automáticamente por períodos iguales, salvo que cualquiera de las partes notifique por escrito su voluntad de no renovarlo con al menos quince (15) días de anticipación a su término.`
        : `El presente contrato tendrá una vigencia de ${meses} meses contados a partir de la presente fecha, SIN RENOVACIÓN AUTOMÁTICA. El Cliente Vendedor notificará al Corredor Inmobiliario, de manera expresa y con al menos quince (15) días de anticipación a su término, su intención de renovarlo. Si no existiese notificación, el plazo culminará sin renovación alguna.`,
    },
    {
      tipo: 'clausula',
      titulo: 'BASE DE CONTACTOS Y RESERVA',
      texto:
        'Todos los contactos captados por el Corredor Inmobiliario a partir del inicio de vigencia del presente instrumento serán reportados al Cliente Vendedor en un resumen de gestión al finalizar el plazo del corretaje, identificados con la inicial del nombre seguida del apellido. La demás información obtenida —números telefónicos, correos electrónicos y similares— quedará en poder del Corredor Inmobiliario. Si alguno de esos contactos llegare a concretar la operación sobre el inmueble, dentro o fuera del plazo del presente contrato, el Cliente Vendedor reconocerá íntegramente los honorarios pactados en la cláusula de honorarios.',
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
      texto: `Ejecutada la operación, el Cliente Vendedor pagará al Corredor Inmobiliario, en concepto de honorarios, el ${d.campo(
        'comisionPorcentaje',
      )}% ${contraer('de', d.opcion('comisionBase'))} (más IVA). Los honorarios se pagarán así: si la operación es de contado, ${enMediaFrase(
        d.campo('honorariosContado') || 'a la suscripción del instrumento que la formalice.',
      )} Si la operación es financiada, ${enMediaFrase(
        d.campo('honorariosFinanciado') || 'a la suscripción del instrumento que la formalice.',
      )}`,
    },
    // AÑADIDA respecto del formato de referencia (punto 1.3).
    {
      tipo: 'clausula',
      titulo: 'OPERACIONES CELEBRADAS POR FUERA DE ESTE ENCARGO',
      texto: `Durante la vigencia de la exclusividad: (a) si el Cliente Vendedor celebra directamente la operación con cualquier interesado, pagará al Corredor Inmobiliario una comisión del ${d.campo(
        'comisionVentaDirecta',
      )}% calculada sobre el precio real de la transacción (más IVA); y (b) si el Cliente Vendedor encarga la misma gestión a otro agente y la operación se concreta por esa vía, pagará al Corredor Inmobiliario una comisión del ${d.campo(
        'comisionOtroAgente',
      )}% calculada sobre el precio real de la transacción (más IVA). Estas comisiones se devengan por el solo hecho de celebrarse la operación dentro del plazo de exclusividad y son independientes de la gestión que el Corredor hubiere alcanzado a realizar.`,
    },
    {
      tipo: 'clausula',
      titulo: 'DECLARACIONES DEL CLIENTE VENDEDOR',
      texto: `El Cliente Vendedor declara que el inmueble materia de este contrato ${
        hipotecado ? 'SÍ se encuentra hipotecado' : 'NO se encuentra hipotecado'
      }, y que será de su responsabilidad preparar y proporcionar los documentos habilitantes para la transferencia de dominio. Declara asimismo que cualquier interesado aparentemente espontáneo que se le presente, directamente o por medio de terceros, se entenderá producto del trabajo del Corredor Inmobiliario contratado y vinculado a su gestión, por lo que, de concretarse la operación, reconocerá íntegramente sus honorarios. Declara, por último, que conoce de antemano los valores de impuestos de utilidad (plusvalía) y de obras que le corresponde cancelar ante las entidades competentes como consecuencia de la transferencia.`,
    },
    {
      tipo: 'clausula',
      titulo: 'TERMINACIÓN ANTICIPADA',
      texto:
        'Cualquiera de las partes podrá dar por terminado este contrato antes de su vencimiento mediante comunicación escrita con quince (15) días de anticipación, sin perjuicio del derecho del Corredor Inmobiliario a percibir la comisión respecto de las operaciones cuya causa determinante haya sido su gestión anterior a la terminación, y de lo previsto en la cláusula sobre operaciones celebradas por fuera de este encargo.',
    },
    ...mediacionYArbitraje(d),
    aceptacionYRatificacion(d.ciudad, 'triplicado'),
    { tipo: 'firmas' },
  ];
}

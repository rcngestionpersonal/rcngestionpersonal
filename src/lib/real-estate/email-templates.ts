const SIGNATURE = '\n\nUn saludo cordial,\nEl equipo de Redinmo | Broker Hub 🏠';

function wrap(greeting: string, body: string, cta?: { label: string; url: string }): string {
  const ctaBlock = cta ? `\n\n👉 ${cta.label}: ${cta.url}` : '';
  return `${greeting}\n\n${body}${ctaBlock}${SIGNATURE}`;
}

export function buildWelcomeEmail(agentName: string, appUrl: string): { subject: string; text: string } {
  return {
    subject: '🏠 ¡Bienvenido/a a Redinmo | Broker Hub!',
    text: wrap(
      `Hola ${agentName},`,
      [
        'Qué gusto tenerte en Redinmo | Broker Hub. Tu cuenta ya está activa y lista para ayudarte a cerrar más negocios inmobiliarios.',
        '',
        'Para que la plataforma sea cada vez más valiosa para toda la comunidad, te invitamos a seguir alimentándola:',
        '• Carga los inmuebles que tengas disponibles.',
        '• Registra los pedidos de tus clientes.',
        '• Cuando cierres una venta o alquiler, registra el precio de cierre (de forma anónima) para ayudar a todos a tasar mejor.',
        '',
        'Mientras más la uses, más oportunidades de negocio cruzado vas a recibir.',
      ].join('\n'),
      { label: 'Ingresar a la plataforma', url: appUrl },
    ),
  };
}

export function buildMatchCreatedEmail(input: {
  recipientName: string;
  counterpartName: string;
  myDescription: string;
  counterpartDescription: string;
  score: number;
  appUrl: string;
}): { subject: string; text: string } {
  return {
    subject: `🤝 Tienes un nuevo match (${input.score.toFixed(0)}%) en Redinmo`,
    text: wrap(
      `Hola ${input.recipientName},`,
      [
        `Encontramos una coincidencia del ${input.score.toFixed(0)}% entre tu "${input.myDescription}" y el "${input.counterpartDescription}" de ${input.counterpartName}.`,
        '',
        'Te recomendamos contactar cuanto antes para no perder la oportunidad, y registrar el avance de la gestión en la plataforma: así ambos agentes quedan al tanto del progreso en todo momento.',
      ].join('\n'),
      { label: 'Ver el match y registrar el avance', url: input.appUrl },
    ),
  };
}

const MILESTONE_LABELS: Record<string, string> = {
  contacted: 'Se puso en contacto por WhatsApp',
  infoSent: 'Envió la información a su cliente',
  visitFollowUp: 'Está en seguimiento para agendar una visita',
  visitScheduled: 'Confirmó la fecha y hora de una visita',
  visitCompletedOk: 'Registró que la visita fue satisfactoria',
  visitCompletedNo: 'Registró que la visita fue descartada',
  offerInProgress: 'Está en proceso de oferta',
  closedWon: 'Concretó la negociación 🏆',
  closedLost: 'Marcó la negociación como no concretada',
  reopened: 'Reabrió el seguimiento',
};

export function milestoneLabel(key: string): string {
  return MILESTONE_LABELS[key] ?? key;
}

// Envoltorio HTML para los correos transaccionales de seguridad (recuperacion de
// contrasena). CSS inline, sin variables ni flexbox/grid, para compatibilidad con
// clientes de correo - solo bloques con margin/padding/text-align. Usa la paleta
// clara (tokens de src/app/globals.css [data-theme='light']) a proposito: los
// clientes de correo no soportan variables CSS ni prefers-color-scheme de forma
// confiable, y un correo oscuro se ve roto en la mayoria de bandejas (que son
// claras por defecto) - mejor un unico tema fijo que coincida con el actual.
function wrapHtml(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const ctaBlock = cta
    ? `
      <div style="margin:28px 0;text-align:center;">
        <a href="${cta.url}" style="display:inline-block;background:linear-gradient(100deg,#7c5cff,#0fb5a3);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:9px;">${cta.label}</a>
      </div>
      <p style="margin:0 0 24px;font-size:12.5px;color:#8b83a6;word-break:break-all;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/><a href="${cta.url}" style="color:#0d9488;">${cta.url}</a></p>`
    : '';

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px 16px;background:#faf9fd;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e6e1f2;border-radius:16px;padding:32px 28px;">
      <p style="margin:0 0 22px;font-size:13px;font-weight:600;letter-spacing:0.04em;">
        <span style="color:#0d9488;">✦</span> <span style="color:#1a1330;">REDINMO</span>
      </p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1330;">${title}</h1>
      <div style="font-size:14.5px;line-height:1.6;color:#635a80;">${bodyHtml}</div>
      ${ctaBlock}
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#8b83a6;">Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue activa.</p>
      <hr style="border:none;border-top:1px solid #e6e1f2;margin:0 0 18px;" />
      <p style="margin:0;font-size:11.5px;color:#8b83a6;">redinmo.io · El hub que conecta colegas</p>
      <p style="margin:4px 0 0;font-size:11.5px;color:#8b83a6;">Este es un correo automático, no responder.</p>
    </div>
  </body>
</html>`;
}

export function buildPasswordResetEmail(firstName: string, link: string): { subject: string; text: string; html: string } {
  const subject = 'Restablece tu contraseña de Redinmo';
  const text = wrap(
    `Hola ${firstName},`,
    [
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Redinmo.',
      'Usa el siguiente enlace para crear una nueva. El enlace vence en 30 minutos y solo puede usarse una vez.',
      '',
      'Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue activa.',
    ].join('\n'),
    { label: 'Crear nueva contraseña', url: link },
  );
  const html = wrapHtml(
    'Restablece tu contraseña',
    `<p style="margin:0 0 8px;">Hola ${firstName},</p>
     <p style="margin:0;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en Redinmo. Toca el botón para crear una nueva. El enlace vence en 30 minutos y solo puede usarse una vez.</p>`,
    { label: 'Crear nueva contraseña', url: link },
  );
  return { subject, text, html };
}

export function buildEmailChangeVerificationEmail(firstName: string, link: string): { subject: string; text: string; html: string } {
  const subject = 'Confirma tu nuevo correo en Redinmo';
  const text = wrap(
    `Hola ${firstName},`,
    [
      'Pediste cambiar el correo de tu cuenta de Redinmo a esta dirección.',
      'Usa el siguiente enlace para confirmarlo. El enlace vence en 30 minutos y solo puede usarse una vez. Tu correo actual sigue funcionando hasta que confirmes el nuevo.',
      '',
      'Si no pediste este cambio, ignora este correo: tu correo actual no se modifica.',
    ].join('\n'),
    { label: 'Confirmar nuevo correo', url: link },
  );
  const html = wrapHtml(
    'Confirma tu nuevo correo',
    `<p style="margin:0 0 8px;">Hola ${firstName},</p>
     <p style="margin:0;">Pediste cambiar el correo de tu cuenta de Redinmo a esta dirección. Toca el botón para confirmarlo. El enlace vence en 30 minutos y solo puede usarse una vez. Tu correo actual sigue funcionando hasta que confirmes el nuevo.</p>`,
    { label: 'Confirmar nuevo correo', url: link },
  );
  return { subject, text, html };
}

export function buildPasswordChangedEmail(firstName: string, dateStr: string): { subject: string; text: string; html: string } {
  const subject = 'Tu contraseña de Redinmo fue actualizada';
  const text = wrap(
    `Hola ${firstName},`,
    [
      `Tu contraseña fue actualizada el ${dateStr}.`,
      '',
      'Si no fuiste tú, escríbenos de inmediato por WhatsApp o a notificaciones@redinmo.io.',
    ].join('\n'),
  );
  const html = wrapHtml(
    'Tu contraseña fue actualizada',
    `<p style="margin:0 0 8px;">Hola ${firstName},</p>
     <p style="margin:0;">Tu contraseña fue actualizada el <b style="color:#f0f1f7;">${dateStr}</b>. Si no fuiste tú, escríbenos de inmediato.</p>`,
  );
  return { subject, text, html };
}

// Avisos automaticos durante el trial gratuito (dia 23, 28 y 30 de un trial de
// 30 dias = 7, 2 y 0 dias restantes). Los 3 enlazan directo a la pantalla de
// pago, no al panel general - el objetivo es la conversion, no solo informar.
export function buildTrialReminderEmail(
  agentName: string,
  daysLeft: 7 | 2 | 0,
  payUrl: string,
): { subject: string; text: string; html: string } {
  const copy =
    daysLeft === 7
      ? {
          subject: '⏳ Te quedan 7 días de prueba gratuita en Redinmo',
          lead: 'Tu prueba gratuita de Redinmo termina en 7 días.',
          detail: 'Para no perder acceso a tus inmuebles, pedidos y matches, activa tu suscripción cuando quieras: solo toma un minuto.',
        }
      : daysLeft === 2
        ? {
            subject: '⏳ Tu prueba gratuita termina en 2 días',
            lead: 'Tu prueba gratuita de Redinmo termina en 2 días.',
            detail: 'Activa tu suscripción ahora para seguir recibiendo matches de tus colegas sin interrupciones.',
          }
        : {
            subject: 'Tu prueba gratuita terminó — activa tu suscripción',
            lead: 'Tu prueba gratuita de Redinmo ya terminó.',
            detail: 'Activa tu suscripción para recuperar el acceso completo a la plataforma: tus inmuebles, pedidos y matches siguen ahí, esperándote.',
          };

  const text = wrap(`Hola ${agentName},`, [copy.lead, '', copy.detail].join('\n'), { label: 'Activar mi suscripción', url: payUrl });
  const html = wrapHtml(
    copy.lead,
    `<p style="margin:0 0 8px;">Hola ${agentName},</p>
     <p style="margin:0;">${copy.detail}</p>`,
    { label: 'Activar mi suscripción', url: payUrl },
  );
  return { subject: copy.subject, text, html };
}

// Aviso legal de cambio de precio (Fase 7, seccion 9.5 - 30 dias de aviso
// segun Terminos y Condiciones). Nunca se envia a agentes con precio
// fundador vigente (el llamador ya filtra esa lista antes de invocar esto).
export function buildPriceChangeNoticeEmail(input: {
  agentName: string;
  planNombre: string;
  newTotalUsd: string;
  effectiveDateStr: string;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const lead = `El precio del plan ${input.planNombre} de Redinmo cambiará a $${input.newTotalUsd} a partir del ${input.effectiveDateStr}.`;
  const detail = 'Este aviso cumple con el plazo de 30 días establecido en nuestros Términos y Condiciones. El nuevo precio se aplicará recién en esa fecha, nunca antes.';
  const text = wrap(`Hola ${input.agentName},`, [lead, '', detail].join('\n'), { label: 'Ver mi suscripción', url: `${input.appUrl}/agentes/suscripcion/planes` });
  const html = wrapHtml(
    lead,
    `<p style="margin:0 0 8px;">Hola ${input.agentName},</p>
     <p style="margin:0;">${detail}</p>`,
    { label: 'Ver mi suscripción', url: `${input.appUrl}/agentes/suscripcion/planes` },
  );
  return { subject: `Aviso de cambio de precio · plan ${input.planNombre}`, text, html };
}

// Notificaciones del motor de cobro recurrente (pedido de recurrencias,
// seccion 6). El aviso previo NO es opcional (seccion 6: "es lo que
// declaraste ante Payphone al pedir la tokenizacion y lo que evita los
// reclamos al banco") - nunca se debe omitir su llamada aunque parezca
// redundante con el resto.
export function buildPaymentReminderEmail(input: {
  agentName: string;
  planNombre: string;
  totalUsd: string;
  chargeDateStr: string;
  lastDigits: string;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const lead = `En 3 días, el ${input.chargeDateStr}, se cobrará $${input.totalUsd} por tu plan ${input.planNombre} a la tarjeta terminada en ${input.lastDigits}.`;
  const detail = 'Si algo no coincide o quieres cambiar de tarjeta antes de esa fecha, puedes hacerlo desde tu cuenta.';
  const url = `${input.appUrl}/agentes/suscripcion`;
  const text = wrap(`Hola ${input.agentName},`, [lead, '', detail].join('\n'), { label: 'Ver mi suscripción', url });
  const html = wrapHtml(
    lead,
    `<p style="margin:0 0 8px;">Hola ${input.agentName},</p>
     <p style="margin:0;">${detail}</p>`,
    { label: 'Ver mi suscripción', url },
  );
  return { subject: `Recordatorio: cobro de $${input.totalUsd} el ${input.chargeDateStr}`, text, html };
}

export function buildPaymentApprovedEmail(input: {
  agentName: string;
  planNombre: string;
  totalUsd: string;
  periodEndStr: string;
  authorizationCode: string | null;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const lead = `Cobramos $${input.totalUsd} de tu plan ${input.planNombre}. Tu acceso queda cubierto hasta el ${input.periodEndStr}.`;
  const detail = input.authorizationCode
    ? `Código de autorización: ${input.authorizationCode}. Guarda este correo como comprobante.`
    : 'Guarda este correo como comprobante.';
  const url = `${input.appUrl}/agentes/suscripcion`;
  const text = wrap(`Hola ${input.agentName},`, [lead, '', detail].join('\n'), { label: 'Ver mi suscripción', url });
  const html = wrapHtml(
    lead,
    `<p style="margin:0 0 8px;">Hola ${input.agentName},</p>
     <p style="margin:0;">${detail}</p>`,
    { label: 'Ver mi suscripción', url },
  );
  return { subject: `Pago confirmado — $${input.totalUsd}`, text, html };
}

// Motivo GENERICO a proposito (seccion 6 del pedido): nunca se expone el
// codigo/mensaje crudo del banco en el correo, solo internamente en
// Charge.responseMessage - un mensaje tecnico ("CVV invalido", "fondos
// insuficientes") frente al agente puede sonar a que Redinmo esta
// culpandolo, cuando la accion que necesita tomar es la misma en todos los
// casos: actualizar su tarjeta.
export function buildPaymentDeclinedEmail(input: {
  agentName: string;
  planNombre: string;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const lead = `No pudimos cobrar tu plan ${input.planNombre}. Tu servicio sigue activo mientras lo intentamos de nuevo.`;
  const detail = 'El motivo más común es una tarjeta vencida o sin fondos disponibles. Actualiza tu método de pago para evitar interrupciones.';
  const url = `${input.appUrl}/agentes/suscripcion`;
  const text = wrap(`Hola ${input.agentName},`, [lead, '', detail].join('\n'), { label: 'Actualizar mi tarjeta', url });
  const html = wrapHtml(
    lead,
    `<p style="margin:0 0 8px;">Hola ${input.agentName},</p>
     <p style="margin:0;">${detail}</p>`,
    { label: 'Actualizar mi tarjeta', url },
  );
  return { subject: 'No pudimos procesar tu cobro', text, html };
}

// "Ultimo aviso" (seccion 6 del pedido): se dispara al programar el TERCER y
// ultimo reintento (dia 7), no en cada rechazo - es la unica notificacion
// que dice explicitamente "esta es tu ultima oportunidad".
export function buildPastDueFinalNoticeEmail(input: {
  agentName: string;
  planNombre: string;
  finalRetryDateStr: string;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const lead = `Último aviso: el ${input.finalRetryDateStr} haremos el último intento de cobro de tu plan ${input.planNombre}.`;
  const detail = 'Si ese intento también falla, tu cuenta pasará a modo lectura: podrás seguir viendo tus inmuebles y pedidos, pero no aparecerás en nuevos matches ni recibirás avisos. Actualiza tu tarjeta antes de esa fecha para evitarlo.';
  const url = `${input.appUrl}/agentes/suscripcion`;
  const text = wrap(`Hola ${input.agentName},`, [lead, '', detail].join('\n'), { label: 'Actualizar mi tarjeta', url });
  const html = wrapHtml(
    lead,
    `<p style="margin:0 0 8px;">Hola ${input.agentName},</p>
     <p style="margin:0;">${detail}</p>`,
    { label: 'Actualizar mi tarjeta', url },
  );
  return { subject: `Último aviso antes del ${input.finalRetryDateStr}`, text, html };
}

export function buildSubscriptionExpiredEmail(input: {
  agentName: string;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const lead = 'Tu suscripción a Redinmo pasó a modo lectura tras no poder cobrar tu tarjeta.';
  const detail = 'Tus inmuebles, pedidos y datos siguen intactos - nunca se elimina información por falta de pago. Reactiva tu suscripción cuando quieras para volver a generar matches y recibir avisos.';
  const url = `${input.appUrl}/agentes/suscripcion`;
  const text = wrap(`Hola ${input.agentName},`, [lead, '', detail].join('\n'), { label: 'Reactivar mi suscripción', url });
  const html = wrapHtml(
    lead,
    `<p style="margin:0 0 8px;">Hola ${input.agentName},</p>
     <p style="margin:0;">${detail}</p>`,
    { label: 'Reactivar mi suscripción', url },
  );
  return { subject: 'Tu cuenta pasó a modo lectura', text, html };
}

export function buildMilestoneEmail(input: {
  recipientName: string;
  actorName: string;
  milestoneKey: string;
  matchDescription: string;
  detail?: string;
  appUrl: string;
}): { subject: string; text: string } {
  const label = milestoneLabel(input.milestoneKey);
  return {
    subject: `📋 Avance en tu match: ${label}`,
    text: wrap(
      `Hola ${input.recipientName},`,
      [
        `${input.actorName} actualizó el seguimiento del match "${input.matchDescription}":`,
        '',
        `✅ ${label}${input.detail ? ` — ${input.detail}` : ''}`,
        '',
        'Puedes ver el detalle completo y la línea de tiempo del match en la plataforma.',
      ].join('\n'),
      { label: 'Ver seguimiento completo', url: input.appUrl },
    ),
  };
}

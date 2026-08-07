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
// clientes de correo - solo bloques con margin/padding/text-align.
function wrapHtml(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const ctaBlock = cta
    ? `
      <div style="margin:28px 0;text-align:center;">
        <a href="${cta.url}" style="display:inline-block;background:#2dd4bf;color:#04201c;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:9px;">${cta.label}</a>
      </div>
      <p style="margin:0 0 24px;font-size:12.5px;color:#62667f;word-break:break-all;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/><a href="${cta.url}" style="color:#2dd4bf;">${cta.url}</a></p>`
    : '';

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px 16px;background:#0b0d14;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#141722;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:32px 28px;">
      <p style="margin:0 0 22px;font-size:13px;font-weight:600;letter-spacing:0.04em;">
        <span style="color:#2dd4bf;">✦</span> <span style="color:#f0f1f7;">REDINMO</span>
      </p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f0f1f7;">${title}</h1>
      <div style="font-size:14.5px;line-height:1.6;color:#9296b0;">${bodyHtml}</div>
      ${ctaBlock}
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#62667f;">Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue activa.</p>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 18px;" />
      <p style="margin:0;font-size:11.5px;color:#62667f;">redinmo.io · El hub que conecta colegas</p>
      <p style="margin:4px 0 0;font-size:11.5px;color:#62667f;">Este es un correo automático, no responder.</p>
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

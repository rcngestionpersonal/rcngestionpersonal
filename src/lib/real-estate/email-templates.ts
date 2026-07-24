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

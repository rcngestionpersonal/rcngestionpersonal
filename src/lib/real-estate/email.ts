type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = {
  attempted: boolean;
  delivered: boolean;
  error?: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY);
}

export async function sendEmailNotification(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    return { attempted: false, delivered: false };
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'notificaciones@redinmo.io';
  const fromName = 'Redinmo | Broker Hub';

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: fromEmail, name: fromName },
        subject: input.subject,
        content: [{ type: 'text/plain', value: input.text }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { attempted: true, delivered: false, error: `SendGrid ${response.status}: ${detail.slice(0, 200)}` };
    }

    return { attempted: true, delivered: true };
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: error instanceof Error ? error.message : 'Error enviando email',
    };
  }
}

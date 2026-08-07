import { Resend } from 'resend';

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = {
  attempted: boolean;
  delivered: boolean;
  error?: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmailNotification(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { attempted: false, delivered: false };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'notificaciones@redinmo.io';

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `Redinmo <${fromEmail}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (error) {
      return { attempted: true, delivered: false, error: `Resend: ${error.message}` };
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

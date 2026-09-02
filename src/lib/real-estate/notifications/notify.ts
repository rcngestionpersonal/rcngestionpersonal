// Interfaz de notificacion del motor de recurrencias (pedido de
// recurrencias, seccion 6: "deja la implementacion detras de una interfaz
// notify(agent, template, data) para poder mandar correo hoy y WhatsApp
// despues"). Hoy solo hay un canal (email, via Resend) - el dia que se
// agregue WhatsApp, este es el UNICO lugar que cambia: nada que llama a
// notify() necesita enterarse.
import {
  buildPastDueFinalNoticeEmail,
  buildPaymentApprovedEmail,
  buildPaymentDeclinedEmail,
  buildPaymentReminderEmail,
  buildSubscriptionExpiredEmail,
} from '@/lib/real-estate/email-templates';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { getAppUrl } from '@/lib/real-estate/subscription-config';

export type NotifyAgent = { fullName: string; email: string | null };

export type NotificationTemplate =
  | { name: 'payment_reminder'; data: { planNombre: string; totalUsd: string; chargeDateStr: string; lastDigits: string } }
  | { name: 'charge_approved'; data: { planNombre: string; totalUsd: string; periodEndStr: string; authorizationCode: string | null } }
  | { name: 'charge_declined'; data: { planNombre: string } }
  | { name: 'past_due_final_notice'; data: { planNombre: string; finalRetryDateStr: string } }
  | { name: 'subscription_expired'; data: Record<string, never> };

export type NotifyResult = { attempted: boolean; delivered: boolean };

export async function notify(agent: NotifyAgent, template: NotificationTemplate): Promise<NotifyResult> {
  if (!agent.email || !isEmailConfigured()) {
    return { attempted: false, delivered: false };
  }

  const appUrl = getAppUrl();
  const agentName = agent.fullName;

  const email = (() => {
    switch (template.name) {
      case 'payment_reminder':
        return buildPaymentReminderEmail({ agentName, appUrl, ...template.data });
      case 'charge_approved':
        return buildPaymentApprovedEmail({ agentName, appUrl, ...template.data });
      case 'charge_declined':
        return buildPaymentDeclinedEmail({ agentName, appUrl, ...template.data });
      case 'past_due_final_notice':
        return buildPastDueFinalNoticeEmail({ agentName, appUrl, ...template.data });
      case 'subscription_expired':
        return buildSubscriptionExpiredEmail({ agentName, appUrl });
    }
  })();

  const result = await sendEmailNotification({ to: agent.email, subject: email.subject, text: email.text, html: email.html });
  return { attempted: result.attempted, delivered: result.delivered };
}

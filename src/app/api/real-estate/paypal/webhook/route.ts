import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSubscriptionActivation, logSubscriptionCancellation } from '@/lib/real-estate/churn';
import { registerPaypalEvent, shouldUseMockStore, updateSubscriptionByPaypalId } from '@/lib/real-estate/mock-store';
import { verifyPaypalWebhookSignature } from '@/lib/real-estate/paypal';

function mapPaypalStatus(status: string): 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE' {
  switch (status) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'SUSPENDED':
      return 'PAST_DUE';
    case 'CANCELLED':
      return 'CANCELED';
    case 'EXPIRED':
      return 'INACTIVE';
    default:
      return 'INACTIVE';
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const mockMode = shouldUseMockStore();

    if (!mockMode && process.env.PAYPAL_WEBHOOK_ID) {
      const verified = await verifyPaypalWebhookSignature(request.headers, rawBody);
      if (!verified) {
        return NextResponse.json({ error: 'Firma de webhook invalida.' }, { status: 400 });
      }
    }

    const event = JSON.parse(rawBody) as {
      id: string;
      event_type: string;
      resource?: { id?: string; status?: string; custom_id?: string; payer?: { payer_id?: string } };
    };

    if (mockMode) {
      const isNew = registerPaypalEvent(event.id);
      if (!isNew) {
        return NextResponse.json({ received: true, duplicate: true, mode: 'mock' });
      }
    } else {
      const existingEvent = await prisma.eventLog.findFirst({
        where: { entityType: 'paypal_event', entityId: event.id },
      });
      if (existingEvent) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      await prisma.eventLog.create({
        data: { entityType: 'paypal_event', entityId: event.id, eventType: event.event_type, payload: event.resource as never },
      });
    }

    const subscriptionId = event.resource?.id;
    const status = event.resource?.status;

    if (subscriptionId && status && event.event_type.startsWith('BILLING.SUBSCRIPTION.')) {
      const mappedStatus = mapPaypalStatus(status);

      if (mockMode) {
        updateSubscriptionByPaypalId(subscriptionId, mappedStatus);
      } else {
        try {
          const matchingAgents = await prisma.agent.findMany({
            where: { paypalSubscriptionId: subscriptionId },
            select: { id: true },
          });
          await prisma.agent.updateMany({
            where: { paypalSubscriptionId: subscriptionId },
            data: { subscriptionStatus: mappedStatus },
          });

          for (const agent of matchingAgents) {
            if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED') {
              await logSubscriptionCancellation(agent.id, 'VOLUNTARY');
            } else if (event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
              await logSubscriptionCancellation(agent.id, 'INVOLUNTARY');
            } else if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
              await logSubscriptionActivation(agent.id);
            }
          }
        } catch {
          updateSubscriptionByPaypalId(subscriptionId, mappedStatus);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'PayPal webhook error';
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

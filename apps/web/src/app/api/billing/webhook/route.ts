import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  accountForCustomer,
  saveSubscription,
  stripe,
  toSubscriptionState,
} from '@/lib/server/billing';
import { serverConfig } from '@/lib/server/env';

export const runtime = 'nodejs';

/**
 * Stripe is the source of truth for access. Events are verified against the
 * raw body — an unsigned payload is never trusted to unlock an account.
 */
export async function POST(request: Request): Promise<Response> {
  const { stripeWebhookSecret } = serverConfig();
  const client = stripe();
  const signature = request.headers.get('stripe-signature');

  if (!client || !stripeWebhookSecret || !signature) {
    return NextResponse.json({ error: 'Webhook non configuré.' }, { status: 503 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(raw, signature, stripeWebhookSecret);
  } catch (error) {
    console.error('[scan-trade] signature de webhook refusée', error);
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  try {
    await handleEvent(client, event);
  } catch (error) {
    console.error('[scan-trade] traitement du webhook impossible', error);
    // Answering 500 asks Stripe to retry rather than lose the event.
    return NextResponse.json({ error: 'Traitement impossible.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(client: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id;
      if (!subscriptionId || !customerId) return;

      const subscription = await client.subscriptions.retrieve(subscriptionId);
      const accountId =
        session.client_reference_id ??
        (subscription.metadata.accountId || (await accountForCustomer(customerId)));
      if (!accountId) return;

      await saveSubscription(
        accountId,
        customerId,
        subscription.id,
        toSubscriptionState(subscription),
      );
      return;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      const accountId = subscription.metadata.accountId || (await accountForCustomer(customerId));
      if (!accountId) return;

      const state = toSubscriptionState(subscription);
      await saveSubscription(accountId, customerId, subscription.id, {
        ...state,
        active: event.type === 'customer.subscription.deleted' ? false : state.active,
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : state.status,
      });
      return;
    }

    default:
      return;
  }
}

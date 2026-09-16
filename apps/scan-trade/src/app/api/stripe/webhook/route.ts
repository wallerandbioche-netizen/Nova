import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getStripe } from '@/lib/stripe/client';
import { prismaBillingStore, stripeGateway } from '@/features/billing/service';
import { handleStripeEvent, type StripeEventLike } from '@/features/billing/stripe-events';

export const runtime = 'nodejs';
/** Stripe must reach the raw body; Next must not parse or cache it. */
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 *
 * The authoritative path for subscription state (§24). The signature is
 * verified against the exact bytes Stripe sent — reading the body as text after
 * any transform would break verification and, worse, could let an unsigned
 * payload through.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: { code: 'validation_error', message: 'Signature absente.' } }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      getStripeConfig().webhookSecret,
    );
  } catch (error) {
    // A bad signature is an attacker or a misconfiguration, never a retryable
    // condition: answer 400 so Stripe stops resending.
    logger.warn('stripe.webhook.invalid_signature', { error });
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Signature Stripe invalide.' } },
      { status: 400 },
    );
  }

  try {
    const outcome = await handleStripeEvent(event as unknown as StripeEventLike, {
      store: prismaBillingStore,
      gateway: stripeGateway,
    });
    logger.info('stripe.webhook.processed', { eventId: event.id, type: event.type, outcome });
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 asks Stripe to retry — the right answer when our own side failed.
    logger.error('stripe.webhook.failed', { eventId: event.id, type: event.type, error });
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Traitement impossible.' } },
      { status: 500 },
    );
  }
}

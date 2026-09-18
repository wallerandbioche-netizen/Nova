import type { NextRequest } from 'next/server';
import { getEnv } from '@/lib/config/env';
import { AppError } from '@/lib/errors';
import { ok, route } from '@/lib/http';
import { getStripe } from '@/lib/stripe/client';
import { handleStripeEvent } from '@/lib/stripe/webhook';

/**
 * Stripe webhook.
 *
 * The signature is verified against the exact bytes received — reading the body as text first
 * and re-encoding it would break the signature and, worse, let a forged event through.
 */
export const POST = route(async (request: NextRequest) => {
  const env = getEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError('INTERNAL', 'Webhook non configuré.');

  const signature = request.headers.get('stripe-signature');
  if (!signature) throw new AppError('FORBIDDEN', 'Signature manquante.');

  const payload = Buffer.from(await request.arrayBuffer());
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (cause) {
    throw new AppError('FORBIDDEN', 'Signature invalide.', { cause });
  }

  await handleStripeEvent(event);
  return ok({ received: true });
});

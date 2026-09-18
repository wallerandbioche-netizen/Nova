import Stripe from 'stripe';
import { getEnv } from '../config/env';
import { AppError } from '../errors';

let client: Stripe | null = null;

/** Stripe is optional: the product runs, and videos render, without it configured. */
export function isStripeConfigured(): boolean {
  return Boolean(getEnv().STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError('INTERNAL', "Le paiement n'est pas configuré sur cette instance.");
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

/** Resolves a plan or pack's Stripe price id from the environment, never from a hard-coded id. */
export function resolvePriceId(stripePriceEnv: string | undefined): string | null {
  if (!stripePriceEnv) return null;
  const value = process.env[stripePriceEnv];
  return value && value.length > 0 ? value : null;
}

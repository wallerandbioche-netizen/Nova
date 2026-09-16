import Stripe from 'stripe';
import { getStripeConfig } from '@/lib/env';

let client: Stripe | null = null;

/**
 * Stripe client singleton.
 *
 * No API version is pinned here on purpose: the account's default version
 * applies, and `normalizeStripeSubscription` tolerates both the legacy and the
 * item-scoped period fields so an account-level version bump does not silently
 * blank a renewal date.
 */
export function getStripe(): Stripe {
  if (client) return client;
  client = new Stripe(getStripeConfig().secretKey, {
    typescript: true,
    appInfo: { name: 'Scan Trade', version: '0.1.0' },
    maxNetworkRetries: 2,
  });
  return client;
}

/** Test helper. */
export function setStripeClient(next: Stripe | null): void {
  client = next;
}

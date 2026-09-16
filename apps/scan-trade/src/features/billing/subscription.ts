import type { SubscriptionStatus } from '@prisma/client';

/**
 * Subscription access rules.
 *
 * Kept as pure functions with no Prisma import so the gate that guards every
 * paid action can be tested exhaustively.
 */

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/** Statuses that grant access to the product while the paid period lasts. */
const ENTITLING: readonly SubscriptionStatus[] = ['ACTIVE', 'TRIALING'];

/**
 * A subscription entitles access when Stripe reports it active or trialing.
 *
 * `currentPeriodEnd` is treated as a grace boundary rather than the source of
 * truth: Stripe drives the status through webhooks, and a clock skew of a few
 * minutes must not lock a paying user out mid-scan.
 */
export function isSubscriptionActive(
  subscription: SubscriptionSnapshot | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;
  if (!ENTITLING.includes(subscription.status)) return false;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < now.getTime()) {
    // Status says active but the period lapsed: the renewal webhook has not
    // landed (or failed). Stay generous for a short grace window only.
    const GRACE_MS = 24 * 60 * 60 * 1000;
    return now.getTime() - subscription.currentPeriodEnd.getTime() < GRACE_MS;
  }
  return true;
}

export type SubscriptionDisplayState = 'none' | 'active' | 'canceling' | 'past_due' | 'canceled' | 'paused';

export function subscriptionDisplayState(
  subscription: SubscriptionSnapshot | null | undefined,
  now: Date = new Date(),
): SubscriptionDisplayState {
  if (!subscription || subscription.status === 'NONE') return 'none';
  if (subscription.status === 'PAST_DUE' || subscription.status === 'UNPAID') return 'past_due';
  if (subscription.status === 'PAUSED') return 'paused';
  if (isSubscriptionActive(subscription, now)) {
    return subscription.cancelAtPeriodEnd ? 'canceling' : 'active';
  }
  return 'canceled';
}

/** Maps a Stripe subscription status string onto our enum. */
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
      return 'PAST_DUE';
    case 'unpaid':
      return 'UNPAID';
    case 'canceled':
      return 'CANCELED';
    case 'incomplete':
      return 'INCOMPLETE';
    case 'incomplete_expired':
      return 'INCOMPLETE_EXPIRED';
    case 'paused':
      return 'PAUSED';
    default:
      return 'NONE';
  }
}

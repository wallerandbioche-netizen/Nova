import type { SubscriptionStatus } from '@prisma/client';
import { mapStripeStatus } from './subscription';

/**
 * Stripe webhook handling (§24).
 *
 * Written against small structural types rather than the Stripe SDK classes, so
 * the branching — which is what actually decides whether someone can use the
 * product — can be tested without a network or a fixture generator.
 */

export interface StripeSubscriptionItemLike {
  price?: { id?: string | null } | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
}

export interface StripeSubscriptionLike {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end?: boolean | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: { data?: StripeSubscriptionItemLike[] } | null;
  metadata?: Record<string, string> | null;
}

export interface StripeCheckoutSessionLike {
  id: string;
  mode?: string | null;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: unknown };
}

export interface NormalizedSubscription {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingStore {
  /** Resolves the owner of a Stripe customer, via our own mapping. */
  findUserIdByCustomerId(customerId: string): Promise<string | null>;
  findUserIdBySubscriptionId(subscriptionId: string): Promise<string | null>;
  upsertSubscription(userId: string, subscription: NormalizedSubscription): Promise<void>;
  markCanceled(stripeSubscriptionId: string): Promise<void>;
  isEventProcessed(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string, type: string): Promise<void>;
}

export interface StripeGateway {
  retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionLike>;
}

export type WebhookOutcome =
  | { handled: true; action: 'subscription_synced'; userId: string; status: SubscriptionStatus }
  | { handled: true; action: 'subscription_canceled'; subscriptionId: string }
  | { handled: false; reason: 'duplicate' | 'ignored' | 'unknown_customer' };

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function toDate(seconds: number | null | undefined): Date | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
}

/**
 * Reads period boundaries from either the subscription (older API versions) or
 * its first item (2025+ versions), whichever is present.
 */
export function normalizeStripeSubscription(
  subscription: StripeSubscriptionLike,
): NormalizedSubscription | null {
  const customerId = idOf(subscription.customer);
  if (!customerId) return null;

  const firstItem = subscription.items?.data?.[0];

  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    stripePriceId: firstItem?.price?.id ?? null,
    status: mapStripeStatus(subscription.status),
    currentPeriodStart: toDate(
      subscription.current_period_start ?? firstItem?.current_period_start,
    ),
    currentPeriodEnd: toDate(subscription.current_period_end ?? firstItem?.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };
}

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
]);

/**
 * Applies one Stripe event.
 *
 * Idempotent by event id, because Stripe retries deliveries and a replayed
 * `subscription.deleted` must not revoke a plan the user has since renewed.
 */
export async function handleStripeEvent(
  event: StripeEventLike,
  deps: { store: BillingStore; gateway: StripeGateway },
): Promise<WebhookOutcome> {
  if (await deps.store.isEventProcessed(event.id)) {
    return { handled: false, reason: 'duplicate' };
  }

  const outcome = await route(event, deps);
  await deps.store.markEventProcessed(event.id, event.type);
  return outcome;
}

async function route(
  event: StripeEventLike,
  deps: { store: BillingStore; gateway: StripeGateway },
): Promise<WebhookOutcome> {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as StripeCheckoutSessionLike;
    if (session.mode && session.mode !== 'subscription')
      return { handled: false, reason: 'ignored' };

    const subscriptionId = idOf(session.subscription);
    if (!subscriptionId) return { handled: false, reason: 'ignored' };

    // The checkout session carries the user id we put there when creating it;
    // that is the only moment a Stripe customer becomes attributable.
    const userId =
      session.client_reference_id ??
      session.metadata?.userId ??
      (await resolveUserId(deps.store, idOf(session.customer), subscriptionId));
    if (!userId) return { handled: false, reason: 'unknown_customer' };

    const subscription = await deps.gateway.retrieveSubscription(subscriptionId);
    const normalized = normalizeStripeSubscription(subscription);
    if (!normalized) return { handled: false, reason: 'ignored' };

    await deps.store.upsertSubscription(userId, normalized);
    return { handled: true, action: 'subscription_synced', userId, status: normalized.status };
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as StripeSubscriptionLike;
    const normalized = normalizeStripeSubscription(subscription);
    const userId = await resolveUserId(
      deps.store,
      normalized?.stripeCustomerId ?? null,
      subscription.id,
    );

    if (userId && normalized) {
      await deps.store.upsertSubscription(userId, { ...normalized, status: 'CANCELED' });
    } else {
      await deps.store.markCanceled(subscription.id);
    }
    return { handled: true, action: 'subscription_canceled', subscriptionId: subscription.id };
  }

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const subscriptionId = extractSubscriptionId(event);
    if (!subscriptionId) return { handled: false, reason: 'ignored' };

    const subscription = await deps.gateway.retrieveSubscription(subscriptionId);
    const normalized = normalizeStripeSubscription(subscription);
    if (!normalized) return { handled: false, reason: 'ignored' };

    const userId =
      subscription.metadata?.userId ??
      (await resolveUserId(deps.store, normalized.stripeCustomerId, subscriptionId));
    if (!userId) return { handled: false, reason: 'unknown_customer' };

    await deps.store.upsertSubscription(userId, normalized);
    return { handled: true, action: 'subscription_synced', userId, status: normalized.status };
  }

  return { handled: false, reason: 'ignored' };
}

async function resolveUserId(
  store: BillingStore,
  customerId: string | null,
  subscriptionId: string | null,
): Promise<string | null> {
  if (subscriptionId) {
    const bySubscription = await store.findUserIdBySubscriptionId(subscriptionId);
    if (bySubscription) return bySubscription;
  }
  if (customerId) return store.findUserIdByCustomerId(customerId);
  return null;
}

function extractSubscriptionId(event: StripeEventLike): string | null {
  const object = event.data.object as Record<string, unknown>;
  if (event.type.startsWith('customer.subscription.')) {
    return typeof object.id === 'string' ? object.id : null;
  }
  // Invoice events reference the subscription they settle.
  const direct = object.subscription;
  if (typeof direct === 'string') return direct;
  if (direct && typeof direct === 'object' && 'id' in direct) {
    const nested = (direct as { id?: unknown }).id;
    return typeof nested === 'string' ? nested : null;
  }
  const parent = object.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  const fromParent = parent?.subscription_details?.subscription;
  if (typeof fromParent === 'string') return fromParent;
  if (fromParent && typeof fromParent === 'object' && 'id' in fromParent) {
    const nested = (fromParent as { id?: unknown }).id;
    return typeof nested === 'string' ? nested : null;
  }
  return null;
}

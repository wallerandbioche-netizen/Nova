import 'server-only';

import Stripe from 'stripe';
import { ensureSchema } from './db';
import { serverConfig } from './env';
import type { Account } from './auth';

export type PlanId = 'mensuelle' | 'annuelle';

export interface SubscriptionState {
  /** Whether the paid features are unlocked right now. */
  active: boolean;
  status: string;
  plan: PlanId | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export const NO_SUBSCRIPTION: SubscriptionState = {
  active: false,
  status: 'none',
  plan: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

/** Statuses Stripe considers as granting access. */
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

let stripeClient: Stripe | null = null;

export function stripe(): Stripe | null {
  const { stripeSecretKey } = serverConfig();
  if (!stripeSecretKey) return null;
  if (!stripeClient) stripeClient = new Stripe(stripeSecretKey);
  return stripeClient;
}

export function priceIdFor(plan: PlanId): string | undefined {
  const config = serverConfig();
  return plan === 'annuelle' ? config.priceYearly : config.priceMonthly;
}

export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  const config = serverConfig();
  if (priceId === config.priceYearly) return 'annuelle';
  if (priceId === config.priceMonthly) return 'mensuelle';
  return null;
}

/** Derives what the interface needs from a Stripe subscription object. */
export function toSubscriptionState(subscription: Stripe.Subscription): SubscriptionState {
  const item = subscription.items.data[0];
  const periodEnd = item?.current_period_end ?? null;

  return {
    active: ACTIVE_STATUSES.has(subscription.status),
    status: subscription.status,
    plan: planForPrice(item?.price.id),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

interface SubscriptionRow {
  status: string;
  plan: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

/** Subscription as recorded for an account. */
export async function readSubscription(accountId: string): Promise<SubscriptionState> {
  const sql = await ensureSchema();
  if (!sql) return NO_SUBSCRIPTION;

  const rows = await sql<SubscriptionRow[]>`
    SELECT status, plan, current_period_end, cancel_at_period_end, stripe_customer_id
      FROM subscriptions
     WHERE account_id = ${accountId}
  `;
  const row = rows[0];
  if (!row) return NO_SUBSCRIPTION;

  const expired = row.current_period_end ? row.current_period_end.getTime() < Date.now() : false;

  return {
    active: ACTIVE_STATUSES.has(row.status) && !expired,
    status: row.status,
    plan: row.plan === 'annuelle' || row.plan === 'mensuelle' ? row.plan : null,
    currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

export async function saveSubscription(
  accountId: string,
  customerId: string,
  subscriptionId: string | null,
  state: SubscriptionState,
): Promise<void> {
  const sql = await ensureSchema();
  if (!sql) return;

  await sql`
    INSERT INTO subscriptions (
      account_id, stripe_customer_id, stripe_subscription_id,
      status, plan, current_period_end, cancel_at_period_end, updated_at
    ) VALUES (
      ${accountId}, ${customerId}, ${subscriptionId},
      ${state.status}, ${state.plan}, ${state.currentPeriodEnd}, ${state.cancelAtPeriodEnd}, now()
    )
    ON CONFLICT (account_id) DO UPDATE SET
      stripe_customer_id     = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status                 = EXCLUDED.status,
      plan                   = EXCLUDED.plan,
      current_period_end     = EXCLUDED.current_period_end,
      cancel_at_period_end   = EXCLUDED.cancel_at_period_end,
      updated_at             = now()
  `;
}

export async function accountForCustomer(customerId: string): Promise<string | null> {
  const sql = await ensureSchema();
  if (!sql) return null;
  const rows = await sql<{ account_id: string }[]>`
    SELECT account_id FROM subscriptions WHERE stripe_customer_id = ${customerId}
  `;
  return rows[0]?.account_id ?? null;
}

/** Reuses the Stripe customer already attached to the account, or creates one. */
export async function customerForAccount(account: Account): Promise<string | null> {
  const client = stripe();
  const sql = await ensureSchema();
  if (!client || !sql) return null;

  const rows = await sql<{ stripe_customer_id: string | null }[]>`
    SELECT stripe_customer_id FROM subscriptions WHERE account_id = ${account.id}
  `;
  const existing = rows[0]?.stripe_customer_id;
  if (existing) return existing;

  const customer = await client.customers.create({
    email: account.email,
    metadata: { accountId: account.id },
  });

  await sql`
    INSERT INTO subscriptions (account_id, stripe_customer_id, status)
    VALUES (${account.id}, ${customer.id}, 'none')
    ON CONFLICT (account_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id
  `;
  return customer.id;
}

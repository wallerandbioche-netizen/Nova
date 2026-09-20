import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type Stripe from 'stripe';
import { planForPrice, priceIdFor, toSubscriptionState } from './billing';

const ENV = { ...process.env };

beforeEach(() => {
  process.env.STRIPE_PRICE_MONTHLY = 'price_month';
  process.env.STRIPE_PRICE_YEARLY = 'price_year';
});

afterEach(() => {
  process.env = { ...ENV };
});

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: 'price_month' },
          current_period_end: Math.floor(Date.UTC(2026, 9, 20) / 1000),
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe('planForPrice', () => {
  it('maps the configured prices to their plan', () => {
    expect(planForPrice('price_month')).toBe('mensuelle');
    expect(planForPrice('price_year')).toBe('annuelle');
  });

  it('returns null for an unknown or missing price', () => {
    expect(planForPrice('price_other')).toBeNull();
    expect(planForPrice(null)).toBeNull();
    expect(planForPrice(undefined)).toBeNull();
  });
});

describe('priceIdFor', () => {
  it('picks the price of the requested plan', () => {
    expect(priceIdFor('mensuelle')).toBe('price_month');
    expect(priceIdFor('annuelle')).toBe('price_year');
  });
});

describe('toSubscriptionState', () => {
  it('unlocks an active subscription and keeps its period end', () => {
    const state = toSubscriptionState(subscription());
    expect(state.active).toBe(true);
    expect(state.plan).toBe('mensuelle');
    expect(state.currentPeriodEnd).toBe(new Date(Date.UTC(2026, 9, 20)).toISOString());
    expect(state.cancelAtPeriodEnd).toBe(false);
  });

  it('keeps access during a trial and while payment is retried', () => {
    expect(toSubscriptionState(subscription({ status: 'trialing' })).active).toBe(true);
    expect(toSubscriptionState(subscription({ status: 'past_due' })).active).toBe(true);
  });

  it('locks a canceled, unpaid or incomplete subscription', () => {
    expect(toSubscriptionState(subscription({ status: 'canceled' })).active).toBe(false);
    expect(toSubscriptionState(subscription({ status: 'unpaid' })).active).toBe(false);
    expect(toSubscriptionState(subscription({ status: 'incomplete' })).active).toBe(false);
  });

  it('reports a scheduled cancellation without locking straight away', () => {
    const state = toSubscriptionState(subscription({ cancel_at_period_end: true }));
    expect(state.active).toBe(true);
    expect(state.cancelAtPeriodEnd).toBe(true);
  });

  it('survives a subscription without items', () => {
    const state = toSubscriptionState(
      subscription({ items: { data: [] } } as unknown as Partial<Stripe.Subscription>),
    );
    expect(state.plan).toBeNull();
    expect(state.currentPeriodEnd).toBeNull();
  });
});

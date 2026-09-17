import { describe, expect, it } from 'vitest';
import {
  handleStripeEvent,
  normalizeStripeSubscription,
  type BillingStore,
  type NormalizedSubscription,
  type StripeGateway,
  type StripeSubscriptionLike,
} from './stripe-events';
import { mapStripeStatus } from './subscription';

const PERIOD_START = 1_760_000_000;
const PERIOD_END = 1_762_600_000;

function stripeSubscription(
  overrides: Partial<StripeSubscriptionLike> = {},
): StripeSubscriptionLike {
  return {
    id: 'sub_123',
    status: 'active',
    customer: 'cus_123',
    cancel_at_period_end: false,
    current_period_start: PERIOD_START,
    current_period_end: PERIOD_END,
    items: { data: [{ price: { id: 'price_pro' } }] },
    ...overrides,
  };
}

class MemoryBillingStore implements BillingStore {
  readonly subscriptions = new Map<string, NormalizedSubscription>();
  readonly processed = new Set<string>();
  readonly canceled: string[] = [];
  customerOwners = new Map<string, string>();
  subscriptionOwners = new Map<string, string>();

  async findUserIdByCustomerId(customerId: string) {
    return this.customerOwners.get(customerId) ?? null;
  }

  async findUserIdBySubscriptionId(subscriptionId: string) {
    return this.subscriptionOwners.get(subscriptionId) ?? null;
  }

  async upsertSubscription(userId: string, subscription: NormalizedSubscription) {
    this.subscriptions.set(userId, subscription);
    this.customerOwners.set(subscription.stripeCustomerId, userId);
    this.subscriptionOwners.set(subscription.stripeSubscriptionId, userId);
  }

  async markCanceled(stripeSubscriptionId: string) {
    this.canceled.push(stripeSubscriptionId);
  }

  async isEventProcessed(eventId: string) {
    return this.processed.has(eventId);
  }

  async markEventProcessed(eventId: string) {
    this.processed.add(eventId);
  }
}

function gatewayReturning(subscription: StripeSubscriptionLike): StripeGateway & { calls: number } {
  return {
    calls: 0,
    async retrieveSubscription() {
      this.calls += 1;
      return subscription;
    },
  };
}

describe('normalizeStripeSubscription', () => {
  it('reads period boundaries from the subscription (legacy API shape)', () => {
    const normalized = normalizeStripeSubscription(stripeSubscription());

    expect(normalized?.currentPeriodStart?.getTime()).toBe(PERIOD_START * 1000);
    expect(normalized?.currentPeriodEnd?.getTime()).toBe(PERIOD_END * 1000);
    expect(normalized?.stripePriceId).toBe('price_pro');
  });

  it('falls back to the first item when the API moved the fields there', () => {
    const normalized = normalizeStripeSubscription(
      stripeSubscription({
        current_period_start: null,
        current_period_end: null,
        items: {
          data: [
            {
              price: { id: 'price_pro' },
              current_period_start: PERIOD_START,
              current_period_end: PERIOD_END,
            },
          ],
        },
      }),
    );

    expect(normalized?.currentPeriodStart?.getTime()).toBe(PERIOD_START * 1000);
    expect(normalized?.currentPeriodEnd?.getTime()).toBe(PERIOD_END * 1000);
  });

  it('accepts an expanded customer object as well as an id', () => {
    const normalized = normalizeStripeSubscription(
      stripeSubscription({ customer: { id: 'cus_expanded' } }),
    );

    expect(normalized?.stripeCustomerId).toBe('cus_expanded');
  });

  it('gives up rather than guessing when there is no customer', () => {
    expect(normalizeStripeSubscription(stripeSubscription({ customer: '' }))).toBeNull();
  });
});

describe('mapStripeStatus', () => {
  it('maps every status Stripe can send', () => {
    expect(mapStripeStatus('active')).toBe('ACTIVE');
    expect(mapStripeStatus('trialing')).toBe('TRIALING');
    expect(mapStripeStatus('past_due')).toBe('PAST_DUE');
    expect(mapStripeStatus('unpaid')).toBe('UNPAID');
    expect(mapStripeStatus('canceled')).toBe('CANCELED');
    expect(mapStripeStatus('incomplete')).toBe('INCOMPLETE');
    expect(mapStripeStatus('incomplete_expired')).toBe('INCOMPLETE_EXPIRED');
    expect(mapStripeStatus('paused')).toBe('PAUSED');
  });

  it('never grants access on a status it does not know', () => {
    expect(mapStripeStatus('something_new')).toBe('NONE');
  });
});

describe('handleStripeEvent', () => {
  it('activates the subscription named by a completed checkout', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayReturning(stripeSubscription());

    const outcome = await handleStripeEvent(
      {
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_1',
            mode: 'subscription',
            customer: 'cus_123',
            subscription: 'sub_123',
            client_reference_id: 'user_alice',
          },
        },
      },
      { store, gateway },
    );

    expect(outcome).toMatchObject({
      handled: true,
      action: 'subscription_synced',
      userId: 'user_alice',
    });
    expect(store.subscriptions.get('user_alice')?.status).toBe('ACTIVE');
  });

  it('attributes the payment through metadata when no client reference is set', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayReturning(stripeSubscription());

    await handleStripeEvent(
      {
        id: 'evt_2',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_2',
            mode: 'subscription',
            subscription: 'sub_123',
            metadata: { userId: 'user_bob' },
          },
        },
      },
      { store, gateway },
    );

    expect(store.subscriptions.get('user_bob')?.status).toBe('ACTIVE');
  });

  it('ignores a one-off payment session', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayReturning(stripeSubscription());

    const outcome = await handleStripeEvent(
      {
        id: 'evt_3',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_3', mode: 'payment' } },
      },
      { store, gateway },
    );

    expect(outcome).toEqual({ handled: false, reason: 'ignored' });
    expect(gateway.calls).toBe(0);
  });

  it('is idempotent: a replayed event changes nothing', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayReturning(stripeSubscription());
    const event = {
      id: 'evt_4',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123', customer: 'cus_123' } },
    };
    store.subscriptionOwners.set('sub_123', 'user_alice');

    const first = await handleStripeEvent(event, { store, gateway });
    const second = await handleStripeEvent(event, { store, gateway });

    expect(first).toMatchObject({ handled: true });
    expect(second).toEqual({ handled: false, reason: 'duplicate' });
    expect(gateway.calls).toBe(1);
  });

  it('records a cancellation against the right user', async () => {
    const store = new MemoryBillingStore();
    store.subscriptionOwners.set('sub_123', 'user_alice');
    const gateway = gatewayReturning(stripeSubscription());

    const outcome = await handleStripeEvent(
      {
        id: 'evt_5',
        type: 'customer.subscription.deleted',
        data: { object: stripeSubscription({ status: 'canceled' }) },
      },
      { store, gateway },
    );

    expect(outcome).toMatchObject({ handled: true, action: 'subscription_canceled' });
    expect(store.subscriptions.get('user_alice')?.status).toBe('CANCELED');
  });

  it('falls back to marking the subscription cancelled when the owner is unknown', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayReturning(stripeSubscription());

    await handleStripeEvent(
      {
        id: 'evt_6',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_orphan', status: 'canceled', customer: 'cus_orphan' } },
      },
      { store, gateway },
    );

    expect(store.canceled).toEqual(['sub_orphan']);
  });

  it('downgrades to PAST_DUE when a renewal payment fails', async () => {
    const store = new MemoryBillingStore();
    store.subscriptionOwners.set('sub_123', 'user_alice');
    const gateway = gatewayReturning(stripeSubscription({ status: 'past_due' }));

    await handleStripeEvent(
      {
        id: 'evt_7',
        type: 'invoice.payment_failed',
        data: { object: { id: 'in_1', subscription: 'sub_123' } },
      },
      { store, gateway },
    );

    expect(store.subscriptions.get('user_alice')?.status).toBe('PAST_DUE');
  });

  it('reads the subscription id out of the newer invoice shape', async () => {
    const store = new MemoryBillingStore();
    store.subscriptionOwners.set('sub_123', 'user_alice');
    const gateway = gatewayReturning(stripeSubscription());

    const outcome = await handleStripeEvent(
      {
        id: 'evt_8',
        type: 'invoice.paid',
        data: {
          object: { id: 'in_2', parent: { subscription_details: { subscription: 'sub_123' } } },
        },
      },
      { store, gateway },
    );

    expect(outcome).toMatchObject({ handled: true, action: 'subscription_synced' });
  });

  it('records a cancellation scheduled for the end of the period', async () => {
    const store = new MemoryBillingStore();
    store.subscriptionOwners.set('sub_123', 'user_alice');
    const gateway = gatewayReturning(stripeSubscription({ cancel_at_period_end: true }));

    await handleStripeEvent(
      { id: 'evt_9', type: 'customer.subscription.updated', data: { object: { id: 'sub_123' } } },
      { store, gateway },
    );

    const stored = store.subscriptions.get('user_alice');
    expect(stored?.cancelAtPeriodEnd).toBe(true);
    // Still entitling until the period actually ends.
    expect(stored?.status).toBe('ACTIVE');
  });

  it('ignores an event type it does not handle, and remembers it did', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayReturning(stripeSubscription());

    const outcome = await handleStripeEvent(
      { id: 'evt_10', type: 'payment_intent.succeeded', data: { object: {} } },
      { store, gateway },
    );

    expect(outcome).toEqual({ handled: false, reason: 'ignored' });
    expect(store.processed.has('evt_10')).toBe(true);
  });

  it('refuses to attribute a subscription it cannot trace to a user', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayReturning(stripeSubscription({ customer: 'cus_unknown' }));

    const outcome = await handleStripeEvent(
      {
        id: 'evt_11',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_unknown' } },
      },
      { store, gateway },
    );

    expect(outcome).toEqual({ handled: false, reason: 'unknown_customer' });
    expect(store.subscriptions.size).toBe(0);
  });
});

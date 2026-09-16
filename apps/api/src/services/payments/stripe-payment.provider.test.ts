import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { parseEnv } from '../../config/env.js';
import { StripePaymentProvider } from './providers/stripe-payment.provider.js';

const WEBHOOK_SECRET = 'whsec_test_secret_value';

const env = parseEnv({
  DATABASE_URL: 'postgresql://nova:nova@localhost:5432/nova',
  JWT_SECRET: 'z'.repeat(40),
  PAYMENT_PROVIDER: 'stripe',
  PAYMENT_SECRET: 'sk_test_value',
  PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET,
} as NodeJS.ProcessEnv);

const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as never;
const provider = new StripePaymentProvider(env, logger);

function sign(body: string, secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

const subscriptionEvent = JSON.stringify({
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: 1_800_000_000,
    },
  },
});

/**
 * The webhook is the only path that can grant a paid plan, and it is authenticated purely by
 * its signature. These tests exist so a refactor cannot quietly weaken that check.
 */
describe('Stripe webhook verification', () => {
  it('accepts a correctly signed event and maps it to a subscription state', async () => {
    const event = await provider.parseWebhook(subscriptionEvent, sign(subscriptionEvent));

    expect(event.type).toBe('subscription.updated');
    expect(event.plan).toBe('premium');
    expect(event.status).toBe('active');
    expect(event.providerCustomerId).toBe('cus_123');
    expect(event.providerSubscriptionId).toBe('sub_123');
    expect(event.currentPeriodEnd?.toISOString()).toBe(new Date(1_800_000_000_000).toISOString());
  });

  it('rejects a missing signature', async () => {
    await expect(provider.parseWebhook(subscriptionEvent, undefined)).rejects.toThrow(/signature/i);
  });

  it('rejects a signature produced with another secret', async () => {
    await expect(
      provider.parseWebhook(subscriptionEvent, sign(subscriptionEvent, 'whsec_wrong_secret')),
    ).rejects.toThrow(/signature/i);
  });

  it('rejects a tampered payload signed for the original body', async () => {
    const signature = sign(subscriptionEvent);
    const tampered = subscriptionEvent.replace('"status":"active"', '"status":"trialing"');
    await expect(provider.parseWebhook(tampered, signature)).rejects.toThrow(/signature/i);
  });

  it('rejects a replayed event older than the tolerance window', async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 3600;
    await expect(
      provider.parseWebhook(
        subscriptionEvent,
        sign(subscriptionEvent, WEBHOOK_SECRET, oldTimestamp),
      ),
    ).rejects.toThrow(/expirée|signature/i);
  });

  it('rejects a malformed signature header', async () => {
    for (const header of ['', 'garbage', 't=123', 'v1=abc', 't=abc,v1=def']) {
      await expect(provider.parseWebhook(subscriptionEvent, header)).rejects.toThrow(/signature/i);
    }
  });

  it('maps a deletion back to the free plan', async () => {
    const body = JSON.stringify({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123', customer: 'cus_123', status: 'canceled' } },
    });
    const event = await provider.parseWebhook(body, sign(body));
    expect(event.type).toBe('subscription.deleted');
    expect(event.plan).toBe('free');
    expect(event.status).toBe('canceled');
  });

  it('ignores an event type it does not handle, rather than guessing', async () => {
    const body = JSON.stringify({ type: 'invoice.paid', data: { object: {} } });
    const event = await provider.parseWebhook(body, sign(body));
    expect(event.type).toBe('unhandled');
  });
});

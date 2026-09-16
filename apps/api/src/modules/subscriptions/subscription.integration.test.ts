import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  closeTestContext,
  createTestContext,
  registerUser,
  resetUserData,
  type TestContext,
} from '../../testing/harness.js';

const WEBHOOK_SECRET = 'whsec_integration_secret';

/**
 * The webhook is the only path that can grant a paid plan, and the raw request body is what the
 * signature covers. This suite runs the whole route — parser included — because the bug it
 * guards against (re-serialising the body) is invisible to a unit test of the provider.
 */
describe('subscription webhook', () => {
  let context: TestContext;
  let app: FastifyInstance;

  beforeAll(async () => {
    context = await createTestContext({
      PAYMENT_PROVIDER: 'stripe',
      PAYMENT_SECRET: 'sk_test_integration',
      PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET,
      PAYMENT_PREMIUM_PRICE_ID: 'price_test',
    });
    app = context.app;
  });

  beforeEach(async () => {
    await resetUserData(context.db);
  });

  afterAll(async () => {
    await closeTestContext();
  });

  const sign = (body: string, secret = WEBHOOK_SECRET) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return `t=${timestamp},v1=${signature}`;
  };

  /**
   * Deliberately pretty-printed: a handler that re-serialised the parsed body would produce
   * different bytes and fail verification, which is exactly the regression this guards.
   */
  const event = (customerId: string, status = 'active') =>
    JSON.stringify(
      {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_int_1',
            customer: customerId,
            status,
            cancel_at_period_end: false,
            current_period_end: 1_900_000_000,
          },
        },
      },
      null,
      2,
    );

  it('upgrades the plan from a correctly signed event', async () => {
    const user = await registerUser(app);
    await context.db.subscription.update({
      where: { userId: user.id },
      data: { providerCustomerId: 'cus_int_1', provider: 'stripe' },
    });

    const body = event('cus_int_1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': sign(body) },
      payload: body,
    });

    expect(response.statusCode).toBe(204);

    const state = await app.inject({
      method: 'GET',
      url: '/v1/subscriptions/me',
      headers: user.authHeader,
    });
    expect(state.json().plan).toBe('premium');
    expect(state.json().entitlements).toContain('market_radar');

    // The premium feature it unlocks is now reachable.
    const radar = await app.inject({
      method: 'GET',
      url: '/v1/markets/radar',
      headers: user.authHeader,
    });
    expect(radar.statusCode).toBe(200);
    expect(radar.json().themes.length).toBeGreaterThan(0);
  });

  it('refuses an unsigned or wrongly signed event and grants nothing', async () => {
    const user = await registerUser(app);
    await context.db.subscription.update({
      where: { userId: user.id },
      data: { providerCustomerId: 'cus_int_2', provider: 'stripe' },
    });
    const body = event('cus_int_2');

    const unsigned = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions/webhook',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    expect(unsigned.statusCode).toBe(403);

    const forged = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': sign(body, 'whsec_attacker'),
      },
      payload: body,
    });
    expect(forged.statusCode).toBe(403);

    const state = await app.inject({
      method: 'GET',
      url: '/v1/subscriptions/me',
      headers: user.authHeader,
    });
    expect(state.json().plan).toBe('free');
  });

  it('ignores an event for a customer it does not know', async () => {
    const body = event('cus_unknown');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': sign(body) },
      payload: body,
    });
    // Accepted (the signature is valid) but applied to nobody.
    expect(response.statusCode).toBe(204);
  });

  it('downgrades to free when the subscription is deleted', async () => {
    const user = await registerUser(app);
    await context.db.subscription.update({
      where: { userId: user.id },
      data: { providerCustomerId: 'cus_int_3', provider: 'stripe', plan: 'premium' },
    });

    const body = JSON.stringify(
      {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_int_1', customer: 'cus_int_3', status: 'canceled' } },
      },
      null,
      2,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': sign(body) },
      payload: body,
    });
    expect(response.statusCode).toBe(204);

    const state = await app.inject({
      method: 'GET',
      url: '/v1/subscriptions/me',
      headers: user.authHeader,
    });
    expect(state.json().plan).toBe('free');
    expect(state.json().entitlements).toEqual([]);
  });

  it('never lets a client grant itself a plan through the API', async () => {
    const user = await registerUser(app);

    // Attempting to write the subscription through the profile route must not work.
    const attempt = await app.inject({
      method: 'PATCH',
      url: '/v1/profile',
      headers: user.authHeader,
      payload: { firstName: 'Camille', plan: 'premium', subscription: { plan: 'premium' } },
    });
    expect(attempt.statusCode).toBe(200);

    const state = await app.inject({
      method: 'GET',
      url: '/v1/subscriptions/me',
      headers: user.authHeader,
    });
    expect(state.json().plan).toBe('free');
  });
});

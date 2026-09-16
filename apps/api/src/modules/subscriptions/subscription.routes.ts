import type { FastifyInstance } from 'fastify';
import { checkoutSchema } from '@nova/validation';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  const { subscriptions, analytics } = app.nova;

  app.get('/subscriptions/plans', async () => ({
    items: subscriptions.listPlans(),
    paymentEnabled: subscriptions.isPaymentEnabled,
  }));

  app.get('/subscriptions/me', { onRequest: app.authenticate }, async (request) => {
    const user = requireUser(request);
    return subscriptions.getState(user.id);
  });

  app.post('/subscriptions/checkout', { onRequest: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const input = parseInput(checkoutSchema, request.body);
    const session = await subscriptions.createCheckout(user.id, input);
    await analytics.track({
      event: 'subscription_started',
      userRef: user.id,
      properties: { plan: input.plan },
    });
    return session;
  });

  app.post('/subscriptions/cancel', { onRequest: app.authenticate }, async (request) => {
    const user = requireUser(request);
    return subscriptions.cancel(user.id);
  });

  /**
   * Provider webhook.
   *
   * Outside JWT auth by design: the signature on the raw body is the authentication. The raw
   * body is required, so this route uses its own content type parser.
   */
  app.post(
    '/subscriptions/webhook',
    {
      config: { rawBody: true },
      // The webhook must not be rate limited into failure by a burst of legitimate events.
      bodyLimit: 1_000_000,
    },
    async (request, reply) => {
      const signature =
        (request.headers['stripe-signature'] as string | undefined) ??
        (request.headers['x-signature'] as string | undefined);
      const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      await subscriptions.applyWebhook(rawBody, signature);
      return reply.status(204).send();
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { checkoutSchema } from '@nova/validation';
import { badRequest } from '../../http/errors.js';
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
   * Outside JWT auth by design: the signature on the raw body *is* the authentication.
   */
  app.post('/subscriptions/webhook', async (request, reply) => {
    const signature =
      (request.headers['stripe-signature'] as string | undefined) ??
      (request.headers['x-signature'] as string | undefined);

    // The signature covers the exact bytes received, preserved by the JSON parser declared in
    // app.ts. Re-serialising the parsed object would change the bytes (key order, spacing) and
    // no legitimate signature would ever verify.
    const rawBody = (request as typeof request & { rawBody?: string }).rawBody;
    if (rawBody === undefined) {
      throw badRequest('Corps de requête illisible pour la vérification de signature');
    }

    await subscriptions.applyWebhook(rawBody, signature);
    return reply.status(204).send();
  });
}

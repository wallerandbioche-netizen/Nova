import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { SubscriptionStatus } from '@nova/types';
import type { Env } from '../../../config/env.js';
import { forbidden, upstreamUnavailable } from '../../../http/errors.js';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  SubscriptionEvent,
} from './payment-provider.js';

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'past_due',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
};

const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string().optional(),
      customer: z.string().nullable().optional(),
      status: z.string().optional(),
      cancel_at_period_end: z.boolean().optional(),
      current_period_end: z.number().optional(),
    }),
  }),
});

/**
 * Stripe provider, implemented against the REST API directly (no SDK) so the dependency
 * surface of the payment path stays minimal and auditable.
 *
 * Webhook signatures are verified with a constant-time comparison before the payload is
 * parsed; an unverified event never reaches the database.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly isEnabled = true;
  private readonly secret: string;
  private readonly webhookSecret: string;
  private readonly priceId: string;

  constructor(
    env: Env,
    private readonly logger: Logger,
  ) {
    this.secret = env.PAYMENT_SECRET ?? '';
    this.webhookSecret = env.PAYMENT_WEBHOOK_SECRET ?? '';
    this.priceId = env.PAYMENT_PREMIUM_PRICE_ID ?? '';
  }

  async createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession> {
    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': this.priceId,
      'line_items[0][quantity]': '1',
      // The user id travels as metadata so the webhook can resolve the account without
      // trusting anything the client sends back.
      'metadata[userId]': request.userId,
      'subscription_data[metadata][userId]': request.userId,
      success_url: request.successUrl ?? 'nova://subscription/success',
      cancel_url: request.cancelUrl ?? 'nova://subscription/cancel',
    });
    if (request.customerId) body.set('customer', request.customerId);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secret}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.error({ status: response.status }, 'stripe checkout session creation failed');
      throw upstreamUnavailable('Le service de paiement est momentanément indisponible.');
    }

    const payload = (await response.json()) as { id?: string; url?: string; customer?: string };
    return {
      url: payload.url ?? null,
      sessionId: payload.id ?? null,
      providerCustomerId: payload.customer ?? null,
    };
  }

  /** Verifies the `t=…,v1=…` signature header against the raw request body. */
  private verifySignature(rawBody: string, signature: string | undefined): void {
    if (!signature || !this.webhookSecret) throw forbidden('Signature de webhook manquante');

    const parts = Object.fromEntries(
      signature.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key ?? '', value ?? ''];
      }),
    );
    const timestamp = parts.t;
    const provided = parts.v1;
    if (!timestamp || !provided) throw forbidden('Signature de webhook invalide');

    // Reject replays older than five minutes.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) throw forbidden('Signature de webhook expirée');

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw forbidden('Signature de webhook invalide');
    }
  }

  async parseWebhook(rawBody: string, signature: string | undefined): Promise<SubscriptionEvent> {
    this.verifySignature(rawBody, signature);

    const parsed = eventSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      return {
        type: 'unhandled',
        providerCustomerId: null,
        providerSubscriptionId: null,
        plan: 'free',
        status: 'incomplete',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    const object = parsed.data.data.object;
    const isDeletion = parsed.data.type === 'customer.subscription.deleted';
    const isUpdate = parsed.data.type.startsWith('customer.subscription.');

    return {
      type: isDeletion ? 'subscription.deleted' : isUpdate ? 'subscription.updated' : 'unhandled',
      providerCustomerId: object.customer ?? null,
      providerSubscriptionId: object.id ?? null,
      plan: isDeletion ? 'free' : 'premium',
      status: isDeletion ? 'canceled' : (STATUS_MAP[object.status ?? ''] ?? 'incomplete'),
      currentPeriodEnd: object.current_period_end
        ? new Date(object.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: object.cancel_at_period_end ?? false,
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.secret}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ cancel_at_period_end: 'true' }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw upstreamUnavailable('Impossible de mettre à jour l’abonnement pour le moment.');
    }
  }
}

import type { Logger } from 'pino';
import type { PlanDefinition, SubscriptionPlan, SubscriptionState } from '@nova/types';
import { entitlementsFor, PLANS } from '@nova/config';
import type { Env } from '../../config/env.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import { featureNotAvailable } from '../../http/errors.js';
import type { AuditLogService } from '../audit-logs/audit-log.service.js';
import type { PaymentProvider } from '../../services/payments/providers/index.js';

/**
 * Subscriptions.
 *
 * The backend is the single source of truth (rule #50): entitlements are always derived from
 * the stored subscription, which is only ever written from a signature-verified webhook.
 * Nothing the client sends can grant access to a premium feature.
 */
export class SubscriptionService {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly provider: PaymentProvider,
    private readonly auditLog: AuditLogService,
    private readonly logger: Logger,
  ) {}

  listPlans(): (PlanDefinition & { isPurchasable: boolean })[] {
    return Object.values(PLANS).map((plan) => ({
      ...plan,
      // Premium is only purchasable when a payment provider is actually configured; otherwise
      // the app shows it as "bientôt disponible" rather than a button that cannot work.
      isPurchasable: plan.key !== 'free' && this.provider.isEnabled,
    }));
  }

  async getState(userId: string): Promise<SubscriptionState> {
    const subscription = await this.db.subscription.upsert({
      where: { userId },
      create: { userId, plan: 'free', status: 'active', provider: 'none' },
      update: {},
    });

    const active = subscription.status === 'active' || subscription.status === 'trialing';
    const effectivePlan: SubscriptionPlan =
      subscription.plan === 'premium' && active ? 'premium' : 'free';

    return {
      plan: effectivePlan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      entitlements: entitlementsFor(effectivePlan),
      provider: subscription.provider,
    };
  }

  /** Effective plan, used by every quota and gated feature. */
  async getEffectivePlan(userId: string): Promise<SubscriptionPlan> {
    const state = await this.getState(userId);
    return state.plan;
  }

  async createCheckout(
    userId: string,
    input: { interval: 'month' | 'year'; successUrl?: string; cancelUrl?: string },
  ) {
    if (!this.provider.isEnabled) {
      throw featureNotAvailable(
        'Le paiement n’est pas encore activé. NOVA Premium sera disponible prochainement.',
      );
    }

    const subscription = await this.db.subscription.findUnique({ where: { userId } });
    const session = await this.provider.createCheckoutSession({
      userId,
      plan: 'premium',
      interval: input.interval,
      customerId: subscription?.providerCustomerId ?? null,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    if (session.providerCustomerId) {
      await this.db.subscription.upsert({
        where: { userId },
        create: {
          userId,
          provider: this.provider.name,
          providerCustomerId: session.providerCustomerId,
        },
        update: { providerCustomerId: session.providerCustomerId },
      });
    }

    await this.auditLog.record({
      userId,
      action: 'subscription.checkout_started',
      resource: 'subscription',
      metadata: { plan: 'premium' },
    });

    return session;
  }

  /**
   * Applies a verified provider event. The signature is checked by the provider before this
   * is called; an unverified payload never reaches the database.
   */
  async applyWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    const event = await this.provider.parseWebhook(rawBody, signature);
    if (event.type === 'unhandled') return;

    const subscription = event.providerCustomerId
      ? await this.db.subscription.findFirst({
          where: { providerCustomerId: event.providerCustomerId },
        })
      : null;

    if (!subscription) {
      this.logger.warn(
        { providerCustomerId: event.providerCustomerId },
        'webhook for an unknown customer, ignored',
      );
      return;
    }

    await this.db.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: event.plan,
        status: event.status,
        providerSubscriptionId: event.providerSubscriptionId,
        currentPeriodEnd: event.currentPeriodEnd,
        cancelAtPeriodEnd: event.cancelAtPeriodEnd,
        provider: this.provider.name,
      },
    });

    await this.auditLog.record({
      userId: subscription.userId,
      action: 'subscription.updated',
      resource: 'subscription',
      resourceId: subscription.id,
      metadata: { plan: event.plan, status: event.status },
    });
  }

  async cancel(userId: string): Promise<SubscriptionState> {
    const subscription = await this.db.subscription.findUnique({ where: { userId } });
    if (!subscription?.providerSubscriptionId) {
      throw featureNotAvailable('Aucun abonnement actif à résilier.');
    }
    await this.provider.cancelSubscription(subscription.providerSubscriptionId);
    await this.db.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });
    await this.auditLog.record({
      userId,
      action: 'subscription.cancel_requested',
      resource: 'subscription',
      resourceId: subscription.id,
    });
    return this.getState(userId);
  }

  get paymentProviderName(): string {
    return this.provider.name;
  }

  get isPaymentEnabled(): boolean {
    return this.provider.isEnabled && this.env.PAYMENT_PROVIDER !== 'none';
  }
}

import { prisma } from '@/lib/db/prisma';
import { getCoreEnv, getStripeConfig } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getStripe } from '@/lib/stripe/client';
import type {
  BillingStore,
  NormalizedSubscription,
  StripeGateway,
  StripeSubscriptionLike,
} from './stripe-events';

/** Public price of the single MVP plan, kept in one place for the UI. */
export const PRO_PLAN = {
  name: 'Scan Trade Pro',
  priceLabel: '19,90 €',
  period: '/ mois',
  amountCents: 1990,
  currency: 'EUR',
  features: [
    'Analyse IA des charts',
    'Upload de captures',
    'Niveaux clés',
    'Scénarios potentiels',
    'Entry / SL / TP',
    'Risk / Reward',
    'Historique complet',
    'Dashboard',
    'Résiliation à tout moment',
  ],
} as const;

export const prismaBillingStore: BillingStore = {
  async findUserIdByCustomerId(customerId) {
    const row = await prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
      select: { userId: true },
    });
    return row?.userId ?? null;
  },

  async findUserIdBySubscriptionId(subscriptionId) {
    const row = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      select: { userId: true },
    });
    return row?.userId ?? null;
  },

  async upsertSubscription(userId: string, subscription: NormalizedSubscription) {
    const data = {
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripePriceId: subscription.stripePriceId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },

  async markCanceled(stripeSubscriptionId: string) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: { status: 'CANCELED', cancelAtPeriodEnd: false },
    });
  },

  async isEventProcessed(eventId: string) {
    const row = await prisma.processedStripeEvent.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    return row != null;
  },

  async markEventProcessed(eventId: string, type: string) {
    await prisma.processedStripeEvent.upsert({
      where: { id: eventId },
      create: { id: eventId, type },
      update: {},
    });
  },
};

export const stripeGateway: StripeGateway = {
  async retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionLike> {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    return subscription as unknown as StripeSubscriptionLike;
  },
};

/**
 * Returns the Stripe customer id for a user, creating the customer on first use.
 *
 * The user id is written into customer metadata so a webhook that arrives
 * before our own row is committed can still be attributed.
 */
export async function ensureStripeCustomer(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<string> {
  const existing = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { stripeCustomerId: true },
  });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
    metadata: { userId: user.id },
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, stripeCustomerId: customer.id, status: 'NONE' },
    update: { stripeCustomerId: customer.id },
  });

  logger.info('billing.customer_created', { userId: user.id });
  return customer.id;
}

export async function createCheckoutSession(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<{ url: string }> {
  const config = getStripeConfig();
  const appUrl = getCoreEnv().APP_URL;
  const customerId = await ensureStripeCustomer(user);

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: config.priceId, quantity: 1 }],
    // Both of these are read back by the webhook to attribute the payment.
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    success_url: `${appUrl}/abonnement/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/abonnement?checkout=annule`,
  });

  if (!session.url) throw new AppError('billing_error');
  logger.info('billing.checkout_created', { userId: user.id, sessionId: session.id });
  return { url: session.url };
}

export async function createPortalSession(userId: string): Promise<{ url: string }> {
  const appUrl = getCoreEnv().APP_URL;
  const row = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  if (!row?.stripeCustomerId) {
    throw new AppError('billing_error', "Aucun abonnement Stripe n'est rattaché à ce compte.");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${appUrl}/abonnement`,
  });

  return { url: session.url };
}

/**
 * Confirms a checkout server-side (§24).
 *
 * The browser coming back with `?session_id=` proves nothing; this re-reads the
 * session from Stripe and syncs the subscription. The webhook remains the
 * authoritative path — this only closes the gap for a user who lands on the
 * confirmation page before the webhook is delivered.
 */
export async function confirmCheckoutSession(userId: string, sessionId: string): Promise<boolean> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });

  const ownerId = session.client_reference_id ?? session.metadata?.userId ?? null;
  if (ownerId && ownerId !== userId) {
    logger.warn('billing.checkout_owner_mismatch', { userId, sessionId });
    throw AppError.forbidden("Cette session de paiement n'appartient pas à ce compte.");
  }

  if (session.status !== 'complete' || session.payment_status === 'unpaid') return false;

  const subscription = session.subscription;
  if (!subscription) return false;

  const full =
    typeof subscription === 'string'
      ? await stripeGateway.retrieveSubscription(subscription)
      : (subscription as unknown as StripeSubscriptionLike);

  const { normalizeStripeSubscription } = await import('./stripe-events');
  const normalized = normalizeStripeSubscription(full);
  if (!normalized) return false;

  await prismaBillingStore.upsertSubscription(userId, normalized);
  logger.info('billing.checkout_confirmed', { userId, status: normalized.status });
  return true;
}

/** Cancels the Stripe subscription outright — used when an account is deleted. */
export async function cancelSubscriptionForUser(userId: string): Promise<void> {
  const row = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true },
  });
  if (!row?.stripeSubscriptionId) return;

  try {
    await getStripe().subscriptions.cancel(row.stripeSubscriptionId);
    logger.info('billing.subscription_canceled_on_delete', { userId });
  } catch (error) {
    // The account deletion must go through regardless; this is logged so the
    // dangling subscription can be reconciled.
    logger.error('billing.cancel_on_delete_failed', { userId, error });
  }
}

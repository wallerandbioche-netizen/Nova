import type { SubscriptionPlan, SubscriptionStatus } from '@nova/types';

/**
 * Payment provider contract.
 *
 * The backend is the single source of truth for subscription status: it is only ever updated
 * from a *verified* provider webhook, never from a client-supplied payload (rule #50).
 */
export interface CheckoutRequest {
  userId: string;
  plan: Exclude<SubscriptionPlan, 'free'>;
  interval: 'month' | 'year';
  customerId: string | null;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSession {
  /** URL the app opens to complete payment. Null when no provider is configured. */
  url: string | null;
  sessionId: string | null;
  providerCustomerId: string | null;
}

export interface SubscriptionEvent {
  type: 'subscription.updated' | 'subscription.deleted' | 'unhandled';
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface PaymentProvider {
  readonly name: string;
  readonly isEnabled: boolean;
  createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Verifies the webhook signature and parses the event. Throws when the signature is invalid. */
  parseWebhook(rawBody: string, signature: string | undefined): Promise<SubscriptionEvent>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
}

import { featureNotAvailable } from '../../../http/errors.js';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  SubscriptionEvent,
} from './payment-provider.js';

/**
 * No payment provider configured.
 *
 * Checkout fails loudly instead of pretending to succeed: a button that appears to work but
 * does nothing is exactly the kind of fake implementation rule #63 forbids. The app reads
 * `isEnabled` and presents the premium plan as "bientôt disponible" rather than offering a
 * dead checkout.
 */
export class DisabledPaymentProvider implements PaymentProvider {
  readonly name = 'none';
  readonly isEnabled = false;

  async createCheckoutSession(_request: CheckoutRequest): Promise<CheckoutSession> {
    throw featureNotAvailable(
      'Le paiement n’est pas encore activé sur cet environnement. Aucun abonnement ne peut être souscrit pour le moment.',
    );
  }

  async parseWebhook(): Promise<SubscriptionEvent> {
    throw featureNotAvailable('Aucun prestataire de paiement n’est configuré.');
  }

  async cancelSubscription(): Promise<void> {
    throw featureNotAvailable('Aucun prestataire de paiement n’est configuré.');
  }
}

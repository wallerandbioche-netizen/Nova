import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { DisabledPaymentProvider } from './disabled-payment.provider.js';
import type { PaymentProvider } from './payment-provider.js';
import { StripePaymentProvider } from './stripe-payment.provider.js';

export * from './payment-provider.js';
export { DisabledPaymentProvider } from './disabled-payment.provider.js';
export { StripePaymentProvider } from './stripe-payment.provider.js';

export function createPaymentProvider(env: Env, logger: Logger): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'stripe') return new StripePaymentProvider(env, logger);
  return new DisabledPaymentProvider();
}

import 'server-only';

/**
 * Every integration is optional. When a piece is missing the product keeps
 * working in demonstration mode rather than failing — and says so, instead of
 * pretending an account or a payment exists.
 */
export interface ServerConfig {
  databaseUrl: string | undefined;
  stripeSecretKey: string | undefined;
  stripeWebhookSecret: string | undefined;
  priceMonthly: string | undefined;
  priceYearly: string | undefined;
  resendApiKey: string | undefined;
  emailFrom: string;
  appUrl: string;
  sessionSecret: string | undefined;
}

export function serverConfig(): ServerConfig {
  return {
    databaseUrl: process.env.DATABASE_URL,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceMonthly: process.env.STRIPE_PRICE_MONTHLY,
    priceYearly: process.env.STRIPE_PRICE_YEARLY,
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM ?? 'SCAN TRADE <onboarding@resend.dev>',
    appUrl: appUrl(),
    sessionSecret: process.env.SESSION_SECRET ?? process.env.STRIPE_SECRET_KEY,
  };
}

/** Absolute origin of the deployment, needed by Stripe redirects and e-mails. */
function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3100';
}

/** Accounts need a database and a way to send the sign-in link. */
export function accountsEnabled(config = serverConfig()): boolean {
  return Boolean(config.databaseUrl && config.sessionSecret);
}

/** Billing additionally needs Stripe and its two prices. */
export function billingEnabled(config = serverConfig()): boolean {
  return Boolean(
    accountsEnabled(config) &&
    config.stripeSecretKey &&
    (config.priceMonthly || config.priceYearly),
  );
}

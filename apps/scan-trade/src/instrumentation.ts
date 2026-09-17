/**
 * Boot-time configuration audit (§47).
 *
 * Runs once per server process. It never throws: a deployment that is missing
 * a Stripe key must still serve the landing page. What it does is make the gap
 * impossible to miss in the logs, so nobody discovers it from a user report.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { logger } = await import('@/lib/logger');
  const { isAIConfigured, isStripeConfigured, getStorageConfig } = await import('@/lib/env');
  const { assertMailerReadyForProduction } = await import('@/lib/mail');

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.AUTH_SECRET) missing.push('AUTH_SECRET');
  if (!isAIConfigured()) missing.push('AI_API_KEY');
  if (!isStripeConfigured()) missing.push('STRIPE_SECRET_KEY / STRIPE_PRICE_ID / STRIPE_WEBHOOK_SECRET');

  let storageDriver = 'unknown';
  try {
    storageDriver = getStorageConfig().driver;
  } catch (error) {
    missing.push('STORAGE_* (voir README)');
    logger.error('boot.storage_misconfigured', { error });
  }

  if (missing.length > 0) {
    const level = process.env.NODE_ENV === 'production' ? 'error' : 'warn';
    logger[level]('boot.configuration_incomplete', {
      missing,
      hint: 'Les fonctionnalités correspondantes échoueront avec une erreur de configuration explicite.',
    });
  }

  if (process.env.NODE_ENV === 'production' && storageDriver === 'local') {
    logger.error('boot.local_storage_in_production', {
      hint: "Le driver « local » écrit sur le disque de l'instance : les captures seront perdues au redéploiement. Utilisez STORAGE_DRIVER=s3.",
    });
  }

  assertMailerReadyForProduction();

  logger.info('boot.ready', {
    nodeEnv: process.env.NODE_ENV,
    storageDriver,
    aiConfigured: isAIConfigured(),
    stripeConfigured: isStripeConfigured(),
  });
}

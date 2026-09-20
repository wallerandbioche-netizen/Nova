import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { accountsEnabled, billingEnabled, serverConfig } from './env';

const ENV = { ...process.env };

function clear(): void {
  for (const key of [
    'DATABASE_URL',
    'SESSION_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_MONTHLY',
    'STRIPE_PRICE_YEARLY',
    'NEXT_PUBLIC_APP_URL',
    'VERCEL_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
  ]) {
    delete process.env[key];
  }
}

beforeEach(clear);
afterEach(() => {
  process.env = { ...ENV };
});

describe('feature gates', () => {
  it('runs in demonstration mode when nothing is configured', () => {
    expect(accountsEnabled()).toBe(false);
    expect(billingEnabled()).toBe(false);
  });

  it('needs both a database and a session secret for accounts', () => {
    process.env.DATABASE_URL = 'postgres://localhost/scan';
    expect(accountsEnabled()).toBe(false);

    process.env.SESSION_SECRET = 'secret-de-test-assez-long';
    expect(accountsEnabled()).toBe(true);
  });

  it('only enables billing once accounts, Stripe and a price are present', () => {
    process.env.DATABASE_URL = 'postgres://localhost/scan';
    process.env.SESSION_SECRET = 'secret-de-test-assez-long';
    expect(billingEnabled()).toBe(false);

    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(billingEnabled()).toBe(false);

    process.env.STRIPE_PRICE_MONTHLY = 'price_month';
    expect(billingEnabled()).toBe(true);
  });

  it('falls back to the Stripe key when no session secret is set', () => {
    process.env.DATABASE_URL = 'postgres://localhost/scan';
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(serverConfig().sessionSecret).toBe('sk_test_x');
    expect(accountsEnabled()).toBe(true);
  });
});

describe('appUrl', () => {
  it('prefers the explicit public URL and trims a trailing slash', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://scan-trade.app/';
    expect(serverConfig().appUrl).toBe('https://scan-trade.app');
  });

  it('uses the deployment host when nothing is set', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'scan-trade.vercel.app';
    expect(serverConfig().appUrl).toBe('https://scan-trade.vercel.app');
  });

  it('falls back to the local development server', () => {
    expect(serverConfig().appUrl).toBe('http://localhost:3100');
  });
});

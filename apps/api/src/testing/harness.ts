import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { buildApp } from '../app.js';
import { parseEnv, setEnv, type Env } from '../config/env.js';
import { MemoryCache } from '../infrastructure/cache/index.js';
import { createPrismaClient, type Database } from '../infrastructure/database/prisma.js';

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  env: Env;
  cache: MemoryCache;
}

let context: TestContext | null = null;

/** Builds the app once per test file, against the test database and demo providers. */
export async function createTestContext(overrides: Partial<NodeJS.ProcessEnv> = {}): Promise<TestContext> {
  if (context) return context;

  const env = parseEnv({ ...process.env, ...overrides });
  setEnv(env);

  const db = createPrismaClient(env.DATABASE_URL);
  const cache = new MemoryCache();
  const logger = pino({ level: 'silent' });

  const app = await buildApp({ env, db, cache, logger, withDocs: false });
  await app.ready();

  context = { app, db, env, cache };
  return context;
}

export async function closeTestContext(): Promise<void> {
  if (!context) return;
  await context.app.close();
  await context.db.$disconnect();
  context = null;
}

/**
 * Wipes user-generated data between tests while keeping reference data (sectors, assets,
 * prices, news, lessons) seeded, so each test starts from a known, realistic state.
 */
export async function resetUserData(db: Database): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      ai_messages, ai_conversations, audit_logs, daily_brief_items, daily_briefs,
      devices, journal_entries, learning_progress, notifications, notification_preferences,
      password_reset_tokens, positions, portfolios, refresh_tokens, subscriptions,
      investor_profiles, users
    RESTART IDENTITY CASCADE
  `);
}

export interface RegisteredUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  authHeader: { authorization: string };
}

let userCounter = 0;

/** Registers a user through the real HTTP route, returning usable credentials. */
export async function registerUser(
  app: FastifyInstance,
  overrides: Partial<{ email: string; password: string; firstName: string }> = {},
): Promise<RegisteredUser> {
  userCounter += 1;
  const email = overrides.email ?? `camille+${userCounter}-${Date.now()}@example.com`;
  const password = overrides.password ?? 'phrase-de-test-2026';

  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email,
      password,
      firstName: overrides.firstName ?? 'Camille',
      acceptedTerms: true,
    },
  });

  if (response.statusCode !== 201) {
    throw new Error(`registration failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json() as {
    user: { id: string; email: string };
    tokens: { accessToken: string; refreshToken: string };
  };

  return {
    id: body.user.id,
    email: body.user.email,
    accessToken: body.tokens.accessToken,
    refreshToken: body.tokens.refreshToken,
    authHeader: { authorization: `Bearer ${body.tokens.accessToken}` },
  };
}

/** Completes onboarding so the user reaches the state the app's main screens expect. */
export async function completeOnboarding(
  app: FastifyInstance,
  user: RegisteredUser,
  options: { withPositions?: boolean } = {},
): Promise<{ portfolioId: string | null }> {
  await app.inject({
    method: 'PUT',
    url: '/v1/profile/investor',
    headers: user.authHeader,
    payload: {
      investmentGoal: 'build_wealth',
      investmentHorizon: '10_to_20_years',
      experienceLevel: 'beginner',
      riskTolerance: 'cautious',
      interestedAssetTypes: ['etf', 'stock'],
    },
  });

  let portfolioId: string | null = null;

  if (options.withPositions !== false) {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/portfolios',
      headers: user.authHeader,
      payload: { name: 'Mon portefeuille', baseCurrency: 'EUR' },
    });
    portfolioId = (created.json() as { id: string }).id;

    for (const position of [
      { symbol: 'CW8.PA', quantity: 10, averagePrice: 440 },
      { symbol: 'AAPL', quantity: 5, averagePrice: 200, currency: 'USD' },
    ]) {
      await app.inject({
        method: 'POST',
        url: `/v1/portfolios/${portfolioId}/positions`,
        headers: user.authHeader,
        payload: position,
      });
    }
  }

  await app.inject({
    method: 'POST',
    url: '/v1/profile/onboarding/complete',
    headers: user.authHeader,
  });

  return { portfolioId };
}

/**
 * Integration test environment.
 *
 * Runs against a real PostgreSQL database (TEST_DATABASE_URL) with demo providers, so the
 * tests exercise Prisma, the HTTP layer and the services exactly as production does — only the
 * external providers are deterministic.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://nova:nova@127.0.0.1:5432/nova_test?schema=public';
process.env.JWT_SECRET ??= 'integration-test-secret-with-enough-length-0123456789';
process.env.LOG_LEVEL = 'silent';
process.env.MARKET_DATA_PROVIDER = 'demo';
process.env.NEWS_PROVIDER = 'demo';
process.env.LLM_PROVIDER = 'demo';
process.env.MAIL_PROVIDER = 'log';
process.env.JOBS_ENABLED = 'false';
// Rate limits are raised so a test suite is not throttled by its own speed; the limiter itself
// is covered by a dedicated test that lowers them.
process.env.RATE_LIMIT_GLOBAL_MAX = '10000';
process.env.RATE_LIMIT_LOGIN_MAX = '1000';
process.env.RATE_LIMIT_REGISTER_MAX = '1000';
process.env.RATE_LIMIT_AI_MAX = '1000';

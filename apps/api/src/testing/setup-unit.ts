/**
 * Unit test environment. No database, no Redis, no network: every provider runs in demo mode.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://nova:nova@127.0.0.1:5432/nova_test?schema=public';
process.env.JWT_SECRET ??= 'unit-test-secret-value-with-enough-length-0123456789';
process.env.LOG_LEVEL ??= 'silent';

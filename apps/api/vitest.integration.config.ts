import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts', 'src/e2e/**/*.test.ts'],
    setupFiles: ['src/testing/setup-integration.ts'],
    // Integration tests share one PostgreSQL database; a single worker keeps the
    // truncation between tests deterministic.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

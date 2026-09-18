import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Integration tests run against a real PostgreSQL database — credits, permissions and the full
 * journey are exactly the things a mock would lie about.
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @nova/studio test:integration
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // The tests share one database: run them in sequence.
    fileParallelism: false,
  },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    restoreMocks: true,
    // Keep the structured logs out of the test report; a test that needs them
    // raises the level itself.
    env: { LOG_LEVEL: 'error', NODE_ENV: 'test' },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'src/e2e/**', 'node_modules/**'],
    setupFiles: ['src/testing/setup-unit.ts'],
  },
});

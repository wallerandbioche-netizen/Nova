import { getEnv } from './config/env.js';
import { buildApp } from './app.js';
import { disconnectPrisma, getPrismaClient } from './infrastructure/database/prisma.js';
import { startScheduler } from './infrastructure/jobs/scheduler.js';

/**
 * API entrypoint.
 *
 * Boot order matters: configuration is validated first (so a misconfigured instance never
 * accepts traffic), then the app, then the background scheduler when this instance is
 * allowed to run jobs.
 */
async function main(): Promise<void> {
  const env = getEnv();
  const app = await buildApp({ env });

  const stopScheduler = env.JOBS_ENABLED ? startScheduler(app.nova) : null;

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    try {
      if (stopScheduler) await stopScheduler();
      await app.close();
      await disconnectPrisma();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    app.log.error({ err: reason }, 'unhandled rejection');
  });

  // Fail fast if the database is unreachable: a "healthy" API that cannot read anything is
  // worse than one that never started.
  await getPrismaClient().$queryRaw`SELECT 1`;

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  app.log.info(
    {
      port: env.API_PORT,
      marketData: env.MARKET_DATA_PROVIDER,
      news: env.NEWS_PROVIDER,
      llm: env.LLM_PROVIDER,
      jobs: env.JOBS_ENABLED,
    },
    'NOVA API ready',
  );
}

main().catch((error) => {
  console.error('Failed to start the NOVA API:', error);
  process.exit(1);
});

import { getEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import { createCache } from '../cache/index.js';
import { disconnectPrisma, getPrismaClient } from '../database/prisma.js';
import { createLogger } from '../logger.js';
import { createQueue, createWorker, registerRepeatableJobs } from './queue.js';
import { runDailyPipeline, runJob, type JobName } from './jobs.js';

/**
 * Worker entrypoint.
 *
 *   pnpm --filter @nova/api jobs                  → run the worker (BullMQ when Redis is set)
 *   pnpm --filter @nova/api jobs -- news:ingest   → run a single job once and exit
 *   pnpm --filter @nova/api jobs -- daily         → run the whole morning pipeline once
 */
async function main(): Promise<void> {
  const env = getEnv();
  const logger = createLogger();
  const db = getPrismaClient();
  const cache = createCache(env, logger);
  const container = buildContainer({ env, db, cache, logger });

  const argument = process.argv[2];

  if (argument === 'daily') {
    await runDailyPipeline(container);
    await disconnectPrisma();
    return;
  }

  if (argument) {
    const outcome = await runJob(container, argument as JobName);
    await disconnectPrisma();
    if (!outcome.ok) process.exitCode = 1;
    return;
  }

  if (!env.REDIS_URL) {
    logger.error(
      'REDIS_URL is required to run the worker. Without Redis, the API process schedules jobs in-process.',
    );
    process.exitCode = 1;
    await disconnectPrisma();
    return;
  }

  const queue = createQueue(env.REDIS_URL);
  await registerRepeatableJobs(queue, {
    briefCron: env.DAILY_BRIEF_CRON,
    timezone: env.JOBS_TIMEZONE,
  });

  const worker = createWorker(container, env.REDIS_URL);
  worker.on('failed', (job, error) => {
    logger.error({ err: error, job: job?.name }, 'job failed in worker');
  });
  logger.info({ timezone: env.JOBS_TIMEZONE }, 'NOVA worker ready');

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Worker failed to start:', error);
  process.exit(1);
});

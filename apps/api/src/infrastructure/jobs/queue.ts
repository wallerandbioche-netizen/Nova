import { Queue, Worker, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import type { NovaContainer } from '../../container.js';
import { runJob, type JobName } from './jobs.js';

/**
 * BullMQ queue.
 *
 * Used when Redis is configured: repeatable jobs are registered once and executed by a single
 * worker process, so a horizontally scaled API does not generate a brief per instance.
 */
export const QUEUE_NAME = 'nova-jobs';

export function createQueue(redisUrl: string): Queue {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return new Queue(QUEUE_NAME, { connection });
}

export async function registerRepeatableJobs(
  queue: Queue,
  options: { briefCron: string; timezone: string },
): Promise<void> {
  const repeat = (name: JobName, pattern: string): JobsOptions => ({
    repeat: { pattern, tz: options.timezone },
    jobId: `repeat:${name}`,
    removeOnComplete: 50,
    removeOnFail: 100,
  });

  await queue.add('news:ingest', { name: 'news:ingest' }, repeat('news:ingest', '15 * * * *'));
  await queue.add(
    'market:refresh',
    { name: 'market:refresh' },
    repeat('market:refresh', '0 * * * *'),
  );
  await queue.add(
    'brief:generate',
    { name: 'brief:generate' },
    repeat('brief:generate', options.briefCron),
  );
  await queue.add(
    'notifications:daily-brief',
    { name: 'notifications:daily-brief' },
    repeat('notifications:daily-brief', shiftCronByMinutes(options.briefCron, 10)),
  );
  await queue.add(
    'retention:purge',
    { name: 'retention:purge' },
    repeat('retention:purge', '0 3 * * *'),
  );
}

/** Shifts a `m h * * *` cron by a few minutes, to sequence the brief and its notification. */
export function shiftCronByMinutes(cron: string, minutes: number): string {
  const parts = cron.split(' ');
  const minute = Number(parts[0]);
  if (!Number.isFinite(minute)) return cron;
  const shifted = (minute + minutes) % 60;
  const hourCarry = Math.floor((minute + minutes) / 60);
  const hour = Number(parts[1]);
  const shiftedHour = Number.isFinite(hour) ? (hour + hourCarry) % 24 : parts[1];
  return [shifted, shiftedHour, parts[2], parts[3], parts[4]].join(' ');
}

export function createWorker(container: NovaContainer, redisUrl: string): Worker {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker(
    QUEUE_NAME,
    async (job) => {
      const name = (job.data as { name: JobName }).name ?? (job.name as JobName);
      const outcome = await runJob(container, name);
      if (!outcome.ok) throw new Error(outcome.error ?? 'job failed');
      return outcome.result;
    },
    {
      connection,
      concurrency: 2,
      // Retries with backoff: a transient provider outage should not lose the morning run.
      settings: { backoffStrategy: (attempts) => Math.min(attempts * 30_000, 300_000) },
    },
  );
}

import type { NovaContainer } from '../../container.js';
import { runDailyPipeline, runJob } from './jobs.js';

/**
 * Scheduler.
 *
 * With Redis available, BullMQ owns the schedule so only one instance runs each job
 * (see queue.ts). Without Redis — local development — an in-process timer runs the same
 * pipeline, so the product behaves identically with no extra infrastructure.
 */
export interface SchedulerHandle {
  (): Promise<void>;
}

/** Milliseconds until the next occurrence of `hour:00` in the configured timezone. */
export function msUntilNextHour(hour: number, timeZone: string, now = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, Number(part.value)]),
  ) as { hour: number; minute: number; second: number };

  const currentSeconds = (parts.hour % 24) * 3600 + parts.minute * 60 + parts.second;
  const targetSeconds = hour * 3600;
  const delta = targetSeconds - currentSeconds;
  const seconds = delta > 0 ? delta : delta + 86_400;
  return seconds * 1000;
}

export function startScheduler(container: NovaContainer): SchedulerHandle {
  const { env, logger } = container;
  const briefHour = Number(env.DAILY_BRIEF_CRON.split(' ')[1] ?? 6);
  const timers: NodeJS.Timeout[] = [];
  let stopped = false;

  const scheduleDaily = (hour: number, task: () => Promise<void>, label: string) => {
    const schedule = () => {
      if (stopped) return;
      const delay = msUntilNextHour(hour, env.JOBS_TIMEZONE);
      logger.info(
        { label, hour, timezone: env.JOBS_TIMEZONE, inMinutes: Math.round(delay / 60_000) },
        'job scheduled',
      );
      const timer = setTimeout(() => {
        void task()
          .catch((error) => logger.error({ err: error, label }, 'scheduled task failed'))
          .finally(schedule);
      }, delay);
      // Do not hold the process open only to wait for the next run.
      timer.unref?.();
      timers.push(timer);
    };
    schedule();
  };

  scheduleDaily(briefHour, () => runDailyPipeline(container), 'daily-pipeline');
  scheduleDaily(3, async () => {
    await runJob(container, 'retention:purge');
  }, 'retention-purge');

  // Intraday market refresh so the dashboard is not a day behind during the session.
  const intraday = setInterval(
    () => {
      void runJob(container, 'market:refresh');
    },
    60 * 60 * 1000,
  );
  intraday.unref?.();
  timers.push(intraday);

  return async () => {
    stopped = true;
    for (const timer of timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    logger.info('scheduler stopped');
  };
}

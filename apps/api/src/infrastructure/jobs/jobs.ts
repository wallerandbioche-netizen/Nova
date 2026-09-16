import type { NovaContainer } from '../../container.js';
import { NotificationService } from '../../services/notifications/notification.service.js';

/**
 * Background jobs.
 *
 * The daily pipeline is the product's heartbeat (rule #41):
 *
 *   06:00 → news collection → market data update → analysis → portfolio matching →
 *   personalised briefs → store → notification
 *
 * Each job is idempotent, so a retry never duplicates data, and each records a `JobRun` row
 * for observability.
 */
export type JobName =
  | 'news:ingest'
  | 'market:refresh'
  | 'brief:generate'
  | 'notifications:daily-brief'
  | 'notifications:important-news'
  | 'retention:purge';

export interface JobResult {
  [key: string]: number | string | boolean | null;
}

export type JobHandler = (container: NovaContainer) => Promise<JobResult>;

export const jobs: Record<JobName, JobHandler> = {
  /** Fetches, deduplicates, classifies and scores new items. */
  'news:ingest': async (container) => {
    const since = new Date(Date.now() - 48 * 3_600_000);
    const report = await container.news.ingest({ since, limit: 60 });
    return { ...report };
  },

  /** Refreshes quotes for every held asset, the dashboard indices and FX rates. */
  'market:refresh': async (container) => {
    const [positions, assets] = await Promise.all([
      container.db.position.findMany({
        select: { asset: { select: { symbol: true } }, currency: true },
        distinct: ['assetId'],
      }),
      container.db.asset.findMany({ select: { symbol: true }, take: 500 }),
    ]);

    // Held assets first, then the rest of the catalogue: a user's own positions must never be
    // the ones missing a price.
    const heldSymbols = positions.map((position) => position.asset.symbol);
    const symbols = [...new Set([...heldSymbols, ...assets.map((asset) => asset.symbol)])];

    const currencies = [...new Set(positions.map((position) => position.currency))];
    const [quotes, indices] = await Promise.all([
      container.marketData.refreshQuotes(symbols),
      container.marketData.refreshIndices(),
    ]);
    await container.marketData.refreshFxRates([...currencies, 'USD', 'GBP', 'CHF']);

    return { quotes, indices, symbols: symbols.length };
  },

  /** Generates today's brief for every active user. */
  'brief:generate': async (container) => {
    const result = await container.dailyBriefs.generateForAllUsers();
    return { ...result };
  },

  /** Tells users their brief is ready, honouring preferences and quiet hours. */
  'notifications:daily-brief': async (container) => {
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const briefs = await container.db.dailyBrief.findMany({
      where: { date: today },
      select: { userId: true, id: true },
    });

    let sent = 0;
    for (const brief of briefs) {
      const copy = NotificationService.copyFor('daily_brief');
      const notification = await container.notifications.notify({
        userId: brief.userId,
        type: 'daily_brief',
        title: copy.title,
        body: copy.body,
        link: `/brief/${brief.id}`,
      });
      if (notification) sent += 1;
    }
    return { briefs: briefs.length, sent };
  },

  /**
   * Notifies users when a high-importance item strongly touches their portfolio.
   * The threshold is deliberately high: NOVA does not buzz for noise.
   */
  'notifications:important-news': async (container) => {
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const briefs = await container.db.dailyBrief.findMany({
      where: { date: today },
      include: { items: { where: { portfolioRelevanceScore: { gte: 70 } } } },
    });

    let sent = 0;
    for (const brief of briefs) {
      if (brief.items.length === 0) continue;
      const copy = NotificationService.copyFor('important_news', { count: brief.items.length });
      const first = brief.items[0];
      const notification = await container.notifications.notify({
        userId: brief.userId,
        type: 'important_news',
        title: copy.title,
        body: copy.body,
        link: first ? `/news/${first.newsId}` : `/brief/${brief.id}`,
      });
      if (notification) sent += 1;
    }
    return { sent };
  },

  /** Purges anonymised accounts past the retention window and expired tokens. */
  'retention:purge': async (container) => {
    const result = await container.account.purgeExpired();
    return { ...result };
  },
};

/** Runs a job, recording its outcome and duration. Never throws to the caller. */
export async function runJob(
  container: NovaContainer,
  name: JobName,
): Promise<{ ok: boolean; result?: JobResult; error?: string }> {
  const startedAt = Date.now();
  const run = await container.db.jobRun.create({
    data: { jobName: name, status: 'running' },
  });

  try {
    const result = await jobs[name](container);
    const durationMs = Date.now() - startedAt;
    await container.db.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        durationMs,
        metadata: result as never,
      },
    });
    container.logger.info({ job: name, durationMs, ...result }, 'job completed');
    return { ok: true, result };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'unknown error';
    await container.db.jobRun.update({
      where: { id: run.id },
      data: { status: 'failed', finishedAt: new Date(), durationMs, error: message.slice(0, 500) },
    });
    container.logger.error({ err: error, job: name, durationMs }, 'job failed');
    return { ok: false, error: message };
  }
}

/**
 * The full morning pipeline, in order. A failed step is logged and the next one still runs on
 * the data already available — a market data outage must not cost users their brief.
 */
export async function runDailyPipeline(container: NovaContainer): Promise<void> {
  const sequence: JobName[] = [
    'news:ingest',
    'market:refresh',
    'brief:generate',
    'notifications:daily-brief',
    'notifications:important-news',
  ];

  for (const name of sequence) {
    const outcome = await runJob(container, name);
    if (!outcome.ok) {
      container.logger.warn({ job: name }, 'continuing the pipeline after a failed step');
    }
  }
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runJob } from '../../infrastructure/jobs/jobs.js';
import {
  closeTestContext,
  completeOnboarding,
  createTestContext,
  registerUser,
  resetUserData,
  type RegisteredUser,
  type TestContext,
} from '../../testing/harness.js';

describe('daily brief and jobs', () => {
  let context: TestContext;
  let app: FastifyInstance;
  let user: RegisteredUser;

  beforeAll(async () => {
    context = await createTestContext();
    app = context.app;
  });

  beforeEach(async () => {
    await resetUserData(context.db);
    await context.cache.close();
    user = await registerUser(app);
    await completeOnboarding(app, user);
  });

  afterAll(async () => {
    await closeTestContext();
  });

  describe('GET /brief/today', () => {
    it('builds a brief carrying its data cut-off and its sources', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/brief/today',
        headers: user.authHeader,
      });

      expect(response.statusCode).toBe(200);
      const brief = response.json();

      expect(brief.greeting).toContain('Camille');
      expect(brief.items.length).toBeGreaterThan(0);
      expect(brief.marketSummary.text).toBeTruthy();
      expect(brief.dataAsOf).toBeTruthy();
      expect(brief.isStale).toBe(false);
      // Demo data must be disclosed inside the brief itself, not only in the metadata.
      expect(brief.meta.isDemo).toBe(true);
      expect(brief.uncertainties.join(' ')).toMatch(/démonstration/i);

      for (const item of brief.items) {
        expect(item.takeaway).toBeTruthy();
        expect(item.source).toBeTruthy();
        expect(item.takeaway).not.toMatch(/achet|vend/i);
      }
    });

    it('limits the free plan to three items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/brief/today',
        headers: user.authHeader,
      });
      expect(response.json().items.length).toBeLessThanOrEqual(3);
    });

    it('is idempotent: asking twice returns the same stored brief', async () => {
      const first = await app.inject({
        method: 'GET',
        url: '/v1/brief/today',
        headers: user.authHeader,
      });
      const second = await app.inject({
        method: 'GET',
        url: '/v1/brief/today',
        headers: user.authHeader,
      });

      expect(second.json().id).toBe(first.json().id);
      expect(await context.db.dailyBrief.count({ where: { userId: user.id } })).toBe(1);
    });

    it('serves an older brief marked stale, with its real date, rather than nothing', async () => {
      // Store a brief dated three days ago and none for today.
      const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
      const date = new Date(`${threeDaysAgo.toISOString().slice(0, 10)}T00:00:00.000Z`);

      await context.db.dailyBrief.create({
        data: {
          userId: user.id,
          date,
          dataAsOf: threeDaysAgo,
          generatedAt: threeDaysAgo,
          isDemo: true,
          content: {
            id: '',
            date: date.toISOString().slice(0, 10),
            greeting: 'Bonjour, Camille 👋',
            headline: 'Briefing plus ancien',
            summary: 'Résumé enregistré.',
            marketSummary: { kind: 'data', text: 'Marchés.' },
            portfolioSummary: null,
            items: [],
            learningSuggestionId: null,
            uncertainties: [],
            generatedAt: threeDaysAgo.toISOString(),
            dataAsOf: threeDaysAgo.toISOString(),
            isStale: false,
            isFallback: false,
            meta: { asOf: threeDaysAgo.toISOString(), isDemo: true, provider: 'test' },
          } as never,
        },
      });

      const brief = await context.container.dailyBriefs.getToday(user.id);
      expect(brief).not.toBeNull();
      expect(brief?.isStale).toBe(true);
      expect(brief?.date).toBe(date.toISOString().slice(0, 10));
      expect(brief?.headline).toBe('Briefing plus ancien');
    });

    it('produces a brief without a portfolio summary for a user with no positions', async () => {
      const newcomer = await registerUser(app);
      await completeOnboarding(app, newcomer, { withPositions: false });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/brief/today',
        headers: newcomer.authHeader,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().portfolioSummary).toBeNull();
      expect(response.json().items.length).toBeGreaterThan(0);
    });

    it('refuses to serve another user’s brief', async () => {
      const mine = await app.inject({
        method: 'GET',
        url: '/v1/brief/today',
        headers: user.authHeader,
      });
      const intruder = await registerUser(app);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/brief/${mine.json().id}`,
        headers: intruder.authHeader,
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('jobs', () => {
    it('ingests news idempotently: a second run inserts nothing new', async () => {
      const before = await context.db.news.count();

      const first = await runJob(context.container, 'news:ingest');
      expect(first.ok).toBe(true);

      const second = await runJob(context.container, 'news:ingest');
      expect(second.ok).toBe(true);
      expect(second.result?.inserted).toBe(0);
      expect(Number(second.result?.duplicates)).toBeGreaterThan(0);

      // Deduplication means the corpus does not grow on re-runs.
      expect(await context.db.news.count()).toBe(before);
    });

    it('refreshes market data and records the run', async () => {
      const outcome = await runJob(context.container, 'market:refresh');
      expect(outcome.ok).toBe(true);
      expect(Number(outcome.result?.quotes)).toBeGreaterThan(0);

      const run = await context.db.jobRun.findFirst({
        where: { jobName: 'market:refresh' },
        orderBy: { startedAt: 'desc' },
      });
      expect(run?.status).toBe('succeeded');
      expect(run?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('generates a brief for every active user', async () => {
      const outcome = await runJob(context.container, 'brief:generate');
      expect(outcome.ok).toBe(true);
      expect(Number(outcome.result?.generated)).toBeGreaterThan(0);
      expect(await context.db.dailyBrief.count({ where: { userId: user.id } })).toBe(1);
    });

    it('notifies users their brief is ready, honouring their preferences', async () => {
      await runJob(context.container, 'brief:generate');

      const sent = await runJob(context.container, 'notifications:daily-brief');
      expect(sent.ok).toBe(true);
      expect(
        await context.db.notification.count({ where: { userId: user.id, type: 'daily_brief' } }),
      ).toBe(1);

      // With the daily brief disabled, no notification is created.
      await context.db.notificationPreference.update({
        where: { userId: user.id },
        data: { dailyBrief: false },
      });
      await context.db.notification.deleteMany({ where: { userId: user.id } });
      await runJob(context.container, 'notifications:daily-brief');
      expect(await context.db.notification.count({ where: { userId: user.id } })).toBe(0);
    });

    it('records a failed job instead of throwing to the scheduler', async () => {
      // Simulate a provider outage inside the ingestion step. Object.create keeps the real
      // service's prototype so only `ingest` is overridden.
      const failingNews = Object.create(context.container.news) as typeof context.container.news;
      failingNews.ingest = async () => {
        throw new Error('provider down');
      };
      const broken: typeof context.container = { ...context.container, news: failingNews };

      const outcome = await runJob(broken, 'news:ingest');
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toContain('provider down');

      const run = await context.db.jobRun.findFirst({
        where: { jobName: 'news:ingest', status: 'failed' },
        orderBy: { startedAt: 'desc' },
      });
      expect(run?.error).toContain('provider down');
    });

    it('purges expired refresh tokens', async () => {
      await context.db.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: 'expired-token-hash',
          familyId: '11111111-1111-4111-8111-111111111111',
          expiresAt: new Date(Date.now() - 86_400_000),
        },
      });

      const outcome = await runJob(context.container, 'retention:purge');
      expect(outcome.ok).toBe(true);
      expect(
        await context.db.refreshToken.findUnique({ where: { tokenHash: 'expired-token-hash' } }),
      ).toBeNull();
    });
  });
});

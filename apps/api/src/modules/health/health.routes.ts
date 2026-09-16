import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const { db, cache, marketData, news, ai, subscriptions, env } = app.nova;

  /** Liveness: the process is up. Never touches a dependency. */
  app.get('/health', async () => ({ status: 'ok', uptime: Math.round(process.uptime()) }));

  /**
   * Readiness: can this instance actually serve traffic?
   * Reports each dependency separately so a degraded provider is visible without a 503 storm.
   */
  app.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await db.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (error) {
      checks.database = { ok: false, detail: (error as Error).name };
    }

    try {
      await cache.set('nova:health', '1', 10);
      checks.cache = { ok: (await cache.get<string>('nova:health')) === '1', detail: cache.kind };
    } catch {
      checks.cache = { ok: false, detail: cache.kind };
    }

    const [marketOk, newsOk, aiOk] = await Promise.all([
      marketData.healthCheck().catch(() => false),
      news.healthCheck().catch(() => false),
      ai.healthCheck().catch(() => false),
    ]);

    checks.marketData = { ok: marketOk, detail: marketData.providerName };
    checks.news = { ok: newsOk, detail: news.providerName };
    checks.ai = { ok: aiOk, detail: ai.providerName };
    checks.payments = { ok: true, detail: subscriptions.paymentProviderName };

    // Only the database being down makes the instance unready: a degraded provider is handled
    // gracefully by the services themselves.
    const ready = checks.database?.ok ?? false;
    return reply.status(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'degraded',
      environment: env.NODE_ENV,
      demoData: {
        marketData: marketData.isDemoProvider,
        news: news.isDemoProvider,
      },
      checks,
    });
  });
}

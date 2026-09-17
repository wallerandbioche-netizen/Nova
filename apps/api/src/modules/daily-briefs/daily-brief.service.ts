import type { Logger } from 'pino';
import type {
  DailyBrief,
  DailyBriefItem,
  NewsItem,
  PersonalizedNewsItem,
  Statement,
} from '@nova/types';
import {
  BRIEF_THRESHOLDS,
  DEMO_DATA_EXPLANATION,
  NEWS_CATEGORY_LABELS,
  getPlan,
} from '@nova/config';
import { uncapitalize } from '../../lib/text.js';
import type { Cache } from '../../infrastructure/cache/index.js';
import { cacheKey } from '../../infrastructure/cache/index.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import { notFound } from '../../http/errors.js';
import { buildPage, decodeCursor, type PageResult } from '../../http/pagination.js';
import type { MarketDataService } from '../../services/market-data/market-data.service.js';
import type { NewsService } from '../../services/news/news.service.js';
import type { PersonalizationService } from '../../services/personalization/personalization.service.js';
import type { AiService } from '../../services/ai/ai.service.js';
import type { PortfolioService } from '../portfolios/portfolio.service.js';
import type { LearningService } from '../learning/learning.service.js';

/**
 * Daily brief generation.
 *
 * Briefs are produced asynchronously by the 06:00 job and stored, never generated on app open
 * (rule #40). When today's generation failed, the last available brief is served with
 * `isStale: true` and its own date, so cached content is never displayed as current (rule #41).
 */
export class DailyBriefService {
  constructor(
    private readonly db: Database,
    private readonly cache: Cache,
    private readonly news: NewsService,
    private readonly personalization: PersonalizationService,
    private readonly portfolios: PortfolioService,
    private readonly marketData: MarketDataService,
    private readonly ai: AiService,
    private readonly learning: LearningService,
    private readonly logger: Logger,
  ) {}

  private dateKey(date: Date): Date {
    return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  /** Selects the items that deserve a place in today's brief for this user. */
  async selectItems(
    userId: string,
    maxItems: number,
    now: Date,
  ): Promise<{ items: PersonalizedNewsItem[]; isDemo: boolean }> {
    const since = new Date(now.getTime() - 36 * 3_600_000);
    const recent = await this.news.listRecent({ since, limit: 60 });
    const themes = await this.news.withThemes(recent);
    const exposure = await this.personalization.getExposure(userId);

    const scored = recent.map((item) => ({
      item,
      scored: { ...this.news.toScored(item), themeKeys: themes.get(item.id) ?? [] },
    }));

    const ranked = scored
      .map(({ item, scored: scoredItem }) => {
        const relevance = this.personalization.computeRelevance(scoredItem, exposure);
        return { item, relevance };
      })
      .filter(({ item, relevance }) => {
        // An item enters the brief if it is broadly important, or if it is personally relevant
        // even at a lower importance — that is the difference between a news feed and NOVA.
        const importantEnough =
          item.importanceScore >= BRIEF_THRESHOLDS.minImportance &&
          item.confidenceScore >= BRIEF_THRESHOLDS.minConfidence;
        const personallyRelevant = relevance.score >= BRIEF_THRESHOLDS.relevanceOverride;
        return importantEnough || personallyRelevant;
      })
      .sort(
        (a, b) =>
          b.item.importanceScore * 0.6 +
          b.relevance.score * 0.4 -
          (a.item.importanceScore * 0.6 + a.relevance.score * 0.4),
      )
      .slice(0, maxItems);

    return {
      items: ranked.map(({ item, relevance }) =>
        this.news.personalize(item, {
          score: relevance.score,
          reason: relevance.reason,
          exposurePercent: relevance.exposurePercent,
        }),
      ),
      isDemo: ranked.some(({ item }) => item.isDemo),
    };
  }

  /** Deterministic one-line takeaway; never a recommendation. */
  private buildTakeaway(item: NewsItem, relevanceReason: string | null): string {
    const factual = item.summary.split('. ')[0] ?? item.summary;
    const context =
      relevanceReason !== null
        ? `Cela peut concerner votre portefeuille : ${uncapitalize(relevanceReason)}.`
        : `Information de catégorie « ${
            NEWS_CATEGORY_LABELS[item.category] ?? item.category
          } », à lire pour le contexte de marché.`;
    return `${factual.trim()}${factual.trim().endsWith('.') ? '' : '.'} ${context}`;
  }

  async generateForUser(
    userId: string,
    options: { now?: Date; plan?: 'free' | 'premium' } = {},
  ): Promise<DailyBrief> {
    const now = options.now ?? new Date();
    const plan = options.plan ?? (await this.resolvePlan(userId));
    const maxItems =
      plan === 'premium' ? BRIEF_THRESHOLDS.maxItemsPremium : BRIEF_THRESHOLDS.maxItemsFree;

    const [user, { items, isDemo }, overview] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId }, select: { firstName: true } }),
      this.selectItems(userId, maxItems, now),
      this.marketData.getOverview(),
    ]);

    const exposure = await this.personalization.getExposure(userId);
    const portfolioInsight = this.personalization.buildPortfolioInsight(exposure, items);

    const marketSummary: Statement = {
      kind: 'data',
      text:
        overview.quotes.length > 0
          ? `Sur les dernières valeurs connues : ${overview.quotes
              .slice(0, 4)
              .map((quote) => `${quote.label} ${quote.changeLabel}`)
              .join(', ')}.`
          : 'Les données de marché ne sont pas disponibles pour le moment.',
    };

    const lesson = await this.learning.suggestLesson(userId, items);

    const briefItems: DailyBriefItem[] = items.map((item) => ({
      newsId: item.id,
      title: item.title,
      source: item.source,
      publishedAt: item.publishedAt,
      importanceScore: item.importanceScore,
      portfolioRelevanceScore: item.portfolioRelevanceScore,
      takeaway: this.buildTakeaway(item, item.relevanceReason),
      relevanceReason: item.relevanceReason,
    }));

    const headline =
      briefItems[0]?.title ?? 'Pas d’actualité majeure identifiée sur les dernières 36 heures';

    const summary =
      briefItems.length === 0
        ? 'Aucune actualité n’a dépassé le seuil d’importance retenu par NOVA sur cette période. C’est une information en soi : rien d’inhabituel n’a été détecté.'
        : `NOVA a retenu ${briefItems.length} information${briefItems.length > 1 ? 's' : ''} pour vous ce matin. ${
            items.some((item) => item.portfolioRelevanceScore >= 40)
              ? 'Au moins l’une d’elles touche une partie identifiable de votre portefeuille.'
              : 'Aucune ne concerne directement vos positions ; elles éclairent le contexte de marché.'
          }`;

    const dataAsOf = new Date(
      Math.max(
        ...[
          ...items.map((item) => new Date(item.publishedAt).getTime()),
          new Date(overview.meta.asOf).getTime(),
          now.getTime() - 86_400_000,
        ],
      ),
    );

    const content: DailyBrief = {
      id: '',
      date: now.toISOString().slice(0, 10),
      greeting: `Bonjour${user?.firstName ? `, ${user.firstName}` : ''} 👋`,
      headline,
      summary,
      marketSummary,
      portfolioSummary: portfolioInsight,
      items: briefItems,
      learningSuggestionId: lesson?.id ?? null,
      uncertainties: [
        'Les scores d’importance reflètent une priorité de lecture, pas une prévision de performance.',
        ...(isDemo || overview.meta.isDemo ? [DEMO_DATA_EXPLANATION] : []),
      ],
      generatedAt: now.toISOString(),
      dataAsOf: dataAsOf.toISOString(),
      isStale: false,
      isFallback: false,
      meta: {
        asOf: dataAsOf.toISOString(),
        isDemo: isDemo || overview.meta.isDemo,
        provider: this.news.providerName,
      },
    };

    const date = this.dateKey(now);
    const stored = await this.db.dailyBrief.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        content: content as never,
        dataAsOf,
        generatedAt: now,
        isDemo: content.meta.isDemo,
        items: {
          create: briefItems.map((item, index) => ({
            newsId: item.newsId,
            rank: index,
            takeaway: item.takeaway,
            relevanceReason: item.relevanceReason,
            portfolioRelevanceScore: item.portfolioRelevanceScore,
          })),
        },
      },
      update: {
        content: content as never,
        dataAsOf,
        generatedAt: now,
        isDemo: content.meta.isDemo,
        items: {
          deleteMany: {},
          create: briefItems.map((item, index) => ({
            newsId: item.newsId,
            rank: index,
            takeaway: item.takeaway,
            relevanceReason: item.relevanceReason,
            portfolioRelevanceScore: item.portfolioRelevanceScore,
          })),
        },
      },
    });

    await this.cache.delByPrefix(cacheKey('dashboard', userId));
    return { ...content, id: stored.id };
  }

  private async resolvePlan(userId: string): Promise<'free' | 'premium'> {
    const subscription = await this.db.subscription.findUnique({ where: { userId } });
    const plan = subscription?.plan ?? 'free';
    const active = subscription?.status === 'active' || subscription?.status === 'trialing';
    return plan === 'premium' && active ? 'premium' : 'free';
  }

  /**
   * Today's brief.
   *
   * If it does not exist yet, the most recent one is returned marked `isStale` with its real
   * date, so the app can say "Dernière mise à jour : …" instead of implying freshness.
   */
  async getToday(userId: string, now = new Date()): Promise<DailyBrief | null> {
    const today = this.dateKey(now);
    const stored = await this.db.dailyBrief.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (stored) {
      const content = stored.content as unknown as DailyBrief;
      return { ...content, id: stored.id, isStale: false };
    }

    const latest = await this.db.dailyBrief.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    if (!latest) return null;

    const content = latest.content as unknown as DailyBrief;
    this.logger.info({ userId, date: latest.date }, 'serving a previous brief marked as stale');
    return {
      ...content,
      id: latest.id,
      isStale: true,
      date: latest.date.toISOString().slice(0, 10),
      dataAsOf: latest.dataAsOf.toISOString(),
      generatedAt: latest.generatedAt.toISOString(),
    };
  }

  async getById(briefId: string, userId: string): Promise<DailyBrief> {
    const brief = await this.db.dailyBrief.findUnique({ where: { id: briefId } });
    if (!brief || brief.userId !== userId) throw notFound('Briefing introuvable');
    const content = brief.content as unknown as DailyBrief;
    const isToday = brief.date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    return { ...content, id: brief.id, isStale: !isToday };
  }

  async history(
    userId: string,
    options: { limit: number; cursor?: string; plan: 'free' | 'premium' },
  ): Promise<PageResult<{ id: string; date: string; headline: string; itemCount: number }>> {
    const cursor = decodeCursor(options.cursor);
    const historyDays = getPlan(options.plan).limits.briefHistoryDays;
    const floor =
      historyDays === null ? undefined : new Date(Date.now() - historyDays * 86_400_000);

    const rows = await this.db.dailyBrief.findMany({
      where: {
        userId,
        ...(floor ? { date: { gte: floor } } : {}),
        ...(cursor ? { date: { lt: new Date(cursor.timestamp) } } : {}),
      },
      orderBy: { date: 'desc' },
      take: options.limit + 1,
      include: { _count: { select: { items: true } } },
    });

    const page = buildPage(rows, options.limit, (row) => ({
      timestamp: row.date.toISOString(),
      id: row.id,
    }));

    return {
      ...page,
      items: page.items.map((row) => ({
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        headline: (row.content as unknown as DailyBrief).headline,
        itemCount: row._count.items,
      })),
    };
  }

  /** Generates briefs for every active user. Used by the 06:00 job. */
  async generateForAllUsers(now = new Date()): Promise<{ generated: number; failed: number }> {
    const userIds = await this.personalization.listActiveUserIds();
    let generated = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        await this.generateForUser(userId, { now });
        generated += 1;
      } catch (error) {
        failed += 1;
        // One user's failure must not stop the batch.
        this.logger.error({ err: error, userId }, 'daily brief generation failed for a user');
      }
    }
    return { generated, failed };
  }

  /** Exposed for the AI service: the narrative helper is optional, the brief works without it. */
  get aiService(): AiService {
    return this.ai;
  }

  get portfolioService(): PortfolioService {
    return this.portfolios;
  }
}

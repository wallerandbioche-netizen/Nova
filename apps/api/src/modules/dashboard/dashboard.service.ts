import type { Logger } from 'pino';
import type { DashboardPayload, PersonalizedNewsItem } from '@nova/types';
import { CACHE_TTL, DASHBOARD_NEWS_COUNT } from '@nova/config';
import { describeChange } from '@nova/finance';
import type { Cache } from '../../infrastructure/cache/index.js';
import { cacheKey } from '../../infrastructure/cache/index.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import type { MarketDataService } from '../../services/market-data/market-data.service.js';
import { NewsService } from '../../services/news/news.service.js';
import type { PersonalizationService } from '../../services/personalization/personalization.service.js';
import type { DailyBriefService } from '../daily-briefs/daily-brief.service.js';
import type { LearningService } from '../learning/learning.service.js';
import type { PortfolioService } from '../portfolios/portfolio.service.js';

/**
 * Dashboard aggregation.
 *
 * One request returns everything the morning screen needs, so the app makes a single call and
 * can render progressively. The payload always carries provenance (`asOf`, `isDemo`) so the UI
 * can state how fresh the numbers are.
 */
export class DashboardService {
  constructor(
    private readonly db: Database,
    private readonly cache: Cache,
    private readonly dailyBriefs: DailyBriefService,
    private readonly marketData: MarketDataService,
    private readonly news: NewsService,
    private readonly personalization: PersonalizationService,
    private readonly portfolios: PortfolioService,
    private readonly learning: LearningService,
    private readonly logger: Logger,
  ) {}

  async get(userId: string): Promise<DashboardPayload> {
    const key = cacheKey('dashboard', userId);
    const cached = await this.cache.get<DashboardPayload>(key);
    if (cached) return cached;

    const [user, brief, overview, exposure, unreadNotifications] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId }, select: { firstName: true } }),
      this.dailyBriefs.getToday(userId).catch((error) => {
        this.logger.warn({ err: error, userId }, 'could not load the daily brief');
        return null;
      }),
      this.marketData.getOverview(),
      this.personalization.getExposure(userId),
      this.db.notification.count({ where: { userId, readAt: null } }),
    ]);

    const topNews = await this.buildTopNews(userId);

    const portfolio = await this.buildPortfolioSummary(userId);
    const lesson = await this.learning.suggestLesson(userId, topNews);

    const payload: DashboardPayload = {
      greeting: `Bonjour${user?.firstName ? `, ${user.firstName}` : ''} 👋`,
      brief,
      portfolio,
      markets: overview.quotes,
      topNews,
      portfolioInsight: this.personalization.buildPortfolioInsight(exposure, topNews),
      lessonOfTheDay: lesson,
      unreadNotifications,
      meta: {
        asOf: overview.meta.asOf,
        isDemo: overview.meta.isDemo || topNews.some((item) => item.isDemo),
        provider: this.marketData.providerName,
      },
    };

    await this.cache.set(key, payload, CACHE_TTL.dashboard);
    return payload;
  }

  /** The five items that matter most for this user today. */
  async buildTopNews(
    userId: string,
    limit = DASHBOARD_NEWS_COUNT,
  ): Promise<PersonalizedNewsItem[]> {
    const exposure = await this.personalization.getExposure(userId);
    const signature = NewsService.exposureSignature(exposure);

    return this.news.cachedFeed(userId, signature, async () => {
      const since = new Date(Date.now() - 48 * 3_600_000);
      const recent = await this.news.listRecent({ since, limit: 60 });
      const themes = await this.news.withThemes(recent);

      const ranked = this.personalization.rank(
        recent.map((item) => ({
          ...this.news.toScored(item),
          themeKeys: themes.get(item.id) ?? [],
        })),
        exposure,
      );

      const byId = new Map(recent.map((item) => [item.id, item]));
      return ranked
        .slice(0, limit)
        .map((scored) => {
          const item = byId.get(scored.id);
          if (!item) return null;
          return this.news.personalize(item, {
            score: scored.relevance.score,
            reason: scored.relevance.reason,
            exposurePercent: scored.relevance.exposurePercent,
          });
        })
        .filter((item): item is PersonalizedNewsItem => item !== null);
    });
  }

  private async buildPortfolioSummary(userId: string): Promise<DashboardPayload['portfolio']> {
    const portfolio = await this.portfolios.getDefault(userId);
    if (!portfolio) return null;

    const positionCount = await this.db.position.count({ where: { portfolioId: portfolio.id } });
    if (positionCount === 0) {
      return {
        id: portfolio.id,
        name: portfolio.name,
        totalValue: 0,
        baseCurrency: portfolio.baseCurrency,
        dayChangePercent: null,
        totalUnrealizedGainPercent: 0,
        changeLabel: 'aucune position',
        isEmpty: true,
        meta: {
          asOf: new Date().toISOString(),
          isDemo: false,
          provider: this.marketData.providerName,
        },
      };
    }

    const analytics = await this.portfolios.getAnalytics(portfolio.id, userId);
    return {
      id: portfolio.id,
      name: portfolio.name,
      totalValue: analytics.totalValue,
      baseCurrency: analytics.baseCurrency,
      dayChangePercent: analytics.dayChangePercent,
      totalUnrealizedGainPercent: analytics.totalUnrealizedGainPercent,
      changeLabel: describeChange(analytics.dayChangePercent),
      isEmpty: false,
      meta: analytics.meta,
    };
  }
}

import type { Logger } from 'pino';
import {
  MARKET_THEMES,
  type MarketRadar,
  type MarketRadarTheme,
  type MarketThemeKey,
} from '@nova/types';
import { CACHE_TTL, THEME_LABELS } from '@nova/config';
import { round } from '@nova/finance';
import type { Cache } from '../../infrastructure/cache/index.js';
import { cacheKey } from '../../infrastructure/cache/index.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import type { PersonalizationService } from '../personalization/personalization.service.js';

/**
 * Market Radar.
 *
 * Shows which themes are actually driving today's news flow, how the related coverage reads,
 * and how much of the user's portfolio is exposed to each. Every number comes from stored
 * analyses — nothing decorative, no chart without meaning (rule #14).
 */
export class MarketRadarService {
  constructor(
    private readonly db: Database,
    private readonly cache: Cache,
    private readonly personalization: PersonalizationService,
    private readonly logger: Logger,
  ) {}

  async get(userId: string, now = new Date()): Promise<MarketRadar> {
    const key = cacheKey('radar', userId, now.toISOString().slice(0, 13));
    const cached = await this.cache.get<MarketRadar>(key);
    if (cached) return cached;

    const since = new Date(now.getTime() - 72 * 3_600_000);
    const analyses = await this.db.newsAnalysis.findMany({
      where: { news: { publishedAt: { gte: since } } },
      include: {
        news: { select: { id: true, title: true, publishedAt: true, isDemo: true, summary: true } },
      },
      orderBy: { importanceScore: 'desc' },
      take: 200,
    });

    const exposure = await this.personalization.getExposure(userId);

    const themes: MarketRadarTheme[] = MARKET_THEMES.map((theme: MarketThemeKey) => {
      const related = analyses.filter((analysis) => analysis.themeKeys.includes(theme));

      // Importance of a theme = how much high-importance coverage it attracts, normalised.
      const importance =
        related.length === 0
          ? 0
          : Math.min(
              100,
              Math.round(
                (related.reduce((total, analysis) => total + analysis.importanceScore, 0) /
                  Math.max(related.length, 1) /
                  100) *
                  (60 + Math.min(related.length, 8) * 5),
              ),
            );

      const recentCount = related.filter(
        (analysis) => analysis.news.publishedAt.getTime() > now.getTime() - 24 * 3_600_000,
      ).length;
      const olderCount = related.length - recentCount;

      // Direction describes the *attention* the theme is getting, not a price forecast.
      const direction: MarketRadarTheme['direction'] =
        recentCount > olderCount ? 'rising' : recentCount < olderCount ? 'falling' : 'stable';

      const directionLabel =
        direction === 'rising'
          ? 'davantage commenté ces dernières 24 heures'
          : direction === 'falling'
            ? 'moins commenté que la veille'
            : 'niveau d’attention stable';

      return {
        key: theme as MarketThemeKey,
        label: THEME_LABELS[theme as MarketThemeKey],
        importance,
        direction,
        directionLabel,
        summary:
          related.length === 0
            ? 'Aucune actualité récente n’a été rattachée à ce thème.'
            : `${related.length} actualité${related.length > 1 ? 's' : ''} sur 72 heures, dont ${recentCount} depuis hier.`,
        relatedNewsIds: related.slice(0, 5).map((analysis) => analysis.news.id),
        userExposurePercent: exposure
          ? round(exposure.byTheme[theme as MarketThemeKey] ?? 0, 1)
          : null,
        asOf: now.toISOString(),
      } satisfies MarketRadarTheme;
    }).sort((a: MarketRadarTheme, b: MarketRadarTheme) => {
      // Themes the user is exposed to rise, at equal importance.
      const scoreA = a.importance + (a.userExposurePercent ?? 0) * 0.5;
      const scoreB = b.importance + (b.userExposurePercent ?? 0) * 0.5;
      return scoreB - scoreA;
    });

    const radar: MarketRadar = {
      themes,
      meta: {
        asOf: now.toISOString(),
        isDemo: analyses.some((analysis) => analysis.news.isDemo),
        provider: 'NOVA scoring engine',
      },
    };

    await this.cache.set(key, radar, CACHE_TTL.marketRadar);
    this.logger.debug({ userId, themeCount: themes.length }, 'market radar built');
    return radar;
  }
}

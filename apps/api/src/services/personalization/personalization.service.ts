import type { Logger } from 'pino';
import type {
  MarketThemeKey,
  NewsExposureBreakdown,
  PersonalizedNewsItem,
  PortfolioExposure,
  Statement,
} from '@nova/types';
import { REGION_LABELS, SECTOR_LABELS, THEME_LABELS } from '@nova/config';
import { round } from '@nova/finance';
import type { Database } from '../../infrastructure/database/prisma.js';
import type { PortfolioService } from '../../modules/portfolios/portfolio.service.js';
import { uncapitalize } from '../../lib/text.js';
import type { ScoringService } from '../news/scoring.service.js';

export interface ScoredNews {
  id: string;
  title: string;
  category: string;
  importanceScore: number;
  confidenceScore: number;
  themeKeys: string[];
  affectedSymbols: string[];
  affectedSectorKeys: string[];
  affectedRegions?: string[];
  /** symbol → display name, so a reason can say "Vous détenez Apple", not "AAPL". */
  assetNames?: Record<string, string>;
}

export interface RelevanceBreakdown {
  score: number;
  reason: string | null;
  exposure: NewsExposureBreakdown[];
  exposurePercent: number | null;
}

/**
 * Personalisation engine.
 *
 * Crosses the deterministic news analysis with the user's actual exposure to answer the
 * product's central question: "pourquoi cela me concerne ?". It is pure bookkeeping over
 * numbers already computed elsewhere — no model, no guessing.
 */
export class PersonalizationService {
  constructor(
    private readonly db: Database,
    private readonly portfolios: PortfolioService,
    private readonly scoring: ScoringService,
    private readonly logger: Logger,
  ) {}

  async getExposure(userId: string): Promise<PortfolioExposure | null> {
    return this.portfolios.getDefaultExposure(userId);
  }

  /** Computes how much a single news item touches a given portfolio. */
  computeRelevance(news: ScoredNews, exposure: PortfolioExposure | null): RelevanceBreakdown {
    if (!exposure) {
      return { score: 0, reason: null, exposure: [], exposurePercent: null };
    }

    const heldSymbols = new Set(exposure.symbols);
    const directSymbols = news.affectedSymbols.filter((symbol) => heldSymbols.has(symbol));

    // Direct exposure: the share of the portfolio held in the named assets.
    const directPercent =
      directSymbols.length > 0 ? this.directPercent(exposure, directSymbols) : 0;

    const sectorPercent = news.affectedSectorKeys.reduce(
      (total, sectorKey) => total + (exposure.bySector[sectorKey] ?? 0),
      0,
    );

    const regionPercent = (news.affectedRegions ?? []).reduce(
      (total, region) => total + (exposure.byRegion[region] ?? 0),
      0,
    );

    const themePercent = news.themeKeys.reduce(
      (total, theme) => total + (exposure.byTheme[theme as MarketThemeKey] ?? 0),
      0,
    );

    const score = this.scoring.scoreRelevance({
      directAssetPercent: directPercent,
      sectorPercent,
      regionPercent,
      themePercent,
    });

    const breakdown: NewsExposureBreakdown[] = [];
    if (directPercent > 0) {
      breakdown.push({
        label: directSymbols.join(', '),
        percent: round(directPercent, 2),
        kind: 'asset',
      });
    }
    for (const sectorKey of news.affectedSectorKeys) {
      const percent = exposure.bySector[sectorKey] ?? 0;
      if (percent > 0) {
        breakdown.push({
          label: SECTOR_LABELS[sectorKey] ?? sectorKey,
          percent: round(percent, 2),
          kind: 'sector',
        });
      }
    }
    for (const theme of news.themeKeys) {
      const percent = exposure.byTheme[theme as MarketThemeKey] ?? 0;
      if (percent >= 5) {
        breakdown.push({
          label: THEME_LABELS[theme as MarketThemeKey] ?? theme,
          percent: round(percent, 2),
          kind: 'theme',
        });
      }
    }

    return {
      score,
      reason: this.buildReason(
        directSymbols.map((symbol) => news.assetNames?.[symbol] ?? symbol),
        breakdown,
      ),
      exposure: breakdown.slice(0, 5),
      exposurePercent:
        breakdown.length > 0 ? round(Math.max(...breakdown.map((b) => b.percent)), 2) : null,
    };
  }

  /** Exact share of the portfolio held in the named symbols, from computed position weights. */
  private directPercent(exposure: PortfolioExposure, symbols: string[]): number {
    return round(
      symbols.reduce((total, symbol) => total + (exposure.weightsBySymbol[symbol] ?? 0), 0),
      2,
    );
  }

  private buildReason(directSymbols: string[], breakdown: NewsExposureBreakdown[]): string | null {
    if (directSymbols.length > 0) {
      return `Vous détenez ${directSymbols.join(', ')}`;
    }
    const sector = breakdown.find((entry) => entry.kind === 'sector');
    if (sector) {
      return `${sector.percent.toFixed(0)} % de votre portefeuille en ${sector.label.toLowerCase()}`;
    }
    const theme = breakdown.find((entry) => entry.kind === 'theme');
    if (theme) {
      return `Exposition indirecte au thème ${theme.label.toLowerCase()}`;
    }
    return null;
  }

  /** Ranks a list of scored news for one user. */
  rank<T extends ScoredNews>(
    items: T[],
    exposure: PortfolioExposure | null,
  ): (T & { relevance: RelevanceBreakdown; rankingScore: number })[] {
    return items
      .map((item) => {
        const relevance = this.computeRelevance(item, exposure);
        return {
          ...item,
          relevance,
          rankingScore: this.scoring.rankingScore(item.importanceScore, relevance.score),
        };
      })
      .sort((a, b) => b.rankingScore - a.rankingScore);
  }

  /** One-sentence portfolio insight for the dashboard, derived from exposure only. */
  buildPortfolioInsight(
    exposure: PortfolioExposure | null,
    topNews: PersonalizedNewsItem[],
  ): Statement | null {
    if (!exposure) return null;

    const relevant = topNews.find((item) => item.portfolioRelevanceScore >= 40);
    if (relevant && relevant.relevanceReason) {
      return {
        kind: 'analysis',
        text: `Parmi les informations du jour, « ${relevant.title} » est celle qui touche le plus votre portefeuille : ${uncapitalize(
          relevant.relevanceReason,
        )}. Cette lecture décrit une exposition, pas un effet certain sur votre portefeuille.`,
      };
    }

    const sectorEntries = Object.entries(exposure.bySector).sort((a, b) => b[1] - a[1]);
    const top = sectorEntries[0];
    if (!top) return null;

    const [sectorKey, percent] = top;
    const regionEntries = Object.entries(exposure.byRegion).sort((a, b) => b[1] - a[1]);
    const topRegion = regionEntries[0];

    return {
      kind: 'analysis',
      text: `Votre portefeuille est principalement exposé au secteur « ${
        SECTOR_LABELS[sectorKey] ?? sectorKey
      } » (environ ${percent.toFixed(0)} %)${
        topRegion
          ? ` et à la zone « ${REGION_LABELS[topRegion[0] as keyof typeof REGION_LABELS] ?? topRegion[0]} » (environ ${topRegion[1].toFixed(0)} %)`
          : ''
      }. Aucune actualité du jour ne concerne directement vos positions.`,
    };
  }

  /** Users to generate a brief for: those who finished onboarding and are not deleted. */
  async listActiveUserIds(): Promise<string[]> {
    const users = await this.db.user.findMany({
      where: { deletedAt: null, onboardingCompletedAt: { not: null } },
      select: { id: true },
    });
    this.logger.debug({ count: users.length }, 'active users for personalisation');
    return users.map((user) => user.id);
  }
}

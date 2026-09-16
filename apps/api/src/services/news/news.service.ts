import type { Logger } from 'pino';
import type { NewsCategory, NewsItem, PersonalizedNewsItem, PortfolioExposure } from '@nova/types';
import { CACHE_TTL, SECTOR_LABELS } from '@nova/config';
import type { Cache } from '../../infrastructure/cache/index.js';
import { cacheKey } from '../../infrastructure/cache/index.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import { notFound } from '../../http/errors.js';
import { buildPage, decodeCursor, type PageResult } from '../../http/pagination.js';
import type { NewsProvider, RawNewsItem } from './providers/index.js';
import type { ScoringService } from './scoring.service.js';

export interface IngestionReport {
  fetched: number;
  inserted: number;
  duplicates: number;
  failed: number;
}

/**
 * News pipeline (rule #37):
 *
 *   fetch → normalize → deduplicate → classify → extractEntities → mapAssets → score → store
 *
 * Every step is deterministic and happens before any model is involved. The provider's own
 * category is only a hint; scoring, theme extraction and asset mapping are NOVA's.
 */
export class NewsService {
  constructor(
    private readonly db: Database,
    private readonly cache: Cache,
    private readonly provider: NewsProvider,
    private readonly scoring: ScoringService,
    private readonly logger: Logger,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  get isDemoProvider(): boolean {
    return this.provider.isDemo;
  }

  /** Trims, collapses whitespace and bounds the fields we store. */
  private normalize(raw: RawNewsItem): RawNewsItem {
    const clean = (value: string, max: number) => value.replace(/\s+/g, ' ').trim().slice(0, max);
    return {
      ...raw,
      title: clean(raw.title, 300),
      summary: clean(raw.summary || raw.title, 1200),
      body: raw.body ? clean(raw.body, 20_000) : null,
      source: clean(raw.source, 160),
      symbols: [...new Set(raw.symbols.map((symbol) => symbol.trim().toUpperCase()))].slice(0, 20),
    };
  }

  async ingest(
    options: { since?: Date; limit?: number; now?: Date } = {},
  ): Promise<IngestionReport> {
    const now = options.now ?? new Date();
    const report: IngestionReport = { fetched: 0, inserted: 0, duplicates: 0, failed: 0 };

    const rawItems = await this.provider.fetchLatest({
      since: options.since,
      limit: options.limit ?? 50,
    });
    report.fetched = rawItems.length;

    for (const rawItem of rawItems) {
      try {
        const item = this.normalize(rawItem);
        const contentHash = this.scoring.contentHash(item.title, item.source);

        const existing = await this.db.news.findFirst({
          where: {
            OR: [{ contentHash }, ...(item.externalId ? [{ externalId: item.externalId }] : [])],
          },
          select: { id: true },
        });
        if (existing) {
          report.duplicates += 1;
          continue;
        }

        const category: NewsCategory = this.scoring.classify(
          item.title,
          item.summary,
          item.category,
        );

        // Entity mapping: only symbols that exist in our catalogue are linked, so an
        // "affected asset" is always a real, resolvable instrument.
        const assets = await this.db.asset.findMany({
          where: { symbol: { in: item.symbols } },
          include: { sector: true },
        });

        const themeKeys = this.scoring.extractThemes(item.title, item.summary, item.body);

        // Sectors come from the mapped assets, plus the sectors sensitive to the detected themes.
        const sectorSensitivity = this.scoring.sectorsForThemes(themeKeys);
        const directSectorIds = new Set(
          assets.map((asset) => asset.sectorId).filter((id): id is string => Boolean(id)),
        );
        const themeSectors = await this.db.sector.findMany({
          where: { key: { in: Object.keys(sectorSensitivity) } },
        });

        const scored = this.scoring.score({
          title: item.title,
          summary: item.summary,
          body: item.body,
          source: item.source,
          category,
          publishedAt: item.publishedAt,
          affectedAssetCount: assets.length,
          affectedSectorCount: directSectorIds.size + themeSectors.length,
          now,
        });

        await this.db.news.create({
          data: {
            title: item.title,
            summary: item.summary,
            body: item.body,
            source: item.source,
            sourceUrl: item.sourceUrl,
            externalId: item.externalId,
            contentHash,
            publishedAt: item.publishedAt,
            category,
            language: item.language,
            isDemo: this.provider.isDemo,
            assets: {
              create: assets.map((asset) => ({ assetId: asset.id, relevance: 90 })),
            },
            sectors: {
              create: [
                ...[...directSectorIds].map((sectorId) => ({ sectorId, relevance: 80 })),
                ...themeSectors
                  .filter((sector) => !directSectorIds.has(sector.id))
                  .map((sector) => ({
                    sectorId: sector.id,
                    relevance: Math.round((sectorSensitivity[sector.key] ?? 0.5) * 60),
                  })),
              ],
            },
            analysis: {
              create: {
                importanceScore: scored.importanceScore,
                confidenceScore: scored.confidenceScore,
                horizon: scored.horizon,
                themeKeys: scored.themeKeys,
                analysis: { rationale: scored.rationale } as never,
                scoringVersion: scored.scoringVersion,
              },
            },
          },
        });
        report.inserted += 1;
      } catch (error) {
        report.failed += 1;
        this.logger.error({ err: error, title: rawItem.title }, 'failed to ingest a news item');
      }
    }

    if (report.inserted > 0) {
      await this.cache.delByPrefix(cacheKey('news'));
    }
    this.logger.info(report, 'news ingestion completed');
    return report;
  }

  private toDto(row: NewsRow): NewsItem {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      source: row.source,
      sourceUrl: row.sourceUrl,
      publishedAt: row.publishedAt.toISOString(),
      category: row.category as NewsCategory,
      language: (row.language === 'en' ? 'en' : 'fr') as NewsItem['language'],
      affectedAssets: row.assets.map((link) => ({
        assetId: link.assetId,
        symbol: link.asset.symbol,
        name: link.asset.name,
        relevance: link.relevance,
      })),
      affectedSectors: row.sectors.map((link) => ({
        sectorKey: link.sector.key,
        label: link.sector.label || SECTOR_LABELS[link.sector.key] || link.sector.key,
        relevance: link.relevance,
      })),
      importanceScore: row.analysis?.importanceScore ?? 0,
      confidenceScore: row.analysis?.confidenceScore ?? 0,
      horizon: (row.analysis?.horizon ?? 'short_term') as NewsItem['horizon'],
      isDemo: row.isDemo,
    };
  }

  private readonly include = {
    assets: { include: { asset: true } },
    sectors: { include: { sector: true } },
    analysis: true,
  } as const;

  async getById(id: string): Promise<NewsItem> {
    const row = await this.db.news.findUnique({ where: { id }, include: this.include });
    if (!row) throw notFound('Actualité introuvable');
    return this.toDto(row as NewsRow);
  }

  async list(options: {
    limit: number;
    cursor?: string;
    category?: NewsCategory;
  }): Promise<PageResult<NewsItem>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.db.news.findMany({
      where: {
        ...(options.category ? { category: options.category } : {}),
        ...(cursor ? { publishedAt: { lt: new Date(cursor.timestamp) } } : {}),
      },
      include: this.include,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const page = buildPage(rows, options.limit, (row) => ({
      timestamp: row.publishedAt.toISOString(),
      id: row.id,
    }));
    return { ...page, items: page.items.map((row) => this.toDto(row as NewsRow)) };
  }

  /** Recent items with their analysis, used by the brief and the personalised feed. */
  async listRecent(options: { since: Date; limit: number }): Promise<NewsItem[]> {
    const rows = await this.db.news.findMany({
      where: { publishedAt: { gte: options.since } },
      include: this.include,
      orderBy: { publishedAt: 'desc' },
      take: options.limit,
    });
    return rows.map((row) => this.toDto(row as NewsRow));
  }

  toScored(item: NewsItem) {
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      importanceScore: item.importanceScore,
      confidenceScore: item.confidenceScore,
      themeKeys: [],
      affectedSymbols: item.affectedAssets.map((asset) => asset.symbol),
      affectedSectorKeys: item.affectedSectors.map((sector) => sector.sectorKey),
    };
  }

  /** Attaches the scoring themes stored alongside each item. */
  async withThemes(items: NewsItem[]): Promise<Map<string, string[]>> {
    if (items.length === 0) return new Map();
    const analyses = await this.db.newsAnalysis.findMany({
      where: { newsId: { in: items.map((item) => item.id) } },
      select: { newsId: true, themeKeys: true },
    });
    return new Map(analyses.map((analysis) => [analysis.newsId, analysis.themeKeys]));
  }

  personalize(
    item: NewsItem,
    relevance: {
      score: number;
      reason: string | null;
      exposurePercent: number | null;
    },
  ): PersonalizedNewsItem {
    return {
      ...item,
      portfolioRelevanceScore: relevance.score,
      relevanceReason: relevance.reason,
      exposurePercent: relevance.exposurePercent,
    };
  }

  /** Cached personalised feed for a user. */
  async cachedFeed(
    userId: string,
    exposureSignature: string,
    build: () => Promise<PersonalizedNewsItem[]>,
  ): Promise<PersonalizedNewsItem[]> {
    const key = cacheKey('news', 'feed', userId, exposureSignature);
    const cached = await this.cache.get<PersonalizedNewsItem[]>(key);
    if (cached) return cached;
    const items = await build();
    await this.cache.set(key, items, CACHE_TTL.newsFeed);
    return items;
  }

  static exposureSignature(exposure: PortfolioExposure | null): string {
    if (!exposure) return 'none';
    return `${exposure.portfolioId}:${Math.round(exposure.totalValue)}:${exposure.symbols.length}`;
  }

  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }
}

type NewsRow = {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string | null;
  publishedAt: Date;
  category: string;
  language: string;
  isDemo: boolean;
  assets: { assetId: string; relevance: number; asset: { symbol: string; name: string } }[];
  sectors: { relevance: number; sector: { key: string; label: string } }[];
  analysis: { importanceScore: number; confidenceScore: number; horizon: string } | null;
};

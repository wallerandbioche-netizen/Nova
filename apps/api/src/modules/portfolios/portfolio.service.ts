import type { Logger } from 'pino';
import type {
  Asset,
  CurrencyCode,
  PortfolioAnalytics,
  PortfolioExposure,
  ValuedPosition,
} from '@nova/types';
import { CACHE_TTL, DEFAULT_CURRENCY } from '@nova/config';
import {
  computePortfolio,
  computeThemeExposure,
  round,
  toPercentMap,
  type PricedPosition,
} from '@nova/finance';
import type { CreatePositionInput, CreatePortfolioInput } from '@nova/validation';
import type { Cache } from '../../infrastructure/cache/index.js';
import { cacheKey } from '../../infrastructure/cache/index.js';
import { toNumber, type Database } from '../../infrastructure/database/prisma.js';
import { badRequest, conflict, notFound } from '../../http/errors.js';
import { assertOwnership } from '../../http/plugins/authenticate.js';
import type { MarketDataService } from '../../services/market-data/market-data.service.js';
import type { AssetService } from '../assets/asset.service.js';

/**
 * Portfolio domain.
 *
 * Every figure the user sees comes from `@nova/finance`, called here — never from the UI
 * (rule #13). Ownership is enforced on every read and write, from the authenticated user id.
 */
export class PortfolioService {
  constructor(
    private readonly db: Database,
    private readonly cache: Cache,
    private readonly marketData: MarketDataService,
    private readonly assets: AssetService,
    private readonly logger: Logger,
  ) {}

  async list(userId: string) {
    const portfolios = await this.db.portfolio.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { positions: true } } },
    });
    return portfolios.map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      baseCurrency: portfolio.baseCurrency as CurrencyCode,
      isDefault: portfolio.isDefault,
      positionCount: portfolio._count.positions,
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString(),
    }));
  }

  async getDefault(userId: string) {
    return this.db.portfolio.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, input: CreatePortfolioInput, maxPortfolios: number) {
    const count = await this.db.portfolio.count({ where: { userId } });
    if (count >= maxPortfolios) {
      throw conflict(
        `Votre formule permet ${maxPortfolios} portefeuille${maxPortfolios > 1 ? 's' : ''}.`,
      );
    }
    const portfolio = await this.db.portfolio.create({
      data: {
        userId,
        name: input.name,
        baseCurrency: input.baseCurrency ?? DEFAULT_CURRENCY,
        isDefault: count === 0,
      },
    });
    await this.invalidate(userId, portfolio.id);
    return portfolio;
  }

  /** Loads a portfolio and verifies it belongs to the caller. */
  async getOwned(portfolioId: string, userId: string) {
    const portfolio = await this.db.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) throw notFound('Portefeuille introuvable');
    assertOwnership(portfolio.userId, userId);
    return portfolio;
  }

  async update(
    portfolioId: string,
    userId: string,
    input: { name?: string; baseCurrency?: CurrencyCode },
  ) {
    await this.getOwned(portfolioId, userId);
    const portfolio = await this.db.portfolio.update({
      where: { id: portfolioId },
      data: { ...(input.name ? { name: input.name } : {}), ...(input.baseCurrency ? { baseCurrency: input.baseCurrency } : {}) },
    });
    await this.invalidate(userId, portfolioId);
    return portfolio;
  }

  async remove(portfolioId: string, userId: string) {
    await this.getOwned(portfolioId, userId);
    await this.db.portfolio.delete({ where: { id: portfolioId } });
    await this.invalidate(userId, portfolioId);
  }

  async addPosition(portfolioId: string, userId: string, input: CreatePositionInput) {
    const portfolio = await this.getOwned(portfolioId, userId);

    const asset: Asset = input.assetId
      ? await this.assets.getById(input.assetId)
      : await this.assets.resolveOrCreateBySymbol(input.symbol as string);

    const existing = await this.db.position.findUnique({
      where: { portfolioId_assetId: { portfolioId, assetId: asset.id } },
    });
    if (existing) {
      throw conflict(
        `Une position existe déjà sur ${asset.name}. Modifiez-la plutôt que d’en créer une seconde.`,
      );
    }

    const position = await this.db.position.create({
      data: {
        portfolioId,
        assetId: asset.id,
        quantity: input.quantity,
        averagePrice: input.averagePrice,
        currency: input.currency ?? asset.currency ?? portfolio.baseCurrency,
      },
    });

    await this.invalidate(userId, portfolioId);
    return position;
  }

  async getOwnedPosition(positionId: string, userId: string) {
    const position = await this.db.position.findUnique({
      where: { id: positionId },
      include: { portfolio: true },
    });
    if (!position) throw notFound('Position introuvable');
    assertOwnership(position.portfolio.userId, userId);
    return position;
  }

  async updatePosition(
    positionId: string,
    userId: string,
    input: { quantity?: number; averagePrice?: number; currency?: CurrencyCode },
  ) {
    const existing = await this.getOwnedPosition(positionId, userId);
    const position = await this.db.position.update({
      where: { id: positionId },
      data: {
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.averagePrice !== undefined ? { averagePrice: input.averagePrice } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
      },
    });
    await this.invalidate(userId, existing.portfolioId);
    return position;
  }

  async removePosition(positionId: string, userId: string) {
    const existing = await this.getOwnedPosition(positionId, userId);
    await this.db.position.delete({ where: { id: positionId } });
    await this.invalidate(userId, existing.portfolioId);
  }

  /** Loads positions with their latest prices, ready for the finance engine. */
  private async loadPricedPositions(portfolioId: string): Promise<{
    positions: PricedPosition[];
    isDemo: boolean;
    asOf: string | null;
  }> {
    const positions = await this.db.position.findMany({
      where: { portfolioId },
      include: { asset: { include: { sector: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const quotes = await this.marketData.getQuotes(positions.map((p) => p.asset.symbol));
    let isDemo = false;
    let latest: string | null = null;

    const priced = positions.map((position) => {
      const quote = quotes.get(position.asset.symbol);
      if (quote?.isDemo) isDemo = true;
      const asOf = quote?.asOf.toISOString() ?? null;
      if (asOf && (!latest || asOf > latest)) latest = asOf;

      return {
        id: position.id,
        assetId: position.assetId,
        symbol: position.asset.symbol,
        name: position.asset.name,
        assetType: position.asset.assetType,
        region: position.asset.region,
        sectorKey: position.asset.sector?.key ?? null,
        currency: position.currency,
        quantity: toNumber(position.quantity),
        averagePrice: toNumber(position.averagePrice),
        lastPrice: quote?.price ?? null,
        previousClose: quote?.previousClose ?? null,
        priceAsOf: asOf,
        isDemoPrice: quote?.isDemo ?? false,
      } satisfies PricedPosition;
    });

    return { positions: priced, isDemo, asOf: latest };
  }

  async getAnalytics(portfolioId: string, userId: string): Promise<PortfolioAnalytics> {
    const portfolio = await this.getOwned(portfolioId, userId);
    const key = cacheKey('portfolio', portfolioId, 'analytics');
    const cached = await this.cache.get<PortfolioAnalytics>(key);
    if (cached) return cached;

    const { positions, isDemo, asOf } = await this.loadPricedPositions(portfolioId);
    const currencies = [...new Set(positions.map((position) => position.currency))];
    const rates = await this.marketData.getFxRates(currencies);

    const computed = computePortfolio(positions, portfolio.baseCurrency, rates);

    const analytics: PortfolioAnalytics = {
      portfolioId,
      baseCurrency: portfolio.baseCurrency as CurrencyCode,
      totalValue: computed.totalValue,
      totalCostBasis: computed.totalCostBasis,
      totalUnrealizedGain: computed.totalUnrealizedGain,
      totalUnrealizedGainPercent: computed.totalUnrealizedGainPercent,
      dayChange: computed.dayChange,
      dayChangePercent: computed.dayChangePercent,
      byAssetType: computed.breakdown.byAssetType,
      byRegion: computed.breakdown.byRegion,
      bySector: computed.breakdown.bySector,
      byCurrency: computed.breakdown.byCurrency,
      concentration: computed.breakdown.concentration,
      unvaluedPercent: computed.unvaluedPercent,
      meta: this.marketData.buildMeta(asOf ? [asOf] : [], isDemo),
    };

    await this.cache.set(key, analytics, CACHE_TTL.portfolioAnalytics);
    return analytics;
  }

  async getValuedPositions(portfolioId: string, userId: string): Promise<ValuedPosition[]> {
    const portfolio = await this.getOwned(portfolioId, userId);
    const rows = await this.db.position.findMany({
      where: { portfolioId },
      include: { asset: { include: { sector: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const { positions } = await this.loadPricedPositions(portfolioId);
    const rates = await this.marketData.getFxRates(
      [...new Set(positions.map((position) => position.currency))],
    );
    const computed = computePortfolio(positions, portfolio.baseCurrency, rates);

    return rows.map((row) => {
      const valuation = computed.valuations.find((candidate) => candidate.positionId === row.id);
      return {
        id: row.id,
        portfolioId,
        asset: this.assets.toDto(row.asset),
        quantity: toNumber(row.quantity),
        averagePrice: toNumber(row.averagePrice),
        currency: row.currency as CurrencyCode,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastPrice: valuation?.lastPrice ?? null,
        marketValue: valuation?.marketValue ?? null,
        costBasis: valuation?.costBasis ?? 0,
        unrealizedGain: valuation?.unrealizedGain ?? null,
        unrealizedGainPercent: valuation?.unrealizedGainPercent ?? null,
        weightPercent: valuation?.weightPercent ?? null,
        priceAsOf: valuation?.priceAsOf ?? null,
        isDemoPrice: valuation?.isDemoPrice ?? false,
      } satisfies ValuedPosition;
    });
  }

  /** Exposure in the vocabulary of the scoring engine (sectors, regions, themes, symbols). */
  async getExposure(portfolioId: string, userId: string): Promise<PortfolioExposure> {
    const portfolio = await this.getOwned(portfolioId, userId);
    const key = cacheKey('portfolio', portfolioId, 'exposure');
    const cached = await this.cache.get<PortfolioExposure>(key);
    if (cached) return cached;

    const analytics = await this.getAnalytics(portfolioId, userId);
    const { positions, asOf } = await this.loadPricedPositions(portfolioId);
    void asOf;
    const rates = await this.marketData.getFxRates(
      [...new Set(positions.map((position) => position.currency))],
    );
    const computed = computePortfolio(positions, portfolio.baseCurrency, rates);

    // Real per-symbol weights, so "vous détenez X" can be quantified exactly rather than
    // approximated from the number of lines.
    const weightsBySymbol: Record<string, number> = {};
    for (const valuation of computed.valuations) {
      if (valuation.weightPercent === null) continue;
      weightsBySymbol[valuation.symbol] =
        round((weightsBySymbol[valuation.symbol] ?? 0) + valuation.weightPercent, 2);
    }

    const bySector = toPercentMap(analytics.bySector);

    const exposure: PortfolioExposure = {
      portfolioId,
      bySector,
      byRegion: toPercentMap(analytics.byRegion),
      byAssetType: toPercentMap(analytics.byAssetType),
      byTheme: computeThemeExposure(bySector),
      weightsBySymbol,
      assetIds: positions.map((position) => position.assetId),
      symbols: positions.map((position) => position.symbol),
      totalValue: analytics.totalValue,
      baseCurrency: analytics.baseCurrency,
      meta: analytics.meta,
    };

    await this.cache.set(key, exposure, CACHE_TTL.portfolioAnalytics);
    return exposure;
  }

  /** Exposure of a user's default portfolio, or null when they have no positions yet. */
  async getDefaultExposure(userId: string): Promise<PortfolioExposure | null> {
    const portfolio = await this.getDefault(userId);
    if (!portfolio) return null;
    const positionCount = await this.db.position.count({ where: { portfolioId: portfolio.id } });
    if (positionCount === 0) return null;
    try {
      return await this.getExposure(portfolio.id, userId);
    } catch (error) {
      this.logger.warn({ err: error, userId }, 'could not compute portfolio exposure');
      return null;
    }
  }

  /** Percentage of the portfolio held in the given symbols. */
  static directExposurePercent(
    valuedPositions: { symbol: string; weightPercent: number | null }[],
    symbols: string[],
  ): number {
    const wanted = new Set(symbols);
    return round(
      valuedPositions
        .filter((position) => wanted.has(position.symbol))
        .reduce((total, position) => total + (position.weightPercent ?? 0), 0),
      2,
    );
  }

  private async invalidate(userId: string, portfolioId: string): Promise<void> {
    await Promise.all([
      this.cache.delByPrefix(cacheKey('portfolio', portfolioId)),
      this.cache.delByPrefix(cacheKey('dashboard', userId)),
      this.cache.delByPrefix(cacheKey('news', 'feed', userId)),
    ]);
  }

  async ensureDefaultPortfolio(userId: string, baseCurrency = DEFAULT_CURRENCY) {
    const existing = await this.getDefault(userId);
    if (existing) return existing;
    return this.db.portfolio.create({
      data: { userId, name: 'Mon portefeuille', baseCurrency, isDefault: true },
    });
  }

  async assertPositionLimit(portfolioId: string, max = 200): Promise<void> {
    const count = await this.db.position.count({ where: { portfolioId } });
    if (count >= max) {
      throw badRequest(`Un portefeuille est limité à ${max} positions.`);
    }
  }
}

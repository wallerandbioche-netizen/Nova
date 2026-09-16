import type { Logger } from 'pino';
import type { DataMeta, MarketOverview, MarketQuote, PriceRange, PriceSeries } from '@nova/types';
import { CACHE_TTL, MARKET_INDICES } from '@nova/config';
import { describeChange, percentChange, round } from '@nova/finance';
import type { Cache } from '../../infrastructure/cache/index.js';
import { cacheKey } from '../../infrastructure/cache/index.js';
import { toNullableNumber, toNumber, type Database } from '../../infrastructure/database/prisma.js';
import { notFound } from '../../http/errors.js';
import type { MarketDataProvider } from './providers/index.js';

export interface QuoteSnapshot {
  symbol: string;
  price: number;
  previousClose: number | null;
  currency: string;
  asOf: Date;
  isDemo: boolean;
}

/**
 * Market data orchestration.
 *
 * Reads go through the database (the durable record) and fall back to the provider only when
 * data is missing or stale. When neither has a price, the price is reported as unknown — NOVA
 * never substitutes a plausible number (absolute rule #58).
 */
export class MarketDataService {
  constructor(
    private readonly db: Database,
    private readonly cache: Cache,
    private readonly provider: MarketDataProvider,
    private readonly logger: Logger,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  get isDemoProvider(): boolean {
    return this.provider.isDemo;
  }

  /** Latest stored close per symbol, with the previous session's close when available. */
  async getQuotes(symbols: string[]): Promise<Map<string, QuoteSnapshot>> {
    const result = new Map<string, QuoteSnapshot>();
    if (symbols.length === 0) return result;

    const assets = await this.db.asset.findMany({
      where: { symbol: { in: symbols } },
      select: { id: true, symbol: true, currency: true },
    });

    for (const asset of assets) {
      const prices = await this.db.marketPrice.findMany({
        where: { assetId: asset.id },
        orderBy: { timestamp: 'desc' },
        take: 2,
      });
      const latest = prices[0];
      if (!latest) continue;
      result.set(asset.symbol, {
        symbol: asset.symbol,
        price: toNumber(latest.close),
        previousClose: prices[1] ? toNumber(prices[1].close) : null,
        currency: asset.currency,
        asOf: latest.timestamp,
        isDemo: latest.isDemo,
      });
    }
    return result;
  }

  /** FX rates against EUR, read from storage and completed by the provider when missing. */
  async getFxRates(currencies: string[]): Promise<Record<string, number>> {
    const wanted = [...new Set(['EUR', ...currencies])];
    const rates: Record<string, number> = { EUR: 1 };

    for (const currency of wanted) {
      if (currency === 'EUR') continue;
      const stored = await this.db.fxRate.findFirst({
        where: { currency },
        orderBy: { timestamp: 'desc' },
      });
      if (stored) rates[currency] = toNumber(stored.rate);
    }

    const missing = wanted.filter((currency) => rates[currency] === undefined);
    if (missing.length > 0) {
      try {
        const fetched = await this.provider.getFxRates(missing);
        Object.assign(rates, fetched);
      } catch (error) {
        // A missing rate makes the affected positions "unvalued", which the UI states plainly.
        this.logger.warn({ err: error, missing }, 'could not resolve FX rates');
      }
    }
    return rates;
  }

  async getOverview(): Promise<MarketOverview> {
    const key = cacheKey('markets', 'overview');
    const cached = await this.cache.get<MarketOverview>(key);
    if (cached) return cached;

    const indices = await this.db.marketIndex.findMany({
      include: { quotes: { orderBy: { timestamp: 'desc' }, take: 1 } },
    });

    const order: string[] = MARKET_INDICES.map((index) => index.key);
    const quotes: MarketQuote[] = indices
      .map((index) => {
        const quote = index.quotes[0];
        if (!quote) return null;
        const value = toNumber(quote.value);
        const previous = toNullableNumber(quote.previousClose);
        const changePercent = previous === null ? null : percentChange(value, previous);
        return {
          key: index.key,
          label: index.label,
          value: round(value, 2),
          currency: index.currency,
          changePercent: changePercent === null ? null : round(changePercent, 2),
          changeAbsolute: previous === null ? null : round(value - previous, 2),
          changeLabel: describeChange(changePercent),
          asOf: quote.timestamp.toISOString(),
          isDemo: quote.isDemo,
        } satisfies MarketQuote;
      })
      .filter((quote): quote is MarketQuote => quote !== null)
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

    const overview: MarketOverview = {
      quotes,
      meta: this.buildMeta(
        quotes.map((quote) => quote.asOf),
        quotes.some((quote) => quote.isDemo),
      ),
    };

    await this.cache.set(key, overview, CACHE_TTL.marketOverview);
    return overview;
  }

  async getPriceSeries(assetId: string, range: PriceRange): Promise<PriceSeries> {
    const key = cacheKey('prices', assetId, range);
    const cached = await this.cache.get<PriceSeries>(key);
    if (cached) return cached;

    const asset = await this.db.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw notFound('Actif introuvable');

    const days = { '1W': 7, '1M': 31, '3M': 92, '1Y': 366 }[range];
    const since = new Date(Date.now() - days * 86_400_000);

    const prices = await this.db.marketPrice.findMany({
      where: { assetId, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    });

    const series: PriceSeries = {
      assetId,
      symbol: asset.symbol,
      currency: asset.currency as PriceSeries['currency'],
      range,
      points: prices.map((price) => ({
        timestamp: price.timestamp.toISOString(),
        open: toNumber(price.open),
        high: toNumber(price.high),
        low: toNumber(price.low),
        close: toNumber(price.close),
        volume: toNullableNumber(price.volume),
      })),
      meta: this.buildMeta(
        prices.map((price) => price.timestamp.toISOString()),
        prices.some((price) => price.isDemo),
      ),
    };

    await this.cache.set(key, series, CACHE_TTL.priceSeries);
    return series;
  }

  /** Refreshes quotes for the given symbols and stores them as the day's close. */
  async refreshQuotes(symbols: string[]): Promise<number> {
    if (symbols.length === 0) return 0;
    const quotes = await this.provider.getQuotes(symbols);
    let written = 0;

    for (const quote of quotes) {
      const asset = await this.db.asset.findUnique({ where: { symbol: quote.symbol } });
      if (!asset) continue;

      // One row per (asset, day): re-running the job is idempotent.
      const timestamp = new Date(
        `${quote.timestamp.toISOString().slice(0, 10)}T17:30:00.000Z`,
      );
      await this.db.marketPrice.upsert({
        where: { assetId_timestamp: { assetId: asset.id, timestamp } },
        create: {
          assetId: asset.id,
          timestamp,
          open: quote.previousClose ?? quote.price,
          high: Math.max(quote.price, quote.previousClose ?? quote.price),
          low: Math.min(quote.price, quote.previousClose ?? quote.price),
          close: quote.price,
          isDemo: this.provider.isDemo,
        },
        update: { close: quote.price, isDemo: this.provider.isDemo },
      });
      written += 1;
    }

    await this.cache.delByPrefix(cacheKey('prices'));
    return written;
  }

  async refreshIndices(): Promise<number> {
    const indices = await this.db.marketIndex.findMany();
    const quotes = await this.provider.getIndexQuotes(indices.map((index) => index.key));
    let written = 0;

    for (const quote of quotes) {
      const index = indices.find((candidate) => candidate.key === quote.key);
      if (!index) continue;
      const timestamp = new Date(`${quote.timestamp.toISOString().slice(0, 10)}T17:30:00.000Z`);
      await this.db.marketIndexQuote.upsert({
        where: { indexId_timestamp: { indexId: index.id, timestamp } },
        create: {
          indexId: index.id,
          timestamp,
          value: quote.value,
          previousClose: quote.previousClose,
          isDemo: this.provider.isDemo,
        },
        update: { value: quote.value, previousClose: quote.previousClose },
      });
      written += 1;
    }

    await this.cache.del(cacheKey('markets', 'overview'));
    return written;
  }

  async refreshFxRates(currencies: string[]): Promise<void> {
    const rates = await this.provider.getFxRates(currencies);
    const timestamp = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    for (const [currency, rate] of Object.entries(rates)) {
      await this.db.fxRate.upsert({
        where: { currency_timestamp: { currency, timestamp } },
        create: { currency, rate, timestamp, isDemo: this.provider.isDemo },
        update: { rate },
      });
    }
  }

  async searchProviderAssets(query: string) {
    return this.provider.searchAssets(query);
  }

  buildMeta(timestamps: string[], isDemo: boolean, isStale = false): DataMeta {
    const asOf = timestamps.length > 0 ? timestamps.slice().sort().at(-1) : undefined;
    return {
      asOf: asOf ?? new Date().toISOString(),
      isDemo: isDemo || this.provider.isDemo,
      provider: this.provider.name,
      isStale,
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }
}

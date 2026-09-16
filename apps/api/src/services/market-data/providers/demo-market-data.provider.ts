import { createHash } from 'node:crypto';
import type { PriceRange } from '@nova/types';
import { MARKET_INDICES } from '@nova/config';
import type {
  MarketDataProvider,
  ProviderAssetSearchResult,
  ProviderCandle,
  ProviderIndexQuote,
  ProviderQuote,
} from './market-data-provider.js';
import { DEMO_ASSETS, DEMO_INDEX_LEVELS } from '../demo-dataset.js';

/**
 * Deterministic demonstration provider.
 *
 * Values are derived from a hash of the symbol and the day, so the same day always yields the
 * same series: a demo must be reproducible and must never look like a live feed. Everything it
 * returns is flagged `isDemo`, which the API propagates to the UI as a "DEMO DATA" badge.
 */
export class DemoMarketDataProvider implements MarketDataProvider {
  readonly name = 'NOVA demo dataset';
  readonly isDemo = true;

  constructor(private readonly now: () => Date = () => new Date()) {}

  /** Stable pseudo-random number in [0, 1) derived from a seed string. */
  private noise(seed: string): number {
    const digest = createHash('sha256').update(seed).digest();
    return digest.readUInt32BE(0) / 0xffffffff;
  }

  private dayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private priceFor(symbol: string, date: Date): { price: number; previousClose: number } {
    const asset = DEMO_ASSETS.find((candidate) => candidate.symbol === symbol);
    const base = asset?.basePrice ?? 100;
    const volatility = asset?.volatility ?? 0.015;

    // A slow drift plus a daily oscillation: visibly synthetic, never a trend to act on.
    const dayIndex = Math.floor(date.getTime() / 86_400_000);
    const todayNoise = this.noise(`${symbol}:${dayIndex}`) - 0.5;
    const yesterdayNoise = this.noise(`${symbol}:${dayIndex - 1}`) - 0.5;

    const price = base * (1 + todayNoise * volatility * 4);
    const previousClose = base * (1 + yesterdayNoise * volatility * 4);
    return {
      price: Number(price.toFixed(4)),
      previousClose: Number(previousClose.toFixed(4)),
    };
  }

  async getQuotes(symbols: string[]): Promise<ProviderQuote[]> {
    const now = this.now();
    return symbols
      .map((symbol) => {
        const asset = DEMO_ASSETS.find((candidate) => candidate.symbol === symbol);
        // Unknown symbol: no invented price. The caller reports the position as unvalued.
        if (!asset) return null;
        const { price, previousClose } = this.priceFor(symbol, now);
        return {
          symbol,
          price,
          previousClose,
          currency: asset.currency,
          timestamp: now,
        } satisfies ProviderQuote;
      })
      .filter((quote): quote is ProviderQuote => quote !== null);
  }

  async getIndexQuotes(keys: string[]): Promise<ProviderIndexQuote[]> {
    const now = this.now();
    return keys
      .map((key) => {
        const definition = MARKET_INDICES.find((index) => index.key === key);
        const base = DEMO_INDEX_LEVELS[key];
        if (!definition || base === undefined) return null;
        const dayIndex = Math.floor(now.getTime() / 86_400_000);
        const todayNoise = this.noise(`index:${key}:${dayIndex}`) - 0.5;
        const yesterdayNoise = this.noise(`index:${key}:${dayIndex - 1}`) - 0.5;
        return {
          key,
          value: Number((base * (1 + todayNoise * 0.03)).toFixed(2)),
          previousClose: Number((base * (1 + yesterdayNoise * 0.03)).toFixed(2)),
          currency: definition.currency,
          timestamp: now,
        } satisfies ProviderIndexQuote;
      })
      .filter((quote): quote is ProviderIndexQuote => quote !== null);
  }

  async getCandles(symbol: string, range: PriceRange): Promise<ProviderCandle[]> {
    const days = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365 }[range];
    const now = this.now();
    const candles: ProviderCandle[] = [];

    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const timestamp = new Date(now.getTime() - offset * 86_400_000);
      // Weekends have no session; leaving them out makes the demo series realistic in shape.
      const weekday = timestamp.getUTCDay();
      if (weekday === 0 || weekday === 6) continue;

      const { price } = this.priceFor(symbol, timestamp);
      if (!Number.isFinite(price)) continue;
      const intradayNoise = this.noise(`${symbol}:intraday:${timestamp.toISOString().slice(0, 10)}`);
      const high = Number((price * (1 + intradayNoise * 0.01)).toFixed(4));
      const low = Number((price * (1 - intradayNoise * 0.01)).toFixed(4));
      candles.push({
        timestamp: new Date(`${timestamp.toISOString().slice(0, 10)}T17:30:00.000Z`),
        open: Number(((high + low) / 2).toFixed(4)),
        high,
        low,
        close: price,
        volume: Math.round(100_000 + intradayNoise * 900_000),
      });
    }
    return candles;
  }

  async getFxRates(currencies: string[]): Promise<Record<string, number>> {
    // Fixed reference rates: a demo must not pretend to track the FX market.
    const reference: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.05 };
    const rates: Record<string, number> = {};
    for (const currency of currencies) {
      const rate = reference[currency];
      if (rate !== undefined) rates[currency] = rate;
    }
    return rates;
  }

  async searchAssets(query: string): Promise<ProviderAssetSearchResult[]> {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return DEMO_ASSETS.filter(
      (asset) =>
        asset.symbol.toLowerCase().includes(needle) || asset.name.toLowerCase().includes(needle),
    )
      .slice(0, 20)
      .map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        currency: asset.currency,
        exchange: asset.exchange,
        country: asset.country,
        isin: asset.isin,
      }));
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  /** Marks the day of the demo dataset, used by the provenance block. */
  get asOf(): Date {
    return this.now();
  }

  get dayKeyToday(): string {
    return this.dayKey(this.now());
  }
}

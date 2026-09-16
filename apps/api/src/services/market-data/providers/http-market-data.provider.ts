import type { PriceRange } from '@nova/types';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { Env } from '../../../config/env.js';
import { upstreamUnavailable } from '../../../http/errors.js';
import type {
  MarketDataProvider,
  ProviderAssetSearchResult,
  ProviderCandle,
  ProviderIndexQuote,
  ProviderQuote,
} from './market-data-provider.js';

/**
 * Generic HTTP market data provider.
 *
 * It targets a small, documented contract (see docs/08-providers.md) so a real vendor can be
 * plugged in behind a thin adapter without touching the rest of NOVA. Every upstream payload
 * is validated: a malformed response becomes "données indisponibles", never a wrong price.
 */
const quoteSchema = z.object({
  symbol: z.string(),
  price: z.number().finite(),
  previousClose: z.number().finite().nullable().optional().default(null),
  currency: z.string().length(3),
  timestamp: z.coerce.date(),
});

const candleSchema = z.object({
  timestamp: z.coerce.date(),
  open: z.number().finite(),
  high: z.number().finite(),
  low: z.number().finite(),
  close: z.number().finite(),
  volume: z.number().finite().nullable().optional().default(null),
});

const indexQuoteSchema = z.object({
  key: z.string(),
  value: z.number().finite(),
  previousClose: z.number().finite().nullable().optional().default(null),
  currency: z.string().length(3),
  timestamp: z.coerce.date(),
});

const searchSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  assetType: z.enum(['stock', 'etf', 'bond', 'fund', 'crypto', 'commodity', 'cash']),
  currency: z.string().length(3),
  exchange: z.string().nullable().optional().default(null),
  country: z.string().nullable().optional().default(null),
  isin: z.string().nullable().optional().default(null),
});

export class HttpMarketDataProvider implements MarketDataProvider {
  readonly name: string;
  readonly isDemo = false;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(
    env: Env,
    private readonly logger: Logger,
  ) {
    this.baseUrl = (env.MARKET_DATA_API_URL ?? '').replace(/\/$/, '');
    this.apiKey = env.MARKET_DATA_API_KEY;
    this.name = new URL(this.baseUrl).hostname;
  }

  private async request<T>(path: string, schema: z.ZodSchema<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          accept: 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw upstreamUnavailable(`Market data provider responded ${response.status}`);
      }
      const payload = await response.json();
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        this.logger.error(
          { issues: parsed.error.issues, path },
          'market data provider returned an unexpected payload',
        );
        throw upstreamUnavailable('Réponse inattendue du fournisseur de données de marché');
      }
      return parsed.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getQuotes(symbols: string[]): Promise<ProviderQuote[]> {
    if (symbols.length === 0) return [];
    const query = encodeURIComponent(symbols.join(','));
    const quotes = await this.request(`/quotes?symbols=${query}`, z.array(quoteSchema));
    return quotes.map((quote) => ({ ...quote, previousClose: quote.previousClose ?? null }));
  }

  async getIndexQuotes(keys: string[]): Promise<ProviderIndexQuote[]> {
    if (keys.length === 0) return [];
    const query = encodeURIComponent(keys.join(','));
    const quotes = await this.request(`/indices?keys=${query}`, z.array(indexQuoteSchema));
    return quotes.map((quote) => ({ ...quote, previousClose: quote.previousClose ?? null }));
  }

  async getCandles(symbol: string, range: PriceRange): Promise<ProviderCandle[]> {
    const candles = await this.request(
      `/candles?symbol=${encodeURIComponent(symbol)}&range=${range}`,
      z.array(candleSchema),
    );
    return candles.map((candle) => ({ ...candle, volume: candle.volume ?? null }));
  }

  async getFxRates(currencies: string[]): Promise<Record<string, number>> {
    if (currencies.length === 0) return {};
    const query = encodeURIComponent(currencies.join(','));
    const rates = await this.request(
      `/fx?base=EUR&currencies=${query}`,
      z.record(z.string(), z.number().finite()),
    );
    return { EUR: 1, ...rates };
  }

  async searchAssets(query: string): Promise<ProviderAssetSearchResult[]> {
    const results = await this.request(
      `/search?q=${encodeURIComponent(query)}`,
      z.array(searchSchema),
    );
    return results.map((result) => ({
      ...result,
      exchange: result.exchange ?? null,
      country: result.country ?? null,
      isin: result.isin ?? null,
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}

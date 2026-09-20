import type { MarketQuote, MarketSeries, Timeframe } from '@/types/market';
import { ASSETS, getAsset, getAssetSeed, timeframeLadder } from './assets';
import { generateCandles } from './generator';

export * from './assets';
export { generateCandles } from './generator';

/**
 * Data provider abstraction. Only the simulated provider ships today; a live
 * provider (exchange REST/WebSocket) can be registered here without touching
 * the analysis engines or the UI.
 */
export interface MarketDataProvider {
  readonly id: 'mock' | 'live';
  readonly label: string;
  getSeries(request: MarketDataRequest): Promise<MarketSeries>;
  getQuotes(assetIds?: string[]): Promise<MarketQuote[]>;
}

export interface MarketDataRequest {
  assetId: string;
  timeframe: Timeframe;
  limit?: number;
  asOf?: number;
}

const SIMULATED_LABEL = 'Données simulées — pas un flux de marché en direct';

export const simulatedProvider: MarketDataProvider = {
  id: 'mock',
  label: SIMULATED_LABEL,
  async getSeries({ assetId, timeframe, limit = 320, asOf }) {
    const candles = generateCandles({
      assetId,
      timeframe,
      count: limit,
      ...(asOf === undefined ? {} : { asOf }),
    });
    return {
      asset: getAsset(assetId),
      timeframe,
      candles,
      source: 'mock',
      sourceLabel: SIMULATED_LABEL,
      fetchedAt: new Date(asOf ?? Date.now()).toISOString(),
    };
  },
  async getQuotes(assetIds) {
    const ids = assetIds ?? ASSETS.map((asset) => asset.id);
    return ids.map((id) => buildQuote(id));
  },
};

let activeProvider: MarketDataProvider = simulatedProvider;

export function setMarketDataProvider(provider: MarketDataProvider): void {
  activeProvider = provider;
}

export function getMarketDataProvider(): MarketDataProvider {
  return activeProvider;
}

/** Fetch a single OHLC series. */
export function getMarketData(request: MarketDataRequest): Promise<MarketSeries> {
  return activeProvider.getSeries(request);
}

/** Fetch the execution series together with its higher timeframe context. */
export async function getMultiTimeframeData(
  assetId: string,
  execution: Timeframe,
  asOf?: number,
): Promise<{ execution: MarketSeries; intermediate: MarketSeries; higher: MarketSeries }> {
  const ladder = timeframeLadder(execution);
  const [executionSeries, intermediateSeries, higherSeries] = await Promise.all([
    getMarketData({ assetId, timeframe: ladder.execution, ...(asOf ? { asOf } : {}) }),
    getMarketData({
      assetId,
      timeframe: ladder.intermediate,
      limit: 240,
      ...(asOf ? { asOf } : {}),
    }),
    getMarketData({ assetId, timeframe: ladder.higher, limit: 200, ...(asOf ? { asOf } : {}) }),
  ]);
  return { execution: executionSeries, intermediate: intermediateSeries, higher: higherSeries };
}

export function getQuotes(assetIds?: string[]): Promise<MarketQuote[]> {
  return activeProvider.getQuotes(assetIds);
}

function buildQuote(assetId: string): MarketQuote {
  const seed = getAssetSeed(assetId);
  const candles = generateCandles({ assetId, timeframe: '1H', count: 72 });
  const last = candles[candles.length - 1]?.close ?? seed.reference;
  const dayAgo = candles[Math.max(candles.length - 24, 0)]?.close ?? last;
  const highs = candles.slice(-24).map((candle) => candle.high);
  const lows = candles.slice(-24).map((candle) => candle.low);

  return {
    asset: getAsset(assetId),
    last,
    changePercent: ((last - dayAgo) / dayAgo) * 100,
    high24h: highs.length ? Math.max(...highs) : last,
    low24h: lows.length ? Math.min(...lows) : last,
    volume: candles.slice(-24).reduce((total, candle) => total + candle.volume, 0),
    spark: candles.slice(-48).map((candle) => candle.close),
  };
}

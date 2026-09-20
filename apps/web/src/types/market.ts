/**
 * Market primitives shared by the data layer, the analysis engines and the UI.
 */

export type AssetClass = 'crypto' | 'forex' | 'metal' | 'index';

export interface Asset {
  /** Stable identifier used in URLs and storage, e.g. `BTCUSDT`. */
  id: string;
  /** Display symbol, e.g. `BTC/USDT`. */
  symbol: string;
  name: string;
  assetClass: AssetClass;
  /** Number of decimals used when formatting a price. */
  precision: number;
  /** Currency suffix used by the formatter. */
  quote: string;
  /** Value of one point used by the position sizing helper. */
  pipSize: number;
}

export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export interface Candle {
  /** Unix timestamp in seconds (UTC). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSeries {
  asset: Asset;
  timeframe: Timeframe;
  candles: Candle[];
  /** Where the candles came from. `mock` is deterministic simulated data. */
  source: 'mock' | 'live';
  /** Human readable provenance shown in the UI so simulated data is never passed off as live. */
  sourceLabel: string;
  fetchedAt: string;
}

export interface MarketQuote {
  asset: Asset;
  last: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume: number;
  /** Compact close series used for sparklines. */
  spark: number[];
}

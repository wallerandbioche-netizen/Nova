import type { CurrencyCode, MarketThemeKey, PriceRange } from './enums.js';
import type { DataMeta, Iso8601 } from './common.js';

export interface MarketQuote {
  key: string;
  label: string;
  value: number;
  currency: CurrencyCode | string;
  changePercent: number | null;
  changeAbsolute: number | null;
  /** Accessible, colour-independent description, e.g. "en hausse de 0,8 %". */
  changeLabel: string;
  asOf: Iso8601;
  isDemo: boolean;
}

export interface MarketOverview {
  quotes: MarketQuote[];
  meta: DataMeta;
}

export interface PricePoint {
  timestamp: Iso8601;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface PriceSeries {
  assetId: string;
  symbol: string;
  currency: CurrencyCode;
  range: PriceRange;
  points: PricePoint[];
  meta: DataMeta;
}

export interface MarketRadarTheme {
  key: MarketThemeKey;
  label: string;
  /** 0-100 deterministic score: how much this theme drives today's news flow. */
  importance: number;
  /** Directional reading of the theme, never a forecast. */
  direction: 'rising' | 'falling' | 'stable';
  directionLabel: string;
  summary: string;
  relatedNewsIds: string[];
  /** Share of the user's portfolio exposed to this theme, in percent. Null without a portfolio. */
  userExposurePercent: number | null;
  asOf: Iso8601;
}

export interface MarketRadar {
  themes: MarketRadarTheme[];
  meta: DataMeta;
}

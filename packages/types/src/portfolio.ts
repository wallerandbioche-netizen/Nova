import type { AssetType, CurrencyCode, MarketThemeKey, Region } from './enums.js';
import type { DataMeta, Iso8601 } from './common.js';

export interface Sector {
  id: string;
  key: string;
  label: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  exchange: string | null;
  currency: CurrencyCode;
  country: string | null;
  region: Region;
  sector: Sector | null;
  isin: string | null;
  isDemo: boolean;
}

export interface Portfolio {
  id: string;
  name: string;
  baseCurrency: CurrencyCode;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface Position {
  id: string;
  portfolioId: string;
  asset: Asset;
  quantity: number;
  averagePrice: number;
  currency: CurrencyCode;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

/** A position enriched with its latest known valuation. All numbers are computed server-side. */
export interface ValuedPosition extends Position {
  lastPrice: number | null;
  /** Market value converted into the portfolio base currency. */
  marketValue: number | null;
  costBasis: number;
  unrealizedGain: number | null;
  unrealizedGainPercent: number | null;
  weightPercent: number | null;
  priceAsOf: Iso8601 | null;
  isDemoPrice: boolean;
}

export interface AllocationSlice<K extends string = string> {
  key: K;
  label: string;
  value: number;
  percent: number;
}

export interface ConcentrationMetrics {
  /** Weight of the single largest position, in percent. */
  topPositionPercent: number;
  topPositionLabel: string | null;
  /** Combined weight of the three largest positions, in percent. */
  topThreePercent: number;
  /** Herfindahl-Hirschman index over position weights, normalised to 0-100. */
  herfindahlIndex: number;
  positionCount: number;
}

export interface PortfolioAnalytics {
  portfolioId: string;
  baseCurrency: CurrencyCode;
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercent: number;
  /** Day-over-day change, null when no previous close is known for every position. */
  dayChange: number | null;
  dayChangePercent: number | null;
  byAssetType: AllocationSlice<AssetType>[];
  byRegion: AllocationSlice<Region>[];
  bySector: AllocationSlice[];
  byCurrency: AllocationSlice<CurrencyCode>[];
  concentration: ConcentrationMetrics;
  /** Share of the portfolio value that could not be valued (missing price). */
  unvaluedPercent: number;
  meta: DataMeta;
}

/** Portfolio exposure expressed in the vocabulary used by the news scoring engine. */
export interface PortfolioExposure {
  portfolioId: string;
  bySector: Record<string, number>;
  byRegion: Record<string, number>;
  byAssetType: Record<string, number>;
  byTheme: Record<MarketThemeKey, number>;
  assetIds: string[];
  symbols: string[];
  totalValue: number;
  baseCurrency: CurrencyCode;
  meta: DataMeta;
}

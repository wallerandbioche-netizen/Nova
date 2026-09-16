import type { AssetType, PriceRange } from '@nova/types';

/**
 * Market data provider contract.
 *
 * Implementations must never invent a price: when data is unavailable they return an empty
 * result and the caller surfaces "donnée indisponible" rather than a plausible number.
 */
export interface ProviderQuote {
  symbol: string;
  price: number;
  previousClose: number | null;
  currency: string;
  timestamp: Date;
}

export interface ProviderCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface ProviderIndexQuote {
  key: string;
  value: number;
  previousClose: number | null;
  currency: string;
  timestamp: Date;
}

export interface ProviderAssetSearchResult {
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: string;
  exchange: string | null;
  country: string | null;
  isin: string | null;
}

export interface MarketDataProvider {
  /** Identifier shown to the user in the provenance block. */
  readonly name: string;
  /** True when the data is demonstration data and must be labelled as such in the UI. */
  readonly isDemo: boolean;

  getQuotes(symbols: string[]): Promise<ProviderQuote[]>;
  getIndexQuotes(keys: string[]): Promise<ProviderIndexQuote[]>;
  getCandles(symbol: string, range: PriceRange): Promise<ProviderCandle[]>;
  /** Value of one unit of each currency expressed in EUR. */
  getFxRates(currencies: string[]): Promise<Record<string, number>>;
  searchAssets(query: string): Promise<ProviderAssetSearchResult[]>;
  healthCheck(): Promise<boolean>;
}

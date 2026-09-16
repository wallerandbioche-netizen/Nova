import type { Locale, NewsCategory } from '@nova/types';

/**
 * News provider contract.
 *
 * A provider returns raw items; normalisation, deduplication, classification, entity
 * extraction and scoring all happen inside NOVA so the ranking stays explainable and
 * provider-independent (rule #37).
 */
export interface RawNewsItem {
  /** Provider-side identifier, when available, for idempotent ingestion. */
  externalId: string | null;
  title: string;
  summary: string;
  body: string | null;
  source: string;
  sourceUrl: string | null;
  publishedAt: Date;
  language: Locale;
  /** Provider-supplied category, treated as a hint only. */
  category: NewsCategory | null;
  /** Tickers mentioned by the provider, if any. */
  symbols: string[];
}

export interface NewsProvider {
  readonly name: string;
  readonly isDemo: boolean;
  fetchLatest(options: { since?: Date; limit?: number }): Promise<RawNewsItem[]>;
  healthCheck(): Promise<boolean>;
}

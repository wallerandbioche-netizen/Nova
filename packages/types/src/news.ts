import type { Locale, NewsCategory, TimeHorizon } from './enums.js';
import type { DataMeta, Iso8601, SourceReference, Statement } from './common.js';

export interface NewsAssetLink {
  assetId: string;
  symbol: string;
  name: string;
  /** 0-100: how directly the news concerns this asset. */
  relevance: number;
}

export interface NewsSectorLink {
  sectorKey: string;
  label: string;
  relevance: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string | null;
  publishedAt: Iso8601;
  category: NewsCategory;
  language: Locale;
  affectedAssets: NewsAssetLink[];
  affectedSectors: NewsSectorLink[];
  importanceScore: number;
  confidenceScore: number;
  horizon: TimeHorizon;
  isDemo: boolean;
}

/** A news item ranked for one specific user. */
export interface PersonalizedNewsItem extends NewsItem {
  portfolioRelevanceScore: number;
  /** Short, factual reason why this item surfaced, e.g. "3 positions dans la technologie". */
  relevanceReason: string | null;
  exposurePercent: number | null;
}

export interface NewsExposureBreakdown {
  label: string;
  percent: number;
  kind: 'sector' | 'region' | 'asset' | 'theme';
}

/**
 * The "Pourquoi cela vous concerne ?" payload. Each block is epistemically typed so the UI
 * can render facts, analysis and hypotheses differently.
 */
export interface NewsAnalysis {
  newsId: string;
  whatHappened: Statement;
  whyItMatters: Statement;
  affectedAssets: NewsAssetLink[];
  affectedSectors: NewsSectorLink[];
  yourExposure: NewsExposureBreakdown[];
  yourExposureSummary: string;
  whyItConcernsYou: Statement[];
  uncertainties: string[];
  sources: SourceReference[];
  importanceScore: number;
  confidenceScore: number;
  portfolioRelevanceScore: number;
  horizon: TimeHorizon;
  /** True when the explanation comes from the deterministic fallback instead of the LLM. */
  isFallback: boolean;
  generatedAt: Iso8601;
  meta: DataMeta;
}

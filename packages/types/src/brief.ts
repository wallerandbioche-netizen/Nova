import type { DataMeta, Iso8601, Statement } from './common.js';
import type { MarketQuote } from './market.js';
import type { PersonalizedNewsItem } from './news.js';

export interface DailyBriefItem {
  newsId: string;
  title: string;
  source: string;
  publishedAt: Iso8601;
  importanceScore: number;
  portfolioRelevanceScore: number;
  /** One factual line + one contextual line, never a recommendation. */
  takeaway: string;
  relevanceReason: string | null;
}

export interface DailyBrief {
  id: string;
  date: string;
  greeting: string;
  headline: string;
  summary: string;
  marketSummary: Statement;
  portfolioSummary: Statement | null;
  items: DailyBriefItem[];
  learningSuggestionId: string | null;
  uncertainties: string[];
  generatedAt: Iso8601;
  /** Data cut-off used to build the brief. The UI always displays it. */
  dataAsOf: Iso8601;
  /** True when today's generation failed and an earlier brief is being shown instead. */
  isStale: boolean;
  isFallback: boolean;
  meta: DataMeta;
}

export interface DashboardPayload {
  greeting: string;
  brief: DailyBrief | null;
  portfolio: {
    id: string;
    name: string;
    totalValue: number;
    baseCurrency: string;
    dayChangePercent: number | null;
    totalUnrealizedGainPercent: number;
    changeLabel: string;
    isEmpty: boolean;
    meta: DataMeta;
  } | null;
  markets: MarketQuote[];
  topNews: PersonalizedNewsItem[];
  portfolioInsight: Statement | null;
  lessonOfTheDay: { id: string; title: string; estimatedMinutes: number } | null;
  unreadNotifications: number;
  meta: DataMeta;
}

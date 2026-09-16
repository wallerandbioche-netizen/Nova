import type {
  AnalysisStatus,
  ConfidenceLevel,
  LevelType,
  MarketBias,
  MarketType,
  ReasoningCategory,
  TechnicalArea,
} from '@prisma/client';

export type {
  AnalysisStatus,
  ConfidenceLevel,
  LevelType,
  MarketBias,
  MarketType,
  ReasoningCategory,
  TechnicalArea,
};

/** Optional hints the trader may add before scanning. Never fabricated. */
export interface AnalysisHints {
  asset?: string | undefined;
  timeframe?: string | undefined;
  market?: MarketType | undefined;
  /** Declared trading style — used to phrase the request, never to invent data. */
  tradingStyle?: string | undefined;
}

export interface KeyLevelView {
  type: LevelType;
  price: number | null;
  priceMax: number | null;
  label: string | null;
}

export interface TechnicalObservationView {
  category: TechnicalArea;
  title: string;
  detail: string;
}

export interface ReasoningView {
  category: ReasoningCategory;
  content: string;
}

/**
 * A model response that has passed schema *and* coherence validation. This is
 * the only shape the persistence layer accepts — a raw provider payload never
 * reaches the database.
 */
export interface ValidatedAnalysis {
  status: Extract<AnalysisStatus, 'COMPLETED' | 'NO_TRADE' | 'INSUFFICIENT_DATA'>;
  asset: string | null;
  timeframe: string | null;
  market: MarketType | null;
  chartType: string | null;
  approxPrice: number | null;
  bias: MarketBias | null;
  entryMin: number | null;
  entryMax: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  /** Always recomputed server-side from entry/SL/TP1 — never trusted from the model. */
  riskReward: number | null;
  confidence: ConfidenceLevel | null;
  summary: string;
  invalidation: string | null;
  warnings: string[];
  levels: KeyLevelView[];
  technical: TechnicalObservationView[];
  reasoning: ReasoningView[];
}

/** Row shape used by lists (history, dashboard). */
export interface AnalysisListItem {
  id: string;
  createdAt: Date;
  status: AnalysisStatus;
  asset: string | null;
  timeframe: string | null;
  market: MarketType | null;
  bias: MarketBias | null;
  entryMin: number | null;
  entryMax: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  riskReward: number | null;
  confidence: ConfidenceLevel | null;
}

/** Full detail shape rendered by the analysis page. */
export interface AnalysisDetail extends AnalysisListItem {
  updatedAt: Date;
  completedAt: Date | null;
  chartType: string | null;
  approxPrice: number | null;
  summary: string | null;
  invalidation: string | null;
  warnings: string[];
  failureCode: string | null;
  durationMs: number | null;
  requestedAsset: string | null;
  requestedTimeframe: string | null;
  requestedMarket: MarketType | null;
  levels: KeyLevelView[];
  technical: TechnicalObservationView[];
  reasoning: ReasoningView[];
}

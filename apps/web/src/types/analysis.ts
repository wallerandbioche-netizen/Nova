import type { Asset, Candle, Timeframe } from './market';

export type Direction = 'long' | 'short' | 'none';
export type MarketBias = 'bullish' | 'bearish' | 'neutral';
export type Strength = 'weak' | 'medium' | 'strong';
export type SignalTone = 'bullish' | 'bearish' | 'neutral' | 'warning';

export type MarketRegime = 'strong_bullish' | 'bullish' | 'range' | 'bearish' | 'strong_bearish';

export type VolatilityRegime = 'low' | 'normal' | 'high';

export type StructureEvent = 'HH' | 'HL' | 'LH' | 'LL';

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  kind: 'high' | 'low';
  label?: StructureEvent;
}

export interface StructureBreak {
  type: 'BOS' | 'CHoCH';
  direction: 'bullish' | 'bearish';
  price: number;
  time: number;
  description: string;
}

export interface MarketStructure {
  state: 'bullish' | 'bearish' | 'range';
  swings: SwingPoint[];
  events: StructureBreak[];
  /** Last four labelled swings, most recent last. */
  sequence: StructureEvent[];
  description: string;
}

export interface LevelZone {
  /** Mid price of the zone. */
  price: number;
  /** Zone boundaries — levels are areas, never a single exact price. */
  zone: { low: number; high: number };
  type: 'support' | 'resistance';
  strength: Strength;
  timeframe: Timeframe;
  /** Number of touches that produced a visible reaction. */
  reactions: number;
  /** Distance to the current price, in percent. */
  distancePercent: number;
}

export interface IndicatorSnapshot {
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  atr14: number | null;
  vwap: number | null;
  volume: { last: number; average: number; ratio: number } | null;
}

export interface IndicatorSeries {
  ema20: (number | null)[];
  ema50: (number | null)[];
  ema200: (number | null)[];
  rsi14: (number | null)[];
  macd: { macd: number | null; signal: number | null; histogram: number | null }[];
  atr14: (number | null)[];
  vwap: (number | null)[];
}

export type LiquidityKind =
  | 'equal_highs'
  | 'equal_lows'
  | 'liquidity_sweep_high'
  | 'liquidity_sweep_low'
  | 'failed_breakout'
  | 'reclaim';

export interface LiquidityEvent {
  kind: LiquidityKind;
  price: number;
  time: number;
  direction: 'bullish' | 'bearish';
  description: string;
  /** Confidence the engine has in this read, derived from the data only. */
  confidence: Strength;
}

export type PatternKind =
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'pin_bar_bullish'
  | 'pin_bar_bearish'
  | 'momentum_candle_bullish'
  | 'momentum_candle_bearish'
  | 'breakout'
  | 'retest'
  | 'failed_breakout'
  | 'consolidation';

export interface PatternMatch {
  kind: PatternKind;
  label: string;
  index: number;
  time: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: Strength;
  description: string;
}

export interface MomentumRead {
  bias: MarketBias;
  strength: Strength;
  rsi: number | null;
  macdHistogram: number | null;
  description: string;
}

export interface VolumeRead {
  bias: MarketBias;
  strength: Strength;
  ratio: number | null;
  description: string;
}

export interface VolatilityRead {
  regime: VolatilityRegime;
  atr: number | null;
  atrPercent: number | null;
  description: string;
}

export type ConfluenceFactorKey =
  | 'structure'
  | 'trend'
  | 'levels'
  | 'volume'
  | 'momentum'
  | 'volatility'
  | 'price_action'
  | 'liquidity'
  | 'higher_timeframe';

export interface ConfluenceFactor {
  key: ConfluenceFactorKey;
  label: string;
  signal: SignalTone;
  direction: Direction;
  strength: Strength;
  /** Signed contribution to the score: positive favours long, negative favours short. */
  weight: number;
  explanation: string;
}

export interface ConfluenceResult {
  factors: ConfluenceFactor[];
  /** 0–10, magnitude of agreement between factors — not a probability of profit. */
  score: number;
  direction: Direction;
  agreement: number;
  conflicts: string[];
}

export interface TimeframeRead {
  timeframe: Timeframe;
  bias: MarketBias;
  regime: MarketRegime;
  note: string;
}

export interface MultiTimeframeRead {
  higher: TimeframeRead;
  intermediate: TimeframeRead;
  execution: TimeframeRead;
  alignment: 'strong' | 'partial' | 'conflicting';
  description: string;
}

export type SetupKind =
  | 'trend_continuation'
  | 'breakout_retest'
  | 'support_rejection'
  | 'resistance_rejection'
  | 'liquidity_sweep'
  | 'range_breakout'
  | 'mean_reversion'
  | 'momentum_breakout';

export interface TakeProfit {
  label: 'TP1' | 'TP2' | 'TP3';
  price: number;
  /** Reward multiple measured against the stop distance. */
  r: number;
  rationale: string;
}

export interface TradeSetup {
  kind: SetupKind;
  label: string;
  direction: Exclude<Direction, 'none'>;
  entryZone: { low: number; high: number };
  stopLoss: number;
  takeProfits: TakeProfit[];
  riskReward: number;
  invalidation: string;
  timeframe: Timeframe;
  confluenceScore: number;
  reasons: string[];
  /** Conditions that would cancel the idea before or after entry. */
  noTradeConditions: string[];
}

export interface NoTradeVerdict {
  /** Machine readable causes, useful for tests and analytics. */
  codes: NoTradeCode[];
  reasons: string[];
}

export type NoTradeCode =
  | 'low_confluence'
  | 'conflicting_structure'
  | 'insufficient_risk_reward'
  | 'excessive_volatility'
  | 'no_setup'
  | 'conflicting_timeframes'
  | 'insufficient_data'
  | 'levels_too_close'
  | 'invalidation_too_wide';

export type RiskProfile = 'prudent' | 'modere' | 'agressif';

export interface AnalysisNarrative {
  marketContext: string;
  structure: string;
  keyLevels: string;
  momentum: string;
  volume: string;
  setup: string;
  entry: string;
  riskManagement: string;
  invalidation: string;
}

export interface MarketAnalysis {
  id: string;
  createdAt: string;
  asset: Asset;
  timeframe: Timeframe;
  riskProfile: RiskProfile;
  lastPrice: number;
  marketBias: MarketBias;
  marketRegime: MarketRegime;
  marketStructure: MarketStructure;
  supportResistance: LevelZone[];
  indicators: IndicatorSnapshot;
  liquidity: LiquidityEvent[];
  patterns: PatternMatch[];
  momentum: MomentumRead;
  volume: VolumeRead;
  volatility: VolatilityRead;
  confluence: ConfluenceResult;
  multiTimeframe: MultiTimeframeRead;
  /** Present only when a setup passed every gate. */
  setup: TradeSetup | null;
  /** Present when the engine declined to propose a trade. */
  noTrade: NoTradeVerdict | null;
  narrative: AnalysisNarrative;
  /** Where the candles came from, echoed so the UI can label simulated data. */
  dataSource: { source: 'mock' | 'live'; label: string; candles: number };
  /** Which reasoning layer produced the narrative. */
  reasoningProvider: string;
  /** Origin of the analysed data. */
  origin: 'market_data' | 'screenshot';
  notes: string[];
}

export interface AnalysisInput {
  asset: Asset;
  timeframe: Timeframe;
  candles: Candle[];
  riskProfile: RiskProfile;
  /** Optional free-text context supplied by the trader. */
  context?: string;
  higherTimeframeCandles?: { timeframe: Timeframe; candles: Candle[] }[];
}

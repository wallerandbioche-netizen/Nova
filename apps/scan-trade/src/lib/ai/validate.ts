import type {
  ConfidenceLevel,
  KeyLevelView,
  LevelType,
  MarketBias,
  MarketType,
  ReasoningCategory,
  ReasoningView,
  TechnicalArea,
  TechnicalObservationView,
  ValidatedAnalysis,
} from '@/types/analysis';
import { aiAnalysisResponseSchema, type AIAnalysisResponse } from './schema';

/**
 * Nothing the model returns is trusted (§41).
 *
 * Two gates run in order:
 *   1. shape — the JSON must match the contract;
 *   2. coherence — a trade plan must be internally consistent (direction,
 *      ordering of levels, plausible magnitudes, a computable risk/reward).
 *
 * A response that fails gate 2 is rejected outright rather than shown with a
 * caveat: a stop loss on the wrong side of the entry is not a nuance.
 */

export class AnalysisValidationError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Réponse d'analyse incohérente : ${reasons.join(' ; ')}`);
    this.name = 'AnalysisValidationError';
    this.reasons = reasons;
  }
}

/** A level further than 5× (or closer than 1/5×) the entry is a decimal mistake, not a setup. */
const MAGNITUDE_BAND = 5;
const MIN_RISK_REWARD = 0.1;
const MAX_RISK_REWARD = 50;

const LEVEL_TYPE_MAP: Record<AIAnalysisResponse['key_levels'][number]['type'], LevelType> = {
  support_primary: 'SUPPORT_PRIMARY',
  support_secondary: 'SUPPORT_SECONDARY',
  resistance_primary: 'RESISTANCE_PRIMARY',
  resistance_secondary: 'RESISTANCE_SECONDARY',
  entry_zone: 'ENTRY_ZONE',
  invalidation: 'INVALIDATION',
  take_profit_1: 'TAKE_PROFIT_1',
  take_profit_2: 'TAKE_PROFIT_2',
};

const TECHNICAL_AREA_MAP: Record<AIAnalysisResponse['technical_analysis'][number]['category'], TechnicalArea> = {
  trend: 'TREND',
  market_structure: 'MARKET_STRUCTURE',
  support_resistance: 'SUPPORT_RESISTANCE',
  momentum: 'MOMENTUM',
  indicators: 'INDICATORS',
  volume: 'VOLUME',
  other: 'OTHER',
};

const REASONING_MAP: Record<AIAnalysisResponse['reasoning'][number]['category'], ReasoningCategory> = {
  observation: 'OBSERVATION',
  interpretation: 'INTERPRETATION',
  confirmation: 'CONFIRMATION',
  invalidation: 'INVALIDATION',
  confidence: 'CONFIDENCE',
  limitation: 'LIMITATION',
};

const MARKET_MAP: Record<NonNullable<AIAnalysisResponse['market']>, MarketType> = {
  crypto: 'CRYPTO',
  forex: 'FOREX',
  indices: 'INDICES',
  stocks: 'STOCKS',
  commodities: 'COMMODITIES',
  other: 'OTHER',
};

const BIAS_MAP: Record<NonNullable<AIAnalysisResponse['market_bias']>, MarketBias> = {
  long: 'LONG',
  short: 'SHORT',
  neutral: 'NEUTRAL',
};

const CONFIDENCE_MAP: Record<NonNullable<AIAnalysisResponse['confidence']>, ConfidenceLevel> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
};

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Number of decimals worth keeping for an instrument trading around `price`. */
function decimalsFor(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 1) return 4;
  if (price >= 0.01) return 6;
  return 8;
}

/**
 * Parses and validates a raw provider payload.
 *
 * @throws {AnalysisValidationError} when the payload cannot be trusted.
 */
export function validateAnalysisResponse(raw: unknown): ValidatedAnalysis {
  const parsed = aiAnalysisResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AnalysisValidationError(
      parsed.error.issues.slice(0, 6).map((issue) => `${issue.path.join('.') || 'racine'}: ${issue.message}`),
    );
  }

  const data = parsed.data;
  const warnings = [...new Set(data.warnings)];

  const base = {
    asset: data.asset,
    timeframe: data.timeframe,
    market: data.market ? MARKET_MAP[data.market] : null,
    chartType: data.chart_type,
    approxPrice: isPositiveFinite(data.approximate_price) ? data.approximate_price : null,
    confidence: data.confidence ? CONFIDENCE_MAP[data.confidence] : null,
    summary: data.summary,
    invalidation: data.invalidation && data.invalidation.length > 0 ? data.invalidation : null,
    technical: mapTechnical(data.technical_analysis),
    reasoning: mapReasoning(data.reasoning),
  };

  // --- Declined scenarios -------------------------------------------------
  // The model said it will not produce a setup. Any price it happened to fill
  // in is dropped: a NO TRADE that still ships an entry is worse than useless.
  if (data.status !== 'analysis') {
    return {
      ...base,
      status: data.status === 'no_trade' ? 'NO_TRADE' : 'INSUFFICIENT_DATA',
      bias: data.market_bias ? BIAS_MAP[data.market_bias] : null,
      entryMin: null,
      entryMax: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      riskReward: null,
      invalidation: null,
      warnings,
      levels: mapLevels(data.key_levels).filter(
        (level) => level.type !== 'ENTRY_ZONE' && level.type !== 'TAKE_PROFIT_1' && level.type !== 'TAKE_PROFIT_2',
      ),
    };
  }

  // --- Trade plan ---------------------------------------------------------
  const reasons: string[] = [];

  const bias = data.market_bias ? BIAS_MAP[data.market_bias] : null;
  if (bias !== 'LONG' && bias !== 'SHORT') {
    reasons.push('un scénario exploitable exige une direction LONG ou SHORT');
  }

  const entryMin = data.entry?.min ?? null;
  const entryMax = data.entry?.max ?? null;
  const stopLoss = data.stop_loss;
  const takeProfit1 = data.take_profit_1;
  const takeProfit2 = data.take_profit_2;

  for (const [label, value] of [
    ['zone d’entrée basse', entryMin],
    ['zone d’entrée haute', entryMax],
    ['stop loss', stopLoss],
    ['take profit 1', takeProfit1],
  ] as const) {
    if (!isPositiveFinite(value)) reasons.push(`${label} manquant ou non exploitable`);
  }

  if (takeProfit2 != null && !isPositiveFinite(takeProfit2)) {
    reasons.push('take profit 2 non exploitable');
  }

  if (reasons.length > 0) throw new AnalysisValidationError(reasons);

  // Narrowed by the loop above.
  const low = Math.min(entryMin as number, entryMax as number);
  const high = Math.max(entryMin as number, entryMax as number);
  const sl = stopLoss as number;
  const tp1 = takeProfit1 as number;
  const tp2 = takeProfit2 ?? null;
  const entryMid = (low + high) / 2;

  // Magnitude sanity: everything must live in the same decimal world.
  for (const [label, value] of [
    ['stop loss', sl],
    ['take profit 1', tp1],
    ...(tp2 != null ? ([['take profit 2', tp2]] as const) : []),
  ] as const) {
    if (value > entryMid * MAGNITUDE_BAND || value < entryMid / MAGNITUDE_BAND) {
      reasons.push(`${label} hors de proportion avec la zone d’entrée`);
    }
  }

  if (bias === 'LONG') {
    if (sl >= low) reasons.push('un stop loss LONG doit se situer sous la zone d’entrée');
    if (tp1 <= high) reasons.push('un take profit LONG doit se situer au-dessus de la zone d’entrée');
    if (tp2 != null && tp2 <= tp1) reasons.push('le take profit 2 doit dépasser le take profit 1 en LONG');
  } else {
    if (sl <= high) reasons.push('un stop loss SHORT doit se situer au-dessus de la zone d’entrée');
    if (tp1 >= low) reasons.push('un take profit SHORT doit se situer sous la zone d’entrée');
    if (tp2 != null && tp2 >= tp1) reasons.push('le take profit 2 doit être inférieur au take profit 1 en SHORT');
  }

  if (reasons.length > 0) throw new AnalysisValidationError(reasons);

  const risk = Math.abs(entryMid - sl);
  const reward = Math.abs(tp1 - entryMid);
  if (risk <= 0) reasons.push('le risque calculé est nul');
  const riskReward = risk > 0 ? reward / risk : 0;
  if (risk > 0 && (riskReward < MIN_RISK_REWARD || riskReward > MAX_RISK_REWARD)) {
    reasons.push('le ratio risque/rendement calculé est aberrant');
  }

  if (reasons.length > 0) throw new AnalysisValidationError(reasons);

  // The model's own risk/reward is advisory only. Ours wins, and a wide gap is
  // surfaced to the user rather than silently swallowed.
  if (isPositiveFinite(data.risk_reward)) {
    const drift = Math.abs(data.risk_reward - riskReward) / riskReward;
    if (drift > 0.25) {
      warnings.push(
        'Le ratio risque/rendement annoncé par le modèle différait du ratio recalculé à partir des niveaux : la valeur affichée est celle recalculée.',
      );
    }
  }

  const decimals = decimalsFor(entryMid);

  return {
    ...base,
    status: 'COMPLETED',
    bias,
    entryMin: round(low, decimals),
    entryMax: round(high, decimals),
    stopLoss: round(sl, decimals),
    takeProfit1: round(tp1, decimals),
    takeProfit2: tp2 != null ? round(tp2, decimals) : null,
    riskReward: round(riskReward, 2),
    warnings,
    levels: mapLevels(data.key_levels),
  };
}

function mapLevels(levels: AIAnalysisResponse['key_levels']): KeyLevelView[] {
  const seen = new Set<string>();
  const out: KeyLevelView[] = [];
  for (const level of levels) {
    const price = isPositiveFinite(level.price) ? level.price : null;
    const priceMax = isPositiveFinite(level.price_max) ? level.price_max : null;
    // A level with neither a price nor a label carries no information.
    if (price == null && !level.label) continue;
    const key = `${level.type}:${price ?? ''}:${priceMax ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      type: LEVEL_TYPE_MAP[level.type],
      price: price != null ? round(price, decimalsFor(price)) : null,
      priceMax: priceMax != null && price != null && priceMax > price ? round(priceMax, decimalsFor(priceMax)) : null,
      label: level.label,
    });
  }
  return out;
}

function mapTechnical(items: AIAnalysisResponse['technical_analysis']): TechnicalObservationView[] {
  return items.map((item) => ({
    category: TECHNICAL_AREA_MAP[item.category],
    title: item.title,
    detail: item.detail,
  }));
}

function mapReasoning(items: AIAnalysisResponse['reasoning']): ReasoningView[] {
  return items.map((item) => ({ category: REASONING_MAP[item.category], content: item.content }));
}

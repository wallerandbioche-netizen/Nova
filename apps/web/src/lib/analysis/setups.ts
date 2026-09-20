import type { Candle, Timeframe } from '@/types/market';
import type {
  ConfluenceResult,
  Direction,
  IndicatorSnapshot,
  LevelZone,
  LiquidityEvent,
  MarketRegime,
  MarketStructure,
  MomentumRead,
  MultiTimeframeRead,
  NoTradeCode,
  PatternMatch,
  RiskProfile,
  SetupKind,
  SwingPoint,
  TakeProfit,
  TradeSetup,
  VolatilityRead,
  VolumeRead,
} from '@/types/analysis';
import { SETUP_LABEL } from '@/lib/utils/labels';
import { RISK_PROFILES, riskRewardRatio, zoneMid } from './risk';

export interface SetupContext {
  candles: Candle[];
  timeframe: Timeframe;
  riskProfile: RiskProfile;
  structure: MarketStructure;
  regime: MarketRegime;
  levels: LevelZone[];
  patterns: PatternMatch[];
  liquidity: LiquidityEvent[];
  momentum: MomentumRead;
  volume: VolumeRead;
  volatility: VolatilityRead;
  multiTimeframe: MultiTimeframeRead;
  confluence: ConfluenceResult;
  indicators: IndicatorSnapshot;
  swings: SwingPoint[];
  price: number;
}

interface Candidate {
  kind: SetupKind;
  direction: Exclude<Direction, 'none'>;
  reasons: string[];
  /** Anchor used to build the entry zone. */
  entryAnchor: number;
  /** Structural price the stop must protect. */
  structuralStop: number | null;
  bonus: number;
}

export interface SetupResult {
  setup: TradeSetup | null;
  /** Gates that rejected the best candidate, if any. */
  rejections: NoTradeCode[];
  rejectionNotes: string[];
  /** The candidate that scored best, even when it was rejected. */
  consideredKind: SetupKind | null;
}

/**
 * Build the candidate setups the data supports, keep the best one and run it
 * through the risk gates. A rejected candidate produces NO TRADE reasons
 * rather than a watered-down signal.
 */
export function buildSetup(context: SetupContext): SetupResult {
  const config = RISK_PROFILES[context.riskProfile];
  const atrValue = context.indicators.atr14;

  if (context.candles.length < 60 || atrValue == null) {
    return {
      setup: null,
      rejections: ['insufficient_data'],
      rejectionNotes: [
        "L'historique disponible est trop court pour calculer une volatilité fiable et placer un stop cohérent.",
      ],
      consideredKind: null,
    };
  }

  const candidates = collectCandidates(context, atrValue);
  if (!candidates.length) {
    return {
      setup: null,
      rejections: ['no_setup'],
      rejectionNotes: [
        "Aucune des configurations suivies n'est présente sur les dernières bougies : il n'y a rien à exécuter.",
      ],
      consideredKind: null,
    };
  }

  const direction = context.confluence.direction;
  const aligned = candidates.filter((candidate) => candidate.direction === direction);
  const pool = aligned.length ? aligned : candidates;
  const best = pool.reduce(
    (winner, candidate) => (candidate.bonus > winner.bonus ? candidate : winner),
    pool[0] as Candidate,
  );

  const rejections: NoTradeCode[] = [];
  const notes: string[] = [];

  // Gate 1 — the confluence must support the candidate's direction.
  if (context.confluence.score < config.minConfluence) {
    rejections.push('low_confluence');
    notes.push(
      `Confluence de ${context.confluence.score.toFixed(1)}/10, sous le seuil de ${config.minConfluence} retenu pour un profil ${context.riskProfile}.`,
    );
  }
  if (direction !== 'none' && best.direction !== direction) {
    rejections.push('conflicting_structure');
    notes.push(
      "La configuration repérée va à l'encontre du faisceau d'indices dominant : les deux lectures se contredisent.",
    );
  }

  // Gate 2 — multi-timeframe agreement.
  if (context.multiTimeframe.alignment === 'conflicting') {
    rejections.push('conflicting_timeframes');
    notes.push(
      `Le contexte ${context.multiTimeframe.higher.timeframe} et l'exécution ${context.multiTimeframe.execution.timeframe} s'opposent.`,
    );
  }

  // Gate 3 — volatility must allow a sane stop.
  if (context.volatility.regime === 'high' && context.riskProfile !== 'agressif') {
    rejections.push('excessive_volatility');
    notes.push(context.volatility.description);
  }

  const zone = buildEntryZone(best, atrValue, config.entryAtrMultiple);
  const entry = zoneMid(zone);
  const stopLoss = buildStop(best, entry, atrValue, config.stopAtrMultiple);
  const stopDistance = Math.abs(entry - stopLoss);

  // Gate 4 — the stop must be wide enough to survive noise, tight enough to matter.
  if (stopDistance < atrValue * 0.5) {
    rejections.push('levels_too_close');
    notes.push(
      "L'entrée et le stop sont séparés par moins d'un demi-ATR : le bruit de marché suffirait à sortir la position.",
    );
  }
  if (stopDistance > atrValue * 4) {
    rejections.push('invalidation_too_wide');
    notes.push(
      "L'invalidation structurelle est à plus de quatre ATR : le risque à assumer est disproportionné.",
    );
  }

  const takeProfits = buildTakeProfits(best, context, entry, stopLoss, atrValue);
  const primary = takeProfits[1] ?? takeProfits[0];
  const riskReward = primary ? primary.r : 0;

  // Gate 5 — reward must pay for the risk.
  if (riskReward < config.minRiskReward) {
    rejections.push('insufficient_risk_reward');
    notes.push(
      `Rapport risque / rendement de ${riskReward.toFixed(1)} sur l'objectif principal, sous le minimum de ${config.minRiskReward}.`,
    );
  }

  if (rejections.length) {
    return {
      setup: null,
      rejections: [...new Set(rejections)],
      rejectionNotes: notes,
      consideredKind: best.kind,
    };
  }

  const setup: TradeSetup = {
    kind: best.kind,
    label: SETUP_LABEL[best.kind],
    direction: best.direction,
    entryZone: zone,
    stopLoss: roundTo(stopLoss, context.price),
    takeProfits,
    riskReward: Math.round(riskReward * 10) / 10,
    invalidation:
      best.direction === 'long'
        ? `Clôture sous ${roundTo(stopLoss, context.price)} : la structure haussière qui porte l'idée est cassée.`
        : `Clôture au-dessus de ${roundTo(stopLoss, context.price)} : la structure baissière qui porte l'idée est cassée.`,
    timeframe: context.timeframe,
    confluenceScore: context.confluence.score,
    reasons: best.reasons,
    noTradeConditions: buildNoTradeConditions(best, context),
  };

  return { setup, rejections: [], rejectionNotes: [], consideredKind: best.kind };
}

function collectCandidates(context: SetupContext, atrValue: number): Candidate[] {
  const candidates: Candidate[] = [];
  const { structure, regime, levels, patterns, liquidity, momentum, volume, price, indicators } =
    context;

  const bullishStructure = structure.state === 'bullish';
  const bearishStructure = structure.state === 'bearish';
  const trendingUp = regime === 'bullish' || regime === 'strong_bullish';
  const trendingDown = regime === 'bearish' || regime === 'strong_bearish';
  const lastSwingLow = protectiveSwing(context.swings, 'low', price, atrValue);
  const lastSwingHigh = protectiveSwing(context.swings, 'high', price, atrValue);

  // 1. Breakout + retest
  const retest = patterns.find((pattern) => pattern.kind === 'retest');
  const breakout = patterns.find((pattern) => pattern.kind === 'breakout');
  if (retest && breakout && retest.direction === breakout.direction) {
    const direction = retest.direction === 'bullish' ? 'long' : 'short';
    candidates.push({
      kind: 'breakout_retest',
      direction,
      entryAnchor: price,
      structuralStop: direction === 'long' ? lastSwingLow : lastSwingHigh,
      bonus: 2.4 + (volume.strength === 'strong' ? 0.6 : 0),
      reasons: [
        breakout.description,
        retest.description,
        volume.description,
        structure.description,
      ],
    });
  }

  // 2. Trend continuation on a pullback into the moving averages
  const ema20 = indicators.ema20;
  const ema50 = indicators.ema50;
  if (ema20 != null && ema50 != null) {
    const nearMeans =
      Math.abs(price - ema20) < atrValue * 1.2 || Math.abs(price - ema50) < atrValue * 1.2;
    if (trendingUp && bullishStructure && nearMeans && price > ema50) {
      candidates.push({
        kind: 'trend_continuation',
        direction: 'long',
        entryAnchor: Math.max(ema20, price - atrValue * 0.2),
        structuralStop: lastSwingLow,
        bonus: 2.5 + (momentum.bias === 'bullish' ? 0.5 : 0),
        reasons: [
          'Tendance haussière en place sur la structure comme sur les moyennes mobiles.',
          `Repli au contact de la moyenne mobile 20 (${ema20.toFixed(2)}) sans casser la moyenne 50.`,
          momentum.description,
        ],
      });
    }
    if (trendingDown && bearishStructure && nearMeans && price < ema50) {
      candidates.push({
        kind: 'trend_continuation',
        direction: 'short',
        entryAnchor: Math.min(ema20, price + atrValue * 0.2),
        structuralStop: lastSwingHigh,
        bonus: 2.5 + (momentum.bias === 'bearish' ? 0.5 : 0),
        reasons: [
          'Tendance baissière en place sur la structure comme sur les moyennes mobiles.',
          `Rebond au contact de la moyenne mobile 20 (${ema20.toFixed(2)}) sans reprendre la moyenne 50.`,
          momentum.description,
        ],
      });
    }
  }

  // 3. Rejection on a level
  const nearestSupport = nearest(levels, 'support', price);
  const nearestResistance = nearest(levels, 'resistance', price);
  const bullishRejection = patterns.find(
    (pattern) =>
      pattern.direction === 'bullish' &&
      (pattern.kind === 'pin_bar_bullish' || pattern.kind === 'bullish_engulfing'),
  );
  const bearishRejection = patterns.find(
    (pattern) =>
      pattern.direction === 'bearish' &&
      (pattern.kind === 'pin_bar_bearish' || pattern.kind === 'bearish_engulfing'),
  );

  if (
    nearestSupport &&
    bullishRejection &&
    Math.abs(price - nearestSupport.price) < atrValue * 1.5
  ) {
    candidates.push({
      kind: 'support_rejection',
      direction: 'long',
      entryAnchor: price,
      structuralStop: nearestSupport.zone.low,
      bonus: 2 + (nearestSupport.strength === 'strong' ? 1 : 0),
      reasons: [
        `Réaction sur le support ${nearestSupport.zone.low} – ${nearestSupport.zone.high} (${nearestSupport.reactions} réaction(s) historiques).`,
        bullishRejection.description,
      ],
    });
  }
  if (
    nearestResistance &&
    bearishRejection &&
    Math.abs(price - nearestResistance.price) < atrValue * 1.5
  ) {
    candidates.push({
      kind: 'resistance_rejection',
      direction: 'short',
      entryAnchor: price,
      structuralStop: nearestResistance.zone.high,
      bonus: 2 + (nearestResistance.strength === 'strong' ? 1 : 0),
      reasons: [
        `Réaction sur la résistance ${nearestResistance.zone.low} – ${nearestResistance.zone.high} (${nearestResistance.reactions} réaction(s) historiques).`,
        bearishRejection.description,
      ],
    });
  }

  // 4. Liquidity sweep
  const sweep = liquidity.find(
    (event) => event.kind === 'liquidity_sweep_high' || event.kind === 'liquidity_sweep_low',
  );
  if (sweep) {
    const direction = sweep.direction === 'bullish' ? 'long' : 'short';
    candidates.push({
      kind: 'liquidity_sweep',
      direction,
      entryAnchor: price,
      structuralStop: sweep.price,
      bonus: 2.2,
      reasons: [sweep.description, structure.description],
    });
  }

  // 5. Range breakout / mean reversion
  if (regime === 'range') {
    const window = context.candles.slice(-40);
    const high = Math.max(...window.map((candle) => candle.high));
    const low = Math.min(...window.map((candle) => candle.low));
    const lastCandle = context.candles[context.candles.length - 1];

    if (lastCandle && lastCandle.close > high - atrValue * 0.2 && volume.strength !== 'weak') {
      candidates.push({
        kind: 'range_breakout',
        direction: 'long',
        entryAnchor: price,
        structuralStop: low + (high - low) * 0.5,
        bonus: 1.8,
        reasons: [`Sortie par le haut du range ${low} – ${high}.`, volume.description],
      });
    }
    if (lastCandle && lastCandle.close < low + atrValue * 0.2 && volume.strength !== 'weak') {
      candidates.push({
        kind: 'range_breakout',
        direction: 'short',
        entryAnchor: price,
        structuralStop: high - (high - low) * 0.5,
        bonus: 1.8,
        reasons: [`Sortie par le bas du range ${low} – ${high}.`, volume.description],
      });
    }

    const rsiValue = momentum.rsi;
    if (rsiValue != null && rsiValue < 32 && price <= low + (high - low) * 0.25) {
      candidates.push({
        kind: 'mean_reversion',
        direction: 'long',
        entryAnchor: price,
        structuralStop: low,
        bonus: 1.4,
        reasons: [
          `Prix dans le quart bas du range ${low} – ${high} avec un RSI à ${rsiValue.toFixed(1)}.`,
          'En range, les extrêmes du range priment sur le signal RSI isolé.',
        ],
      });
    }
    if (rsiValue != null && rsiValue > 68 && price >= high - (high - low) * 0.25) {
      candidates.push({
        kind: 'mean_reversion',
        direction: 'short',
        entryAnchor: price,
        structuralStop: high,
        bonus: 1.4,
        reasons: [
          `Prix dans le quart haut du range ${low} – ${high} avec un RSI à ${rsiValue.toFixed(1)}.`,
          'En range, les extrêmes du range priment sur le signal RSI isolé.',
        ],
      });
    }
  }

  // 6. Momentum breakout
  const momentumCandle = context.patterns.find(
    (pattern) =>
      pattern.kind === 'momentum_candle_bullish' || pattern.kind === 'momentum_candle_bearish',
  );
  if (momentumCandle && volume.strength !== 'weak') {
    const direction = momentumCandle.direction === 'bullish' ? 'long' : 'short';
    const structuralStop = direction === 'long' ? lastSwingLow : lastSwingHigh;
    candidates.push({
      kind: 'momentum_breakout',
      direction,
      entryAnchor: price,
      structuralStop,
      bonus: 1.9,
      reasons: [momentumCandle.description, volume.description],
    });
  }

  return candidates;
}

function buildEntryZone(
  candidate: Candidate,
  atrValue: number,
  entryMultiple: number,
): { low: number; high: number } {
  const half = atrValue * entryMultiple;
  const anchor = candidate.entryAnchor;
  const low = anchor - half;
  const high = anchor + half;
  return { low: roundTo(low, anchor), high: roundTo(high, anchor) };
}

function buildStop(
  candidate: Candidate,
  entry: number,
  atrValue: number,
  stopMultiple: number,
): number {
  const buffer = atrValue * 0.35;
  const atrStop =
    candidate.direction === 'long'
      ? entry - atrValue * stopMultiple
      : entry + atrValue * stopMultiple;

  if (candidate.structuralStop == null) return atrStop;

  const structural =
    candidate.direction === 'long'
      ? candidate.structuralStop - buffer
      : candidate.structuralStop + buffer;

  // Keep whichever stop protects the structure without exceeding the ATR budget.
  if (candidate.direction === 'long') {
    return structural < entry ? Math.min(structural, atrStop) : atrStop;
  }
  return structural > entry ? Math.max(structural, atrStop) : atrStop;
}

function buildTakeProfits(
  candidate: Candidate,
  context: SetupContext,
  entry: number,
  stopLoss: number,
  atrValue: number,
): TakeProfit[] {
  const direction = candidate.direction;
  const risk = Math.abs(entry - stopLoss);
  if (risk <= 0) return [];

  // Prefer real levels ahead of price, fall back to R multiples.
  const ahead = context.levels
    .filter((level) =>
      direction === 'long' ? level.price > entry + risk * 0.6 : level.price < entry - risk * 0.6,
    )
    .sort((a, b) => (direction === 'long' ? a.price - b.price : b.price - a.price));

  const fallbackMultiples = [1.5, 2.5, 4];
  // Each objective needs a minimum reward and must sit beyond the previous one,
  // so the three targets always read as a ladder.
  const minimumR = [1, 1.8, 3];
  const labels: TakeProfit['label'][] = ['TP1', 'TP2', 'TP3'];
  let cursor = 0;
  let previousR = 0;

  return labels.map((label, index) => {
    const multiple = Math.max(fallbackMultiples[index] ?? 2, previousR + 0.7);
    const floor = Math.max(minimumR[index] ?? multiple, previousR + 0.5);
    let level = ahead[cursor];
    while (level && riskRewardRatio(entry, stopLoss, level.price, direction) < floor) {
      cursor += 1;
      level = ahead[cursor];
    }
    if (level) cursor += 1;

    const fallbackPrice = direction === 'long' ? entry + risk * multiple : entry - risk * multiple;
    const price = level ? level.price : fallbackPrice;
    const r = riskRewardRatio(entry, stopLoss, price, direction);
    previousR = r;

    return {
      label,
      price: roundTo(price, entry),
      r: Math.round(r * 10) / 10,
      rationale: level
        ? `${level.type === 'support' ? 'Support' : 'Résistance'} ${level.zone.low} – ${level.zone.high}, ${level.reactions} réaction(s).`
        : `Projection à ${multiple}R (${(atrValue * multiple).toFixed(2)} d'amplitude ATR).`,
    };
  });
}

function buildNoTradeConditions(candidate: Candidate, context: SetupContext): string[] {
  const conditions: string[] = [];
  if (candidate.kind === 'breakout_retest') {
    conditions.push(
      'Retour durable à l’intérieur de la zone cassée : la cassure devient un faux départ.',
    );
  }
  if (candidate.direction === 'long') {
    conditions.push('Perte du dernier creux ascendant avant l’entrée.');
  } else {
    conditions.push('Reprise du dernier sommet descendant avant l’entrée.');
  }
  if (context.volatility.regime === 'high') {
    conditions.push(
      'Nouvelle expansion de volatilité qui élargirait le stop au-delà du budget de risque.',
    );
  }
  conditions.push('Volume en repli sous sa moyenne pendant le mouvement attendu.');
  return conditions;
}

function nearest(levels: LevelZone[], type: LevelZone['type'], price: number): LevelZone | null {
  const sorted = levels
    .filter((level) => level.type === type)
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price));
  return sorted[0] ?? null;
}

/**
 * The swing a stop should sit behind: the closest low under the price for a
 * long, the closest high above it for a short. The chronologically last swing
 * can be far away, which would force an invalidation nobody would take.
 */
function protectiveSwing(
  swings: SwingPoint[],
  kind: 'high' | 'low',
  price: number,
  atrValue: number,
): number | null {
  const buffer = atrValue * 0.3;
  const candidates = swings
    .filter((swing) => swing.kind === kind)
    .slice(-20)
    .map((swing) => swing.price)
    .filter((value) => (kind === 'low' ? value < price - buffer : value > price + buffer));

  if (!candidates.length) return null;
  return kind === 'low' ? Math.max(...candidates) : Math.min(...candidates);
}

function roundTo(value: number, reference: number): number {
  const digits = Math.abs(reference) >= 1000 ? 1 : Math.abs(reference) >= 10 ? 2 : 5;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

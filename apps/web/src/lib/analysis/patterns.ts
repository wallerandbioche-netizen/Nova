import type { Candle } from '@/types/market';
import type { LevelZone, PatternMatch } from '@/types/analysis';

const body = (candle: Candle) => Math.abs(candle.close - candle.open);
const range = (candle: Candle) => Math.max(candle.high - candle.low, Number.EPSILON);
const upperWick = (candle: Candle) => candle.high - Math.max(candle.open, candle.close);
const lowerWick = (candle: Candle) => Math.min(candle.open, candle.close) - candle.low;
const isBull = (candle: Candle) => candle.close > candle.open;

/**
 * Price action reader. Only figures actually present in the last candles are
 * returned — nothing is inferred to fill a narrative.
 */
export function detectPatterns(
  candles: Candle[],
  levels: LevelZone[],
  atrValue: number | null,
): PatternMatch[] {
  if (candles.length < 20) return [];
  const matches: PatternMatch[] = [];
  const lookback = Math.min(8, candles.length - 2);
  const averageBody =
    candles.slice(-20).reduce((total, candle) => total + body(candle), 0) / 20 || Number.EPSILON;

  for (let offset = lookback; offset >= 0; offset -= 1) {
    const index = candles.length - 1 - offset;
    const candle = candles[index];
    const previous = candles[index - 1];
    if (!candle || !previous) continue;

    // Engulfing
    if (
      isBull(candle) &&
      !isBull(previous) &&
      candle.close > previous.open &&
      candle.open <= previous.close &&
      body(candle) > body(previous)
    ) {
      matches.push({
        kind: 'bullish_engulfing',
        label: 'Avalement haussier',
        index,
        time: candle.time,
        direction: 'bullish',
        strength: body(candle) > averageBody * 1.5 ? 'strong' : 'medium',
        description: "Le corps haussier englobe la bougie précédente : l'offre a été absorbée.",
      });
    }
    if (
      !isBull(candle) &&
      isBull(previous) &&
      candle.close < previous.open &&
      candle.open >= previous.close &&
      body(candle) > body(previous)
    ) {
      matches.push({
        kind: 'bearish_engulfing',
        label: 'Avalement baissier',
        index,
        time: candle.time,
        direction: 'bearish',
        strength: body(candle) > averageBody * 1.5 ? 'strong' : 'medium',
        description: 'Le corps baissier englobe la bougie précédente : la demande a été absorbée.',
      });
    }

    // Pin bars / rejections
    if (lowerWick(candle) > body(candle) * 2 && lowerWick(candle) > upperWick(candle) * 2) {
      matches.push({
        kind: 'pin_bar_bullish',
        label: 'Mèche de rejet basse',
        index,
        time: candle.time,
        direction: 'bullish',
        strength: lowerWick(candle) > range(candle) * 0.66 ? 'strong' : 'medium',
        description: 'Longue mèche basse : les vendeurs n’ont pas tenu les plus bas.',
      });
    }
    if (upperWick(candle) > body(candle) * 2 && upperWick(candle) > lowerWick(candle) * 2) {
      matches.push({
        kind: 'pin_bar_bearish',
        label: 'Mèche de rejet haute',
        index,
        time: candle.time,
        direction: 'bearish',
        strength: upperWick(candle) > range(candle) * 0.66 ? 'strong' : 'medium',
        description: 'Longue mèche haute : les acheteurs n’ont pas tenu les plus hauts.',
      });
    }

    // Momentum candles
    if (body(candle) > averageBody * 1.8 && body(candle) / range(candle) > 0.68) {
      matches.push({
        kind: isBull(candle) ? 'momentum_candle_bullish' : 'momentum_candle_bearish',
        label: isBull(candle) ? 'Bougie de momentum haussière' : 'Bougie de momentum baissière',
        index,
        time: candle.time,
        direction: isBull(candle) ? 'bullish' : 'bearish',
        strength: 'strong',
        description: 'Corps large et mèches réduites : impulsion directionnelle marquée.',
      });
    }
  }

  matches.push(...detectBreakoutSequence(candles, levels, atrValue));
  matches.push(...detectConsolidation(candles, atrValue));

  return dedupe(matches).slice(-6);
}

function detectBreakoutSequence(
  candles: Candle[],
  levels: LevelZone[],
  atrValue: number | null,
): PatternMatch[] {
  const last = candles[candles.length - 1];
  if (!last || !levels.length) return [];
  const tolerance = Math.max(atrValue ?? last.close * 0.003, last.close * 0.001);
  const matches: PatternMatch[] = [];
  const recent = candles.slice(-12);

  levels.forEach((level) => {
    const crossedUp = recent.some((candle) => candle.close > level.zone.high + tolerance * 0.2);
    const crossedDown = recent.some((candle) => candle.close < level.zone.low - tolerance * 0.2);
    const wasBelow = recent[0] ? recent[0].close < level.zone.low : false;
    const wasAbove = recent[0] ? recent[0].close > level.zone.high : false;

    if (wasBelow && crossedUp) {
      matches.push({
        kind: 'breakout',
        label: 'Cassure haussière',
        index: candles.length - 1,
        time: last.time,
        direction: 'bullish',
        strength: 'medium',
        description: `Clôture au-dessus de la zone ${level.zone.low} – ${level.zone.high}.`,
      });
      const retested = recent
        .slice(-5)
        .some(
          (candle) => candle.low <= level.zone.high + tolerance && candle.close > level.zone.high,
        );
      if (retested) {
        matches.push({
          kind: 'retest',
          label: 'Retest confirmé',
          index: candles.length - 1,
          time: last.time,
          direction: 'bullish',
          strength: 'strong',
          description: 'Le niveau cassé a été retesté par le bas et a tenu en clôture.',
        });
      }
    }

    if (wasAbove && crossedDown) {
      matches.push({
        kind: 'breakout',
        label: 'Cassure baissière',
        index: candles.length - 1,
        time: last.time,
        direction: 'bearish',
        strength: 'medium',
        description: `Clôture sous la zone ${level.zone.low} – ${level.zone.high}.`,
      });
      const retested = recent
        .slice(-5)
        .some(
          (candle) => candle.high >= level.zone.low - tolerance && candle.close < level.zone.low,
        );
      if (retested) {
        matches.push({
          kind: 'retest',
          label: 'Retest confirmé',
          index: candles.length - 1,
          time: last.time,
          direction: 'bearish',
          strength: 'strong',
          description: 'Le niveau cassé a été retesté par le haut et a rejeté en clôture.',
        });
      }
    }
  });

  return matches;
}

function detectConsolidation(candles: Candle[], atrValue: number | null): PatternMatch[] {
  const window = candles.slice(-10);
  const last = candles[candles.length - 1];
  if (window.length < 10 || !last || atrValue == null) return [];

  const high = Math.max(...window.map((candle) => candle.high));
  const low = Math.min(...window.map((candle) => candle.low));
  if (high - low < atrValue * 1.8) {
    return [
      {
        kind: 'consolidation',
        label: 'Consolidation',
        index: candles.length - 1,
        time: last.time,
        direction: 'neutral',
        strength: 'medium',
        description: `Compression sur ${window.length} bougies entre ${low} et ${high}.`,
      },
    ];
  }
  return [];
}

function dedupe(matches: PatternMatch[]): PatternMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.kind}:${match.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

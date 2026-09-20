import type { Candle, Timeframe } from '@/types/market';
import type { LevelZone, Strength, SwingPoint } from '@/types/analysis';

interface Cluster {
  prices: number[];
  reactions: number;
  volume: number;
  kind: 'high' | 'low';
}

/**
 * Support and resistance are reported as **zones**, built by clustering swing
 * points, extremes and round numbers that produced a visible reaction.
 */
export function detectLevels(
  candles: Candle[],
  swings: SwingPoint[],
  timeframe: Timeframe,
  atrValue: number | null,
): LevelZone[] {
  const lastCandle = candles[candles.length - 1];
  if (!lastCandle || candles.length < 30) return [];

  const price = lastCandle.close;
  // Tolerance: half an ATR, with a sane floor relative to price.
  const tolerance = Math.max(atrValue ?? price * 0.004, price * 0.0015) * 0.75;

  const clusters: Cluster[] = [];
  const addPoint = (value: number, kind: 'high' | 'low', volume: number) => {
    const existing = clusters.find(
      (cluster) => cluster.kind === kind && Math.abs(average(cluster.prices) - value) <= tolerance,
    );
    if (existing) {
      existing.prices.push(value);
      existing.reactions += 1;
      existing.volume += volume;
      return;
    }
    clusters.push({ prices: [value], reactions: 1, volume, kind });
  };

  swings.forEach((swing) => {
    const candle = candles[swing.index];
    addPoint(swing.price, swing.kind, candle?.volume ?? 0);
  });

  // Period extremes carry weight even without a fractal pivot.
  const window = candles.slice(-120);
  const periodHigh = Math.max(...window.map((candle) => candle.high));
  const periodLow = Math.min(...window.map((candle) => candle.low));
  addPoint(periodHigh, 'high', 0);
  addPoint(periodLow, 'low', 0);

  const levels: LevelZone[] = clusters
    .filter((cluster) => cluster.prices.length > 0)
    .map((cluster) => {
      const mid = average(cluster.prices);
      const low = Math.min(...cluster.prices) - tolerance * 0.35;
      const high = Math.max(...cluster.prices) + tolerance * 0.35;
      const type: LevelZone['type'] = mid >= price ? 'resistance' : 'support';
      return {
        price: round(mid, price),
        zone: { low: round(low, price), high: round(high, price) },
        type,
        strength: strengthFromReactions(cluster.reactions, isRoundNumber(mid, price)),
        timeframe,
        reactions: cluster.reactions,
        distancePercent: ((mid - price) / price) * 100,
      };
    });

  // Keep the most relevant levels around price: 3 above, 3 below.
  const resistances = levels
    .filter((level) => level.type === 'resistance')
    .sort((a, b) => a.distancePercent - b.distancePercent)
    .slice(0, 3);
  const supports = levels
    .filter((level) => level.type === 'support')
    .sort((a, b) => b.distancePercent - a.distancePercent)
    .slice(0, 3);

  return [...supports, ...resistances].sort((a, b) => b.price - a.price);
}

function strengthFromReactions(reactions: number, roundNumber: boolean): Strength {
  const score = reactions + (roundNumber ? 1 : 0);
  if (score >= 4) return 'strong';
  if (score >= 2) return 'medium';
  return 'weak';
}

/** A level sitting on a psychological round number gains weight. */
function isRoundNumber(value: number, reference: number): boolean {
  const magnitude = 10 ** Math.max(Math.floor(Math.log10(reference)) - 2, -4);
  const remainder = Math.abs(value % (magnitude * 10));
  return remainder < magnitude * 0.6 || remainder > magnitude * 9.4;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number, reference: number): number {
  const digits = reference >= 1000 ? 1 : reference >= 10 ? 2 : 5;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function nearestLevel(levels: LevelZone[], type: LevelZone['type']): LevelZone | null {
  const filtered = levels
    .filter((level) => level.type === type)
    .sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent));
  return filtered[0] ?? null;
}

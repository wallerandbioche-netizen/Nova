import type { Candle, Timeframe } from '@/types/market';
import { TIMEFRAME_MINUTES, getAssetSeed } from './assets';
import { gaussian, hashString, mulberry32 } from './random';

type SegmentKind = 'trend_up' | 'trend_down' | 'range' | 'expansion' | 'pullback';

interface Segment {
  kind: SegmentKind;
  length: number;
  drift: number;
  volatilityFactor: number;
}

const SEGMENT_PROFILE: Record<SegmentKind, { drift: number; volatility: number }> = {
  trend_up: { drift: 0.55, volatility: 0.9 },
  trend_down: { drift: -0.55, volatility: 1.0 },
  range: { drift: 0, volatility: 0.65 },
  expansion: { drift: 0.2, volatility: 1.6 },
  pullback: { drift: -0.25, volatility: 0.8 },
};

function buildSegments(random: () => number, total: number, macroDrift: number): Segment[] {
  const segments: Segment[] = [];
  let remaining = total;

  while (remaining > 0) {
    const roll = random();
    const bullishBias = 0.5 + macroDrift * 0.6;
    let kind: SegmentKind;
    if (roll < 0.22) kind = 'range';
    else if (roll < 0.34) kind = 'expansion';
    else if (roll < 0.48) kind = 'pullback';
    else kind = random() < bullishBias ? 'trend_up' : 'trend_down';

    const length = Math.min(remaining, Math.round(18 + random() * 46));
    const profile = SEGMENT_PROFILE[kind];
    segments.push({
      kind,
      length,
      drift: profile.drift * (0.6 + random() * 0.8),
      volatilityFactor: profile.volatility * (0.8 + random() * 0.5),
    });
    remaining -= length;
  }

  return segments;
}

export interface GenerateOptions {
  assetId: string;
  timeframe: Timeframe;
  count?: number;
  /** Anchor timestamp in milliseconds — bucketed to the timeframe. */
  asOf?: number;
  /** Extra seed entropy, used to produce alternative scenarios. */
  variant?: string;
}

/** Every series is cut from one canonical run so sub-series always agree. */
const CANONICAL_COUNT = 420;
const cache = new Map<string, Candle[]>();

/**
 * Deterministic OHLC generator. It is **simulated** data: every consumer must
 * surface that fact rather than presenting it as a live feed.
 *
 * Asking for fewer candles returns the tail of the same canonical series, so a
 * sparkline, a thumbnail and the analysis engine always see the same market.
 */
export function generateCandles({
  assetId,
  timeframe,
  count = 320,
  asOf = Date.UTC(2026, 8, 20, 12, 0, 0),
  variant = '',
}: GenerateOptions): Candle[] {
  const key = `${assetId}:${timeframe}:${variant}:${asOf}`;
  let canonical = cache.get(key);
  if (!canonical) {
    canonical = buildSeries({ assetId, timeframe, count: CANONICAL_COUNT, asOf, variant });
    cache.set(key, canonical);
  }
  return count >= canonical.length ? canonical : canonical.slice(canonical.length - count);
}

function buildSeries({
  assetId,
  timeframe,
  count,
  asOf,
  variant,
}: Required<GenerateOptions>): Candle[] {
  const seedConfig = getAssetSeed(assetId);
  const random = mulberry32(hashString(`${assetId}:${timeframe}:${variant}`));
  const minutes = TIMEFRAME_MINUTES[timeframe];
  const stepMs = minutes * 60_000;
  const lastTime = Math.floor(asOf / stepMs) * stepMs;

  // Per-bar volatility scaled from the daily figure (square-root of time).
  const perBarVol = seedConfig.dailyVolatility * Math.sqrt(minutes / 1_440);
  const segments = buildSegments(random, count, seedConfig.macroDrift);

  const closes: number[] = [];
  let price = 100;
  let segmentIndex = 0;
  let segmentCursor = 0;

  for (let index = 0; index < count; index += 1) {
    let segment = segments[segmentIndex];
    if (!segment) break;
    if (segmentCursor >= segment.length) {
      segmentIndex = Math.min(segmentIndex + 1, segments.length - 1);
      segmentCursor = 0;
      segment = segments[segmentIndex] ?? segment;
    }

    const shock = gaussian(random) * perBarVol * segment.volatilityFactor;
    const drift = segment.drift * perBarVol;
    // Range segments mean-revert towards their own anchor.
    const meanReversion =
      segment.kind === 'range' && closes.length > 4
        ? -0.25 * ((price - (closes[closes.length - 5] ?? price)) / price)
        : 0;

    price = price * (1 + drift + shock + meanReversion);
    closes.push(price);
    segmentCursor += 1;
  }

  // Rescale so the series ends on the reference price of the instrument.
  const lastClose = closes[closes.length - 1] ?? 100;
  const scale = seedConfig.reference / lastClose;

  const candles: Candle[] = [];
  for (let index = 0; index < closes.length; index += 1) {
    const close = (closes[index] ?? lastClose) * scale;
    const previousClose = index === 0 ? close : (closes[index - 1] ?? close) * scale;
    const open = previousClose * (1 + gaussian(random) * perBarVol * 0.08);
    const body = Math.abs(close - open);
    // Wicks stay small relative to the body so ATR reflects directional travel
    // rather than noise — an inflated ATR would blur every structural read.
    const wick = Math.max(
      body * (0.12 + random() * 0.45),
      close * perBarVol * (0.08 + random() * 0.3),
    );
    const high = Math.max(open, close) + wick * (0.25 + random() * 0.5);
    const low = Math.min(open, close) - wick * (0.25 + random() * 0.5);

    const range = Math.max(high - low, Number.EPSILON);
    const conviction = body / range;
    const volume = Math.round(
      seedConfig.baseVolume *
        (0.45 + conviction * 1.3 + random() * 0.75) *
        (1 + index / closes.length / 3),
    );

    candles.push({
      time: (lastTime - (closes.length - 1 - index) * stepMs) / 1000,
      open: round(open, seedConfig.precision),
      high: round(high, seedConfig.precision),
      low: round(low, seedConfig.precision),
      close: round(close, seedConfig.precision),
      volume,
    });
  }

  return candles;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

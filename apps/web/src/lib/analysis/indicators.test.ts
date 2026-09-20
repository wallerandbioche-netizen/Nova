import { describe, expect, it } from 'vitest';
import type { Candle } from '@/types/market';
import {
  atr,
  ema,
  computeIndicatorSeries,
  lastIndicatorSnapshot,
  macd,
  rsi,
  sma,
} from './indicators';

const candle = (close: number, high = close + 1, low = close - 1, open = close): Candle => ({
  time: 0,
  open,
  high,
  low,
  close,
  volume: 100,
});

describe('moving averages', () => {
  it('returns null until the period is filled', () => {
    const values = sma([1, 2, 3, 4], 3);
    expect(values.slice(0, 2)).toEqual([null, null]);
    expect(values[2]).toBe(2);
    expect(values[3]).toBe(3);
  });

  it('seeds the EMA with the simple average of the first window', () => {
    const values = ema([2, 4, 6, 8, 10], 3);
    expect(values[1]).toBeNull();
    expect(values[2]).toBe(4);
    // (8 - 4) * 0.5 + 4
    expect(values[3]).toBe(6);
  });

  it('returns only nulls when the series is shorter than the period', () => {
    expect(ema([1, 2], 5).every((value) => value === null)).toBe(true);
  });
});

describe('rsi', () => {
  it('reaches 100 when every change is positive', () => {
    const values = rsi(
      Array.from({ length: 30 }, (_value, index) => 100 + index),
      14,
    );
    expect(values[29]).toBe(100);
  });

  it('stays inside the 0–100 range on mixed data', () => {
    const series = Array.from({ length: 60 }, (_value, index) => 100 + Math.sin(index) * 5);
    for (const value of rsi(series, 14)) {
      if (value == null) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe('atr', () => {
  it('equals the constant true range of a regular series', () => {
    const candles = Array.from({ length: 40 }, (_value, index) => candle(100 + index));
    const values = atr(candles, 14);
    expect(values[39]).toBeCloseTo(2, 6);
  });
});

describe('macd', () => {
  it('produces a positive histogram on an accelerating uptrend', () => {
    const series = Array.from({ length: 120 }, (_value, index) => 100 + index ** 1.2);
    const points = macd(series);
    const last = points[points.length - 1];
    expect(last?.histogram).toBeGreaterThan(0);
  });
});

describe('snapshot', () => {
  it('reports null for indicators the history cannot support', () => {
    const candles = Array.from({ length: 80 }, (_value, index) => candle(100 + index));
    const snapshot = lastIndicatorSnapshot(candles, computeIndicatorSeries(candles));

    expect(snapshot.ema20).not.toBeNull();
    expect(snapshot.ema200).toBeNull();
    expect(snapshot.volume?.ratio).toBeGreaterThan(0);
  });
});

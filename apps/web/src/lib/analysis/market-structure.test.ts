import { describe, expect, it } from 'vitest';
import type { Candle } from '@/types/market';
import { analyseStructure, detectSwings, rangeBounds } from './market-structure';

/**
 * Builds candles from a close path. Wicks extend in the direction of travel so
 * a turning candle holds the extreme on its own — otherwise the candle that
 * opens on the peak would share the same high and no pivot could be confirmed.
 */
function series(path: number[]): Candle[] {
  return path.map((close, index) => {
    const open = index === 0 ? close : (path[index - 1] ?? close);
    const delta = Math.max(Math.abs(close - open), 0.05);
    const up = close >= open;
    return {
      time: index * 60,
      open,
      high: up ? close + delta * 0.5 : open + delta * 0.1,
      low: up ? open - delta * 0.1 : close - delta * 0.5,
      close,
      volume: 1_000,
    };
  });
}

/** Zig-zag helper: alternating legs of the given amplitudes. */
function zigzag(legs: number[], start = 100): number[] {
  const path: number[] = [start];
  let current = start;
  legs.forEach((leg) => {
    const steps = 6;
    for (let index = 0; index < steps; index += 1) {
      current += leg / steps;
      path.push(Number(current.toFixed(4)));
    }
  });
  return path;
}

describe('detectSwings', () => {
  it('finds alternating pivots on a zig-zag', () => {
    const swings = detectSwings(series(zigzag([10, -6, 12, -7, 14])), 3);
    expect(swings.length).toBeGreaterThanOrEqual(3);
    expect(new Set(swings.map((swing) => swing.kind)).size).toBe(2);
  });

  it('returns nothing on a series that is too short', () => {
    expect(detectSwings(series([100, 101, 102]), 3)).toEqual([]);
  });
});

describe('analyseStructure', () => {
  it('labels an ascending sequence as bullish', () => {
    const structure = analyseStructure(series(zigzag([12, -5, 14, -6, 16, -5, 18])));
    expect(structure.state).toBe('bullish');
    expect(structure.sequence.every((event) => event === 'HH' || event === 'HL')).toBe(true);
  });

  it('labels a descending sequence as bearish', () => {
    const structure = analyseStructure(series(zigzag([-12, 5, -14, 6, -16, 5, -18])));
    expect(structure.state).toBe('bearish');
    expect(structure.sequence.every((event) => event === 'LH' || event === 'LL')).toBe(true);
  });

  it('never invents a structure when the swings are not confirmed', () => {
    const structure = analyseStructure(series([100, 100.2, 100.1, 100.3, 100.2, 100.4]));
    expect(structure.state).toBe('range');
    expect(structure.events).toEqual([]);
    expect(structure.description).toContain('range');
  });

  it('reports a break of structure when a trend extends its own extreme', () => {
    const structure = analyseStructure(series(zigzag([12, -5, 14, -6, 16, -5, 18, -6, 20])));
    expect(
      structure.events.some((event) => event.type === 'BOS' && event.direction === 'bullish'),
    ).toBe(true);
  });
});

describe('rangeBounds', () => {
  it('returns the extremes of the trailing window', () => {
    const bounds = rangeBounds(series([100, 104, 98, 102]), 4);
    expect(bounds?.high).toBeGreaterThan(104);
    expect(bounds?.low).toBeLessThan(98);
  });

  it('returns null without candles', () => {
    expect(rangeBounds([], 10)).toBeNull();
  });
});

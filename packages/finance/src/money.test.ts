import { describe, expect, it } from 'vitest';
import {
  convert,
  describeChange,
  formatPercent,
  isValidAmount,
  percentChange,
  round,
  sum,
} from './money.js';

const RATES = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.05 };

describe('round', () => {
  it('rounds half away from zero symmetrically', () => {
    expect(round(2.345, 2)).toBe(2.35);
    expect(round(-2.345, 2)).toBe(-2.35);
  });

  it('corrects binary representation drift', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(0.615, 2)).toBe(0.62);
  });

  it('returns 0 for non-finite input instead of propagating NaN', () => {
    expect(round(Number.NaN)).toBe(0);
    expect(round(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('convert', () => {
  it('is a no-op for the same currency', () => {
    expect(convert(100, 'EUR', 'EUR', RATES)).toBe(100);
  });

  it('converts through the pivot currency', () => {
    expect(round(convert(100, 'USD', 'EUR', RATES) as number, 2)).toBe(92);
    expect(round(convert(92, 'EUR', 'USD', RATES) as number, 2)).toBe(100);
  });

  it('round-trips without drift beyond rounding', () => {
    const there = convert(1234.56, 'GBP', 'USD', RATES) as number;
    const back = convert(there, 'USD', 'GBP', RATES) as number;
    expect(round(back, 2)).toBe(1234.56);
  });

  it('returns null rather than assuming a 1:1 rate when the rate is missing', () => {
    expect(convert(100, 'JPY', 'EUR', RATES)).toBeNull();
    expect(convert(100, 'EUR', 'JPY', RATES)).toBeNull();
  });

  it('returns null for a non-finite amount', () => {
    expect(convert(Number.NaN, 'EUR', 'USD', RATES)).toBeNull();
  });
});

describe('percentChange', () => {
  it('computes a signed percentage', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(90, 100)).toBeCloseTo(-10);
  });

  it('uses the absolute base so a negative base keeps the direction intuitive', () => {
    expect(percentChange(-90, -100)).toBeCloseTo(10);
  });

  it('returns null when the base is zero', () => {
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe('describeChange', () => {
  it('describes direction in words, never by colour alone', () => {
    expect(describeChange(1.234)).toBe('en hausse de 1,23 %');
    expect(describeChange(-1.235)).toBe('en baisse de 1,24 %');
    expect(describeChange(0)).toBe('stable');
    expect(describeChange(null)).toBe('variation inconnue');
  });
});

describe('formatPercent', () => {
  it('always shows the sign for non-zero values', () => {
    expect(formatPercent(2.5)).toBe('+2,50 %');
    expect(formatPercent(-2.5)).toBe('-2,50 %');
  });

  it('renders an em dash when unknown', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('sum and isValidAmount', () => {
  it('ignores non-finite entries', () => {
    expect(sum([1, 2, Number.NaN, 3])).toBe(6);
  });

  it('validates amounts', () => {
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount('1')).toBe(false);
    expect(isValidAmount(Number.NaN)).toBe(false);
  });
});

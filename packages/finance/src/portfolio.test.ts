import { describe, expect, it } from 'vitest';
import {
  computePortfolio,
  computeThemeExposure,
  toPercentMap,
  valuePosition,
  type PricedPosition,
} from './portfolio.js';

const RATES = { EUR: 1, USD: 0.92, GBP: 1.17 };

function position(overrides: Partial<PricedPosition> = {}): PricedPosition {
  return {
    id: 'p1',
    assetId: 'a1',
    symbol: 'MC.PA',
    name: 'LVMH',
    assetType: 'stock',
    region: 'europe',
    sectorKey: 'consumer_discretionary',
    currency: 'EUR',
    quantity: 10,
    averagePrice: 600,
    lastPrice: 660,
    previousClose: 650,
    priceAsOf: '2026-09-16T17:35:00.000Z',
    isDemoPrice: true,
    ...overrides,
  };
}

describe('valuePosition', () => {
  it('values a position in the portfolio base currency', () => {
    const valuation = valuePosition(position(), 'EUR', RATES);
    expect(valuation.marketValue).toBe(6600);
    expect(valuation.costBasis).toBe(6000);
    expect(valuation.unrealizedGain).toBe(600);
    expect(valuation.unrealizedGainPercent).toBe(10);
  });

  it('converts a foreign-currency position', () => {
    const valuation = valuePosition(
      position({ currency: 'USD', quantity: 5, averagePrice: 100, lastPrice: 120 }),
      'EUR',
      RATES,
    );
    expect(valuation.costBasis).toBe(460); // 500 USD * 0.92
    expect(valuation.marketValue).toBe(552); // 600 USD * 0.92
  });

  it('marks a position without a price as unvalued instead of assuming zero', () => {
    const valuation = valuePosition(position({ lastPrice: null }), 'EUR', RATES);
    expect(valuation.isUnvalued).toBe(true);
    expect(valuation.marketValue).toBeNull();
    expect(valuation.unrealizedGain).toBeNull();
    expect(valuation.costBasis).toBe(6000);
  });

  it('marks a position as unvalued when the FX rate is unknown', () => {
    const valuation = valuePosition(position({ currency: 'JPY' }), 'EUR', RATES);
    expect(valuation.isUnvalued).toBe(true);
  });
});

describe('computePortfolio', () => {
  const positions = [
    position(),
    position({
      id: 'p2',
      assetId: 'a2',
      symbol: 'CW8.PA',
      name: 'Amundi MSCI World',
      assetType: 'etf',
      region: 'global',
      sectorKey: 'diversified',
      quantity: 20,
      averagePrice: 400,
      lastPrice: 420,
      previousClose: 418,
    }),
    position({
      id: 'p3',
      assetId: 'a3',
      symbol: 'AAPL',
      name: 'Apple',
      assetType: 'stock',
      region: 'north_america',
      sectorKey: 'technology',
      currency: 'USD',
      quantity: 10,
      averagePrice: 150,
      lastPrice: 200,
      previousClose: 205,
    }),
  ];

  const result = computePortfolio(positions, 'EUR', RATES);

  it('totals market value across currencies', () => {
    // 6600 + 8400 + (2000 USD * 0.92 = 1840)
    expect(result.totalValue).toBe(16840);
  });

  it('computes the unrealized gain against the cost basis', () => {
    // cost: 6000 + 8000 + (1500 USD * 0.92 = 1380) = 15380
    expect(result.totalCostBasis).toBe(15380);
    expect(result.totalUnrealizedGain).toBe(1460);
    expect(result.totalUnrealizedGainPercent).toBeCloseTo(9.49, 1);
  });

  it('computes a day change only when every valued position has a previous close', () => {
    expect(result.dayChange).not.toBeNull();
    const partial = computePortfolio(
      [positions[0] as PricedPosition, position({ id: 'p4', previousClose: null })],
      'EUR',
      RATES,
    );
    expect(partial.dayChange).toBeNull();
    expect(partial.dayChangePercent).toBeNull();
  });

  it('produces weights that sum to 100 %', () => {
    const total = result.valuations.reduce((acc, v) => acc + (v.weightPercent ?? 0), 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('breaks allocation down by asset type, region, sector and currency', () => {
    expect(result.breakdown.byAssetType.map((slice) => slice.key)).toEqual(
      expect.arrayContaining(['stock', 'etf']),
    );
    expect(result.breakdown.byRegion.map((slice) => slice.key)).toEqual(
      expect.arrayContaining(['europe', 'global', 'north_america']),
    );
    expect(result.breakdown.bySector.map((slice) => slice.key)).toEqual(
      expect.arrayContaining(['technology', 'consumer_discretionary', 'diversified']),
    );
    const currencies = result.breakdown.byCurrency.map((slice) => slice.key);
    expect(currencies).toEqual(expect.arrayContaining(['EUR', 'USD']));
    const percentTotal = result.breakdown.byAssetType.reduce((acc, s) => acc + s.percent, 0);
    expect(percentTotal).toBeCloseTo(100, 1);
  });

  it('measures concentration', () => {
    expect(result.breakdown.concentration.positionCount).toBe(3);
    expect(result.breakdown.concentration.topPositionLabel).toBe('Amundi MSCI World');
    expect(result.breakdown.concentration.topThreePercent).toBeCloseTo(100, 1);
    expect(result.breakdown.concentration.herfindahlIndex).toBeGreaterThan(0);
  });

  it('reports a single-line portfolio as maximally concentrated', () => {
    const single = computePortfolio([position()], 'EUR', RATES);
    expect(single.breakdown.concentration.topPositionPercent).toBe(100);
    expect(single.breakdown.concentration.herfindahlIndex).toBe(100);
  });

  it('handles an empty portfolio without dividing by zero', () => {
    const empty = computePortfolio([], 'EUR', RATES);
    expect(empty.totalValue).toBe(0);
    expect(empty.totalUnrealizedGainPercent).toBe(0);
    expect(empty.breakdown.concentration.positionCount).toBe(0);
    expect(empty.breakdown.byAssetType).toEqual([]);
    expect(empty.unvaluedPercent).toBe(0);
  });

  it('excludes unvalued positions from the gain percentage but reports them', () => {
    const mixed = computePortfolio(
      [position(), position({ id: 'p9', assetId: 'a9', lastPrice: null, averagePrice: 100, quantity: 10 })],
      'EUR',
      RATES,
    );
    expect(mixed.unvaluedCount).toBe(1);
    expect(mixed.unvaluedPercent).toBeGreaterThan(0);
    // The valued line alone gained 10 %, and the unvalued one must not dilute it.
    expect(mixed.totalUnrealizedGainPercent).toBe(10);
  });
});

describe('computeThemeExposure', () => {
  it('derives indirect theme exposure from sector weights', () => {
    const exposure = computeThemeExposure({ technology: 40, financials: 20 });
    expect(exposure.technology).toBeCloseTo(40, 1);
    expect(exposure.banks).toBeCloseTo(20, 1);
    // Rates touch both financials (0.9) and technology (0.55).
    expect(exposure.rates).toBeCloseTo(20 * 0.9 + 40 * 0.55, 1);
  });

  it('caps exposure at 100 %', () => {
    const exposure = computeThemeExposure({ technology: 100, communication: 100 });
    expect(exposure.technology).toBeLessThanOrEqual(100);
  });

  it('returns zeros for an empty portfolio', () => {
    const exposure = computeThemeExposure({});
    expect(Object.values(exposure).every((value) => value === 0)).toBe(true);
  });
});

describe('toPercentMap', () => {
  it('flattens allocation slices into a lookup map', () => {
    expect(
      toPercentMap([
        { key: 'technology', label: 'Technologie', value: 100, percent: 21 },
        { key: 'energy', label: 'Énergie', value: 50, percent: 10.5 },
      ]),
    ).toEqual({ technology: 21, energy: 10.5 });
  });
});

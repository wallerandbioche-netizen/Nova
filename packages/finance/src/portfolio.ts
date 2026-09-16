import type {
  AllocationSlice,
  AssetType,
  ConcentrationMetrics,
  CurrencyCode,
  MarketThemeKey,
  Region,
} from '@nova/types';
import {
  ASSET_TYPE_LABELS,
  REGION_LABELS,
  SECTOR_LABELS,
  THEME_SECTOR_SENSITIVITY,
  THEME_LABELS,
} from '@nova/config';
import { convert, isValidAmount, percentChange, round, sum, type FxRateTable } from './money.js';

/** A position with everything needed to value it. Deliberately decoupled from Prisma models. */
export interface PricedPosition {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  region: Region;
  sectorKey: string | null;
  /** Currency the position is denominated in. */
  currency: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number | null;
  previousClose: number | null;
  priceAsOf: string | null;
  isDemoPrice: boolean;
}

export interface PositionValuation {
  positionId: string;
  assetId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  region: Region;
  sectorKey: string | null;
  quantity: number;
  /** Values below are expressed in the portfolio base currency. */
  marketValue: number | null;
  costBasis: number;
  unrealizedGain: number | null;
  unrealizedGainPercent: number | null;
  previousValue: number | null;
  weightPercent: number | null;
  currency: string;
  lastPrice: number | null;
  priceAsOf: string | null;
  isDemoPrice: boolean;
  /** True when no price (or no FX rate) was available: the position is excluded from totals. */
  isUnvalued: boolean;
}

export interface PortfolioTotals {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercent: number;
  dayChange: number | null;
  dayChangePercent: number | null;
  unvaluedPercent: number;
  unvaluedCount: number;
}

export interface PortfolioBreakdown {
  byAssetType: AllocationSlice<AssetType>[];
  byRegion: AllocationSlice<Region>[];
  bySector: AllocationSlice[];
  byCurrency: AllocationSlice<CurrencyCode>[];
  concentration: ConcentrationMetrics;
}

export interface PortfolioComputation extends PortfolioTotals {
  valuations: PositionValuation[];
  breakdown: PortfolioBreakdown;
}

/** Values a single position in the portfolio base currency. */
export function valuePosition(
  position: PricedPosition,
  baseCurrency: string,
  rates: FxRateTable,
): PositionValuation {
  const costBasisNative = position.quantity * position.averagePrice;
  const costBasis = convert(costBasisNative, position.currency, baseCurrency, rates) ?? 0;

  const marketValueNative = isValidAmount(position.lastPrice)
    ? position.quantity * position.lastPrice
    : null;
  const marketValue =
    marketValueNative === null
      ? null
      : convert(marketValueNative, position.currency, baseCurrency, rates);

  const previousValueNative = isValidAmount(position.previousClose)
    ? position.quantity * position.previousClose
    : null;
  const previousValue =
    previousValueNative === null
      ? null
      : convert(previousValueNative, position.currency, baseCurrency, rates);

  const unrealizedGain = marketValue === null ? null : round(marketValue - costBasis, 2);
  const unrealizedGainPercent =
    marketValue === null || costBasis === 0 ? null : percentChange(marketValue, costBasis);

  return {
    positionId: position.id,
    assetId: position.assetId,
    symbol: position.symbol,
    name: position.name,
    assetType: position.assetType,
    region: position.region,
    sectorKey: position.sectorKey,
    quantity: position.quantity,
    marketValue: marketValue === null ? null : round(marketValue, 2),
    costBasis: round(costBasis, 2),
    unrealizedGain,
    unrealizedGainPercent: unrealizedGainPercent === null ? null : round(unrealizedGainPercent, 2),
    previousValue: previousValue === null ? null : round(previousValue, 2),
    weightPercent: null,
    currency: position.currency,
    lastPrice: position.lastPrice,
    priceAsOf: position.priceAsOf,
    isDemoPrice: position.isDemoPrice,
    isUnvalued: marketValue === null,
  };
}

function buildAllocation<K extends string>(
  valuations: PositionValuation[],
  totalValue: number,
  keyOf: (valuation: PositionValuation) => K,
  labelOf: (key: K) => string,
): AllocationSlice<K>[] {
  const buckets = new Map<K, number>();
  for (const valuation of valuations) {
    if (valuation.marketValue === null) continue;
    const key = keyOf(valuation);
    buckets.set(key, (buckets.get(key) ?? 0) + valuation.marketValue);
  }
  return [...buckets.entries()]
    .map(([key, value]) => ({
      key,
      label: labelOf(key),
      value: round(value, 2),
      percent: totalValue > 0 ? round((value / totalValue) * 100, 2) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function computeConcentration(
  valuations: PositionValuation[],
  totalValue: number,
): ConcentrationMetrics {
  const valued = valuations.filter((valuation) => valuation.marketValue !== null);
  const weights = valued
    .map((valuation) => ({
      label: valuation.name,
      weight: totalValue > 0 ? ((valuation.marketValue as number) / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  const top = weights[0];
  const topThree = sum(weights.slice(0, 3).map((entry) => entry.weight));
  // Herfindahl-Hirschman index on percentage weights: 10 000 for a single line, lower when
  // diversified. Normalised to 0-100 so it can be displayed as a readable concentration level.
  const hhi = sum(weights.map((entry) => entry.weight ** 2));

  return {
    topPositionPercent: round(top?.weight ?? 0, 2),
    topPositionLabel: top?.label ?? null,
    topThreePercent: round(topThree, 2),
    herfindahlIndex: round(hhi / 100, 2),
    positionCount: valued.length,
  };
}

/**
 * Full portfolio computation: valuation, totals, allocations and concentration.
 * Pure function — no I/O, no clock, no randomness — so it is fully unit-testable.
 */
export function computePortfolio(
  positions: PricedPosition[],
  baseCurrency: string,
  rates: FxRateTable,
): PortfolioComputation {
  const valuations = positions.map((position) => valuePosition(position, baseCurrency, rates));

  const totalValue = round(
    sum(valuations.map((valuation) => valuation.marketValue ?? 0)),
    2,
  );
  const totalCostBasis = round(sum(valuations.map((valuation) => valuation.costBasis)), 2);

  // Only positions that could be valued contribute to the unrealized gain, otherwise the
  // percentage would compare a partial market value with a complete cost basis.
  const valuedCostBasis = round(
    sum(valuations.filter((v) => !v.isUnvalued).map((valuation) => valuation.costBasis)),
    2,
  );
  const totalUnrealizedGain = round(totalValue - valuedCostBasis, 2);
  const totalUnrealizedGainPercent =
    valuedCostBasis > 0 ? round((totalUnrealizedGain / valuedCostBasis) * 100, 2) : 0;

  const positionsWithPreviousValue = valuations.filter(
    (valuation) => valuation.previousValue !== null && valuation.marketValue !== null,
  );
  const hasCompletePreviousDay =
    positionsWithPreviousValue.length > 0 &&
    positionsWithPreviousValue.length === valuations.filter((v) => !v.isUnvalued).length;

  const previousTotal = hasCompletePreviousDay
    ? round(sum(positionsWithPreviousValue.map((valuation) => valuation.previousValue as number)), 2)
    : null;
  const dayChange = previousTotal === null ? null : round(totalValue - previousTotal, 2);
  const dayChangePercent =
    previousTotal === null ? null : round(percentChange(totalValue, previousTotal) ?? 0, 2);

  const withWeights = valuations.map((valuation) => ({
    ...valuation,
    weightPercent:
      valuation.marketValue === null || totalValue <= 0
        ? null
        : round((valuation.marketValue / totalValue) * 100, 2),
  }));

  const unvaluedCount = withWeights.filter((valuation) => valuation.isUnvalued).length;
  const unvaluedCostBasis = sum(
    withWeights.filter((valuation) => valuation.isUnvalued).map((valuation) => valuation.costBasis),
  );
  const unvaluedPercent =
    totalCostBasis > 0 ? round((unvaluedCostBasis / totalCostBasis) * 100, 2) : 0;

  return {
    valuations: withWeights,
    totalValue,
    totalCostBasis,
    totalUnrealizedGain,
    totalUnrealizedGainPercent,
    dayChange,
    dayChangePercent,
    unvaluedPercent,
    unvaluedCount,
    breakdown: {
      byAssetType: buildAllocation(
        withWeights,
        totalValue,
        (valuation) => valuation.assetType,
        (key) => ASSET_TYPE_LABELS[key] ?? key,
      ),
      byRegion: buildAllocation(
        withWeights,
        totalValue,
        (valuation) => valuation.region,
        (key) => REGION_LABELS[key] ?? key,
      ),
      bySector: buildAllocation(
        withWeights,
        totalValue,
        (valuation) => valuation.sectorKey ?? 'diversified',
        (key) => SECTOR_LABELS[key] ?? key,
      ),
      byCurrency: buildAllocation(
        withWeights,
        totalValue,
        (valuation) => valuation.currency as CurrencyCode,
        (key) => key,
      ),
      concentration: computeConcentration(withWeights, totalValue),
    },
  };
}

/** Converts allocation slices into a `{ key: percent }` map, used by the scoring engine. */
export function toPercentMap<K extends string>(slices: AllocationSlice<K>[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const slice of slices) {
    map[slice.key] = slice.percent;
  }
  return map;
}

/**
 * Indirect exposure to macro themes, derived from sector weights.
 *
 * This is explicitly an *analysis*, not a fact: a portfolio holding 30 % of industrials is
 * partially sensitive to energy prices, and NOVA says "peut être concerné", never "est affecté".
 */
export function computeThemeExposure(
  sectorPercentages: Record<string, number>,
): Record<MarketThemeKey, number> {
  const result = {} as Record<MarketThemeKey, number>;
  for (const [theme, sensitivities] of Object.entries(THEME_SECTOR_SENSITIVITY) as [
    MarketThemeKey,
    Record<string, number>,
  ][]) {
    let exposure = 0;
    for (const [sectorKey, sensitivity] of Object.entries(sensitivities)) {
      exposure += (sectorPercentages[sectorKey] ?? 0) * sensitivity;
    }
    result[theme] = round(Math.min(exposure, 100), 2);
  }
  return result;
}

export function describeThemeExposure(theme: MarketThemeKey, percent: number): string {
  const label = THEME_LABELS[theme] ?? theme;
  if (percent <= 0) return `Aucune exposition identifiée au thème « ${label} ».`;
  if (percent < 10) return `Exposition faible au thème « ${label} » (environ ${round(percent, 0)} %).`;
  if (percent < 30)
    return `Exposition modérée au thème « ${label} » (environ ${round(percent, 0)} %).`;
  return `Exposition significative au thème « ${label} » (environ ${round(percent, 0)} %).`;
}

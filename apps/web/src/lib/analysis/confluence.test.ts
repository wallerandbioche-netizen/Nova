import { describe, expect, it } from 'vitest';
import type {
  LevelZone,
  LiquidityEvent,
  MarketStructure,
  MomentumRead,
  MultiTimeframeRead,
  PatternMatch,
  VolatilityRead,
  VolumeRead,
} from '@/types/analysis';
import { computeConfluence, type ConfluenceInput } from './confluence';

const structure = (state: MarketStructure['state']): MarketStructure => ({
  state,
  swings: [],
  events: [],
  sequence: [],
  description: `structure ${state}`,
});

const momentum = (bias: MomentumRead['bias']): MomentumRead => ({
  bias,
  strength: 'strong',
  rsi: bias === 'bullish' ? 62 : 38,
  macdHistogram: bias === 'bullish' ? 1 : -1,
  description: 'momentum',
});

const volume: VolumeRead = {
  bias: 'bullish',
  strength: 'medium',
  ratio: 1.3,
  description: 'volume',
};
const volatility: VolatilityRead = {
  regime: 'normal',
  atr: 1,
  atrPercent: 1,
  description: 'volatilité',
};

const mtf = (
  bias: 'bullish' | 'bearish' | 'neutral',
  alignment: MultiTimeframeRead['alignment'],
): MultiTimeframeRead => ({
  higher: { timeframe: '1D', bias, regime: 'bullish', note: '' },
  intermediate: { timeframe: '4H', bias, regime: 'bullish', note: '' },
  execution: { timeframe: '1H', bias, regime: 'bullish', note: '' },
  alignment,
  description: 'alignement',
});

const levels: LevelZone[] = [
  {
    price: 95,
    zone: { low: 94, high: 96 },
    type: 'support',
    strength: 'strong',
    timeframe: '1H',
    reactions: 3,
    distancePercent: -5,
  },
];

const patterns: PatternMatch[] = [
  {
    kind: 'bullish_engulfing',
    label: 'Avalement haussier',
    index: 10,
    time: 0,
    direction: 'bullish',
    strength: 'strong',
    description: 'figure',
  },
];

const liquidity: LiquidityEvent[] = [
  {
    kind: 'liquidity_sweep_low',
    price: 94,
    time: 0,
    direction: 'bullish',
    description: 'balayage',
    confidence: 'strong',
  },
];

function input(overrides: Partial<ConfluenceInput> = {}): ConfluenceInput {
  return {
    structure: structure('bullish'),
    regime: 'strong_bullish',
    levels,
    momentum: momentum('bullish'),
    volume,
    volatility,
    patterns,
    liquidity,
    multiTimeframe: mtf('bullish', 'strong'),
    price: 100,
    ...overrides,
  };
}

describe('computeConfluence', () => {
  it('scores an aligned bullish picture high and points long', () => {
    const result = computeConfluence(input());
    expect(result.direction).toBe('long');
    expect(result.score).toBeGreaterThan(7);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.conflicts).toHaveLength(0);
  });

  it('keeps the score inside 0–10 whatever the inputs', () => {
    const result = computeConfluence(
      input({
        structure: structure('bearish'),
        regime: 'strong_bearish',
        momentum: momentum('bearish'),
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('collapses the score when the factors disagree', () => {
    const aligned = computeConfluence(input());
    const mixed = computeConfluence(
      input({
        structure: structure('bearish'),
        regime: 'bearish',
        momentum: momentum('bearish'),
        multiTimeframe: mtf('bullish', 'partial'),
      }),
    );
    expect(mixed.score).toBeLessThan(aligned.score);
    expect(mixed.conflicts.length).toBeGreaterThan(0);
  });

  it('never lets volatility choose a side', () => {
    const result = computeConfluence(input());
    const factor = result.factors.find((item) => item.key === 'volatility');
    expect(factor?.direction).toBe('none');
    expect(factor?.weight).toBe(0);
  });

  it('returns no direction when nothing stands out', () => {
    const result = computeConfluence(
      input({
        structure: structure('range'),
        regime: 'range',
        momentum: { bias: 'neutral', strength: 'weak', rsi: 50, macdHistogram: 0, description: '' },
        volume: { bias: 'neutral', strength: 'weak', ratio: 0.7, description: '' },
        patterns: [],
        liquidity: [],
        levels: [],
        multiTimeframe: mtf('neutral', 'partial'),
      }),
    );
    expect(result.direction).toBe('none');
    expect(result.score).toBeLessThan(2);
  });
});

import { describe, expect, it } from 'vitest';
import { modelAnalysisSchema, reasoningSchema, visionExtractionSchema } from './schema';

const validNarrative = {
  marketContext: 'Le marché évolue au-dessus de ses moyennes mobiles.',
  structure: 'Sommets et creux ascendants confirmés.',
  keyLevels: 'Support 100 – 102, résistance 118 – 120.',
  momentum: 'RSI à 58, histogramme MACD positif.',
  volume: 'Volume à 130 % de sa moyenne 20.',
  setup: 'Cassure puis retest validé.',
  entry: 'Zone 104 – 106.',
  riskManagement: 'Stop à 99, objectifs 112 et 120.',
  invalidation: 'Clôture sous 99.',
};

describe('reasoningSchema', () => {
  it('accepts a complete commentary', () => {
    const result = reasoningSchema.safeParse({
      headline: 'Achat — cassure et retest sur BTC/USDT en 1H',
      narrative: validNarrative,
      reasons: ['Structure haussière', 'Retest tenu'],
      warnings: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an output missing a narrative section', () => {
    const { momentum: _momentum, ...partial } = validNarrative;
    const result = reasoningSchema.safeParse({
      headline: 'Achat — cassure et retest',
      narrative: partial,
      reasons: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty headline', () => {
    const result = reasoningSchema.safeParse({
      headline: 'court',
      narrative: validNarrative,
      reasons: [],
    });
    expect(result.success).toBe(false);
  });

  it('caps the number of reasons so the model cannot pad the answer', () => {
    const result = reasoningSchema.safeParse({
      headline: 'Achat — cassure et retest sur BTC/USDT',
      narrative: validNarrative,
      reasons: Array.from({ length: 12 }, (_value, index) => `raison ${index}`),
      warnings: [],
    });
    expect(result.success).toBe(false);
  });

  it('defaults warnings to an empty list', () => {
    const result = reasoningSchema.parse({
      headline: 'Aucun trade sur EUR/USD en 1H — confluence insuffisante',
      narrative: validNarrative,
      reasons: [],
    });
    expect(result.warnings).toEqual([]);
  });
});

describe('modelAnalysisSchema', () => {
  const base = {
    marketBias: 'bullish',
    marketRegime: 'trending',
    direction: 'long',
    setup: 'breakout_retest',
    confluenceScore: 8,
    entryZone: { low: 105_200, high: 105_450 },
    stopLoss: 104_700,
    takeProfits: [106_500, 108_000],
    riskReward: 2.8,
    invalidation: 'Perte du support',
    reasons: ['Contexte haussier'],
    noTradeConditions: ['Cassure ratée'],
  };

  it('accepts a well formed analysis', () => {
    expect(modelAnalysisSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a confluence score outside its scale', () => {
    expect(modelAnalysisSchema.safeParse({ ...base, confluenceScore: 92 }).success).toBe(false);
  });

  it('rejects an unknown direction', () => {
    expect(modelAnalysisSchema.safeParse({ ...base, direction: 'maybe' }).success).toBe(false);
  });

  it('accepts a no-trade answer with empty levels', () => {
    const result = modelAnalysisSchema.safeParse({
      ...base,
      direction: 'none',
      setup: null,
      entryZone: null,
      stopLoss: null,
      takeProfits: [],
      riskReward: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('visionExtractionSchema', () => {
  it('accepts an explicit refusal to read the image', () => {
    const result = visionExtractionSchema.parse({
      readable: false,
      symbol: null,
      timeframe: null,
      missing: ['Échelle de prix illisible'],
    });
    expect(result.candles).toEqual([]);
    expect(result.readable).toBe(false);
  });

  it('rejects a negative volume', () => {
    const result = visionExtractionSchema.safeParse({
      readable: true,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      candles: [{ open: 1, high: 2, low: 0.5, close: 1.5, volume: -4 }],
    });
    expect(result.success).toBe(false);
  });
});

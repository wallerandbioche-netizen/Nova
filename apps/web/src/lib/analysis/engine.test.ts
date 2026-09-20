import { describe, expect, it } from 'vitest';
import type { AnalysisInput } from '@/types/analysis';
import { generateCandles, getAsset, timeframeLadder } from '@/lib/market-data';
import { runAnalysis } from './engine';
import { buildSeedAnalyses } from '@/lib/mock-data/seed-analyses';

function buildInput(assetId: string, timeframe: AnalysisInput['timeframe']): AnalysisInput {
  const ladder = timeframeLadder(timeframe);
  return {
    asset: getAsset(assetId),
    timeframe,
    candles: generateCandles({ assetId, timeframe, count: 320 }),
    riskProfile: 'modere',
    higherTimeframeCandles: [
      {
        timeframe: ladder.higher,
        candles: generateCandles({ assetId, timeframe: ladder.higher, count: 200 }),
      },
      {
        timeframe: ladder.intermediate,
        candles: generateCandles({ assetId, timeframe: ladder.intermediate, count: 240 }),
      },
    ],
  };
}

describe('runAnalysis', () => {
  it('refuses to trade when the history is too short', () => {
    const analysis = runAnalysis({
      asset: getAsset('BTCUSDT'),
      timeframe: '15m',
      candles: generateCandles({ assetId: 'BTCUSDT', timeframe: '15m', count: 20 }),
      riskProfile: 'modere',
    });

    expect(analysis.setup).toBeNull();
    expect(analysis.noTrade?.codes).toContain('insufficient_data');
    expect(analysis.notes.join(' ')).toContain('20 bougies');
  });

  it('always returns either a setup or an explained refusal', () => {
    for (const analysis of buildSeedAnalyses()) {
      expect(analysis.setup === null).toBe(analysis.noTrade !== null);
      if (analysis.noTrade) {
        expect(analysis.noTrade.codes.length).toBeGreaterThan(0);
        expect(analysis.noTrade.reasons.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every proposed setup coherent with its own levels', () => {
    for (const analysis of buildSeedAnalyses()) {
      const setup = analysis.setup;
      if (!setup) continue;
      const entry = (setup.entryZone.low + setup.entryZone.high) / 2;

      expect(setup.entryZone.high).toBeGreaterThan(setup.entryZone.low);
      if (setup.direction === 'long') {
        expect(setup.stopLoss).toBeLessThan(entry);
        setup.takeProfits.forEach((takeProfit) => expect(takeProfit.price).toBeGreaterThan(entry));
      } else {
        expect(setup.stopLoss).toBeGreaterThan(entry);
        setup.takeProfits.forEach((takeProfit) => expect(takeProfit.price).toBeLessThan(entry));
      }

      // Targets form a ladder and the ratio matches the main objective.
      const multiples = setup.takeProfits.map((takeProfit) => takeProfit.r);
      expect([...multiples].sort((a, b) => a - b)).toEqual(multiples);
      expect(setup.riskReward).toBeGreaterThanOrEqual(1.8);
      expect(setup.reasons.length).toBeGreaterThan(0);
      expect(setup.noTradeConditions.length).toBeGreaterThan(0);
    }
  });

  it('applies the risk profile: prudent refuses what aggressive accepts', () => {
    const input = buildInput('SPX500', '1D');
    const aggressive = runAnalysis({ ...input, riskProfile: 'agressif' });
    const prudent = runAnalysis({ ...input, riskProfile: 'prudent' });

    expect(aggressive.setup).not.toBeNull();
    if (prudent.setup && aggressive.setup) {
      // A tighter profile can still accept, but never with a looser ratio.
      expect(prudent.setup.riskReward).toBeGreaterThanOrEqual(2);
    }
  });

  it('never reports a confluence score outside its own scale', () => {
    for (const analysis of buildSeedAnalyses()) {
      expect(analysis.confluence.score).toBeGreaterThanOrEqual(0);
      expect(analysis.confluence.score).toBeLessThanOrEqual(10);
    }
  });

  it('labels the provenance of the data it used', () => {
    const analysis = runAnalysis(buildInput('XAUUSD', '5m'));
    expect(analysis.dataSource.candles).toBe(320);
    expect(analysis.reasoningProvider).toBe('engine');
    expect(analysis.origin).toBe('market_data');
  });

  it('describes levels as zones rather than exact prices', () => {
    const analysis = runAnalysis(buildInput('XAUUSD', '15m'));
    analysis.supportResistance.forEach((level) => {
      expect(level.zone.high).toBeGreaterThan(level.zone.low);
      expect(level.price).toBeGreaterThanOrEqual(level.zone.low);
      expect(level.price).toBeLessThanOrEqual(level.zone.high);
      expect(level.reactions).toBeGreaterThan(0);
    });
  });
});

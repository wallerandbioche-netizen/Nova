import { describe, expect, it } from 'vitest';
import { buildSeedAnalyses } from '@/lib/mock-data/seed-analyses';
import { isUsableAnalysis } from './guards';

const [sample] = buildSeedAnalyses();

describe('isUsableAnalysis', () => {
  it('accepts an analysis produced by the engine', () => {
    expect(isUsableAnalysis(sample)).toBe(true);
  });

  it('rejects anything that is not an object', () => {
    expect(isUsableAnalysis(null)).toBe(false);
    expect(isUsableAnalysis(undefined)).toBe(false);
    expect(isUsableAnalysis('an_1')).toBe(false);
    expect(isUsableAnalysis(42)).toBe(false);
  });

  it('rejects a truncated entry rather than letting it reach the interface', () => {
    expect(
      isUsableAnalysis({
        id: 'an_1',
        createdAt: '2026-09-20T10:00:00.000Z',
        asset: { symbol: 'XAU/USD' },
      }),
    ).toBe(false);
  });

  it('rejects an entry whose confluence block is missing its score', () => {
    const broken = { ...sample, confluence: { factors: [], direction: 'none' } };
    expect(isUsableAnalysis(broken)).toBe(false);
  });

  it('rejects an entry whose asset lost its identifier', () => {
    const broken = { ...sample, asset: { ...sample!.asset, id: undefined } };
    expect(isUsableAnalysis(broken)).toBe(false);
  });
});

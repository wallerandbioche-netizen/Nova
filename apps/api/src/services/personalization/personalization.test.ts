import { describe, expect, it, vi } from 'vitest';
import type { PortfolioExposure } from '@nova/types';
import { PersonalizationService, type ScoredNews } from './personalization.service.js';
import { ScoringService } from '../news/scoring.service.js';

const logger = { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() } as never;
const service = new PersonalizationService({} as never, {} as never, new ScoringService(), logger);

function exposure(overrides: Partial<PortfolioExposure> = {}): PortfolioExposure {
  return {
    portfolioId: 'p1',
    bySector: { technology: 40, energy: 18, diversified: 42 },
    byRegion: { north_america: 61, europe: 39 },
    byAssetType: { stock: 58, etf: 42 },
    byTheme: { technology: 40, energy: 18, rates: 22, inflation: 12 } as never,
    weightsBySymbol: { AAPL: 33, 'OBLI.PA': 7.75, 'CW8.PA': 38.8 },
    assetIds: ['a1', 'a2', 'a3'],
    symbols: ['AAPL', 'OBLI.PA', 'CW8.PA'],
    totalValue: 14113.51,
    baseCurrency: 'EUR',
    meta: { asOf: '2026-09-16T17:30:00.000Z', isDemo: true, provider: 'demo' },
    ...overrides,
  };
}

function news(overrides: Partial<ScoredNews> = {}): ScoredNews {
  return {
    id: 'n1',
    title: 'La BCE maintient ses taux',
    category: 'central_banks',
    importanceScore: 70,
    confidenceScore: 80,
    themeKeys: ['rates'],
    affectedSymbols: ['OBLI.PA'],
    affectedSectorKeys: ['financials'],
    assetNames: { 'OBLI.PA': 'Amundi Euro Government Bond UCITS ETF' },
    ...overrides,
  };
}

describe('relevance', () => {
  it('uses the exact weight of the held symbols, not an approximation', () => {
    const result = service.computeRelevance(news(), exposure());
    const direct = result.exposure.find((entry) => entry.kind === 'asset');
    expect(direct?.percent).toBeCloseTo(7.75, 2);
  });

  it('names the holding in the reason rather than printing a ticker', () => {
    const result = service.computeRelevance(news(), exposure());
    expect(result.reason).toBe('Vous détenez Amundi Euro Government Bond UCITS ETF');
  });

  it('falls back to the symbol when no name is known', () => {
    const result = service.computeRelevance(news({ assetNames: {} }), exposure());
    expect(result.reason).toBe('Vous détenez OBLI.PA');
  });

  it('returns no relevance for a user without a portfolio', () => {
    const result = service.computeRelevance(news(), null);
    expect(result).toEqual({ score: 0, reason: null, exposure: [], exposurePercent: null });
  });

  it('explains indirect exposure through a sector when nothing is held directly', () => {
    const result = service.computeRelevance(
      news({ affectedSymbols: [], affectedSectorKeys: ['technology'] }),
      exposure(),
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.reason).toMatch(/40 % de votre portefeuille en technologie/i);
  });

  it('lets a strongly held item outrank a moderately louder unrelated one', () => {
    // The user holds 38,8 % of the affected asset. Importance still dominates (0.6 vs 0.4),
    // so this expresses the intended trade-off rather than "relevance always wins".
    const ranked = service.rank(
      [
        news({
          id: 'loud',
          importanceScore: 80,
          affectedSymbols: [],
          affectedSectorKeys: [],
          themeKeys: [],
        }),
        news({ id: 'mine', importanceScore: 65, affectedSymbols: ['CW8.PA'] }),
      ],
      exposure(),
    );
    expect(ranked[0]?.id).toBe('mine');
  });

  it('keeps a far more important item on top despite a small holding', () => {
    // 7,75 % exposure does not outweigh a 35-point importance gap: NOVA surfaces what matters,
    // it does not only surface what you own.
    const ranked = service.rank(
      [
        news({
          id: 'major',
          importanceScore: 90,
          affectedSymbols: [],
          affectedSectorKeys: [],
          themeKeys: [],
        }),
        news({ id: 'small-holding', importanceScore: 55 }),
      ],
      exposure(),
    );
    expect(ranked[0]?.id).toBe('major');
  });
});

describe('portfolio insight', () => {
  it('inlines the reason without destroying the casing of a ticker', () => {
    const insight = service.buildPortfolioInsight(exposure(), [
      {
        id: 'n1',
        title: 'La BCE maintient ses taux',
        portfolioRelevanceScore: 60,
        relevanceReason: 'Vous détenez OBLI.PA',
      } as never,
    ]);

    expect(insight?.text).toContain('vous détenez OBLI.PA');
    expect(insight?.text).not.toContain('obli.pa');
  });

  it('describes the dominant exposure when nothing today is relevant', () => {
    const insight = service.buildPortfolioInsight(exposure(), []);
    expect(insight?.kind).toBe('analysis');
    expect(insight?.text).toMatch(/exposé au secteur/i);
  });

  it('returns nothing without a portfolio', () => {
    expect(service.buildPortfolioInsight(null, [])).toBeNull();
  });

  it('never states a certain effect', () => {
    const insight = service.buildPortfolioInsight(exposure(), [
      {
        id: 'n1',
        title: 'Titre',
        portfolioRelevanceScore: 80,
        relevanceReason: 'Vous détenez Apple',
      } as never,
    ]);
    expect(insight?.text).toMatch(/pas un effet certain/i);
  });
});

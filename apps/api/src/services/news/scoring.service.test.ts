import { describe, expect, it } from 'vitest';
import { ScoringService } from './scoring.service.js';

const service = new ScoringService();
const now = new Date('2026-09-16T08:00:00.000Z');

function input(overrides: Partial<Parameters<ScoringService['score']>[0]> = {}) {
  return {
    title: 'La BCE maintient ses taux directeurs',
    summary: 'La Banque centrale européenne laisse ses taux inchangés.',
    body: null,
    source: 'Reuters',
    category: 'central_banks' as const,
    publishedAt: new Date('2026-09-16T06:00:00.000Z'),
    affectedAssetCount: 2,
    affectedSectorCount: 1,
    now,
    ...overrides,
  };
}

describe('deduplication', () => {
  it('produces the same hash for the same story regardless of case and accents', () => {
    const a = service.contentHash('La BCE maintient ses taux', 'Reuters');
    const b = service.contentHash('la bce  maintient   ses  taux !', 'reuters');
    expect(a).toBe(b);
  });

  it('separates the same headline from different sources', () => {
    expect(service.contentHash('Titre identique', 'Reuters')).not.toBe(
      service.contentHash('Titre identique', 'Les Echos'),
    );
  });
});

describe('classification', () => {
  it('trusts the provider category when present', () => {
    expect(service.classify('Peu importe', '', 'regulation')).toBe('regulation');
  });

  it('classifies central bank news', () => {
    expect(service.classify('La BCE relève son taux directeur', '', null)).toBe('central_banks');
  });

  it('classifies commodities news', () => {
    expect(service.classify('Le pétrole Brent progresse', '', null)).toBe('commodities');
  });

  it('falls back to markets when nothing matches', () => {
    expect(service.classify('Séance calme sur les places', '', null)).toBe('markets');
  });
});

describe('theme extraction', () => {
  it('detects several themes in one item', () => {
    const themes = service.extractThemes(
      'La BCE évoque les taux alors que l’inflation ralentit',
      'Les rendements obligataires reculent.',
    );
    expect(themes).toEqual(expect.arrayContaining(['rates', 'inflation', 'bonds']));
  });

  it('is accent insensitive', () => {
    expect(service.extractThemes('Le petrole recule', '')).toContain('energy');
  });

  it('returns an empty list when no theme matches', () => {
    expect(service.extractThemes('Communiqué sans lien', 'Texte neutre.')).toEqual([]);
  });
});

describe('importance scoring', () => {
  it('is deterministic', () => {
    expect(service.score(input()).importanceScore).toBe(service.score(input()).importanceScore);
  });

  it('stays inside 0-100 for every category', () => {
    for (const category of ['macro', 'company', 'markets', 'central_banks'] as const) {
      const result = service.score(input({ category }));
      expect(result.importanceScore).toBeGreaterThanOrEqual(0);
      expect(result.importanceScore).toBeLessThanOrEqual(100);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
    }
  });

  it('ranks a central bank decision above a single company item', () => {
    const central = service.score(input({ category: 'central_banks' }));
    const company = service.score(
      input({ category: 'company', affectedAssetCount: 1, affectedSectorCount: 0 }),
    );
    expect(central.importanceScore).toBeGreaterThan(company.importanceScore);
  });

  it('decays with age', () => {
    const fresh = service.score(input());
    const old = service.score(input({ publishedAt: new Date('2026-09-13T06:00:00.000Z') }));
    expect(old.importanceScore).toBeLessThan(fresh.importanceScore);
  });

  it('gives more weight to a broader event', () => {
    const narrow = service.score(input({ affectedAssetCount: 0, affectedSectorCount: 0 }));
    const broad = service.score(input({ affectedAssetCount: 6, affectedSectorCount: 3 }));
    expect(broad.importanceScore).toBeGreaterThan(narrow.importanceScore);
  });

  it('reacts to an explicit magnitude in the text', () => {
    const small = service.score(input({ title: 'Le Brent progresse de 0,2 %' }));
    const large = service.score(input({ title: 'Le Brent progresse de 9 %' }));
    expect(large.importanceScore).toBeGreaterThan(small.importanceScore);
  });

  it('explains its reasoning', () => {
    expect(service.score(input()).rationale.length).toBeGreaterThan(0);
    expect(service.score(input()).scoringVersion).toBe(service.version);
  });
});

describe('confidence scoring', () => {
  it('trusts a primary source more than an unknown one', () => {
    const primary = service.score(input({ source: 'Banque centrale européenne' }));
    const unknown = service.score(input({ source: 'Blog anonyme' }));
    expect(primary.confidenceScore).toBeGreaterThan(unknown.confidenceScore);
  });

  it('lowers confidence on hedged or rumoured reporting', () => {
    const confirmed = service.score(input({ title: 'La BCE confirme sa décision' }));
    const rumoured = service.score(
      input({ title: 'La BCE pourrait envisager une baisse selon des sources' }),
    );
    expect(rumoured.confidenceScore).toBeLessThan(confirmed.confidenceScore);
  });
});

describe('portfolio relevance', () => {
  it('returns 0 without any exposure', () => {
    expect(
      service.scoreRelevance({
        directAssetPercent: 0,
        sectorPercent: 0,
        regionPercent: 0,
        themePercent: 0,
      }),
    ).toBe(0);
  });

  it('weighs a direct holding above indirect exposure', () => {
    const direct = service.scoreRelevance({
      directAssetPercent: 20,
      sectorPercent: 0,
      regionPercent: 0,
      themePercent: 0,
    });
    const indirect = service.scoreRelevance({
      directAssetPercent: 0,
      sectorPercent: 20,
      regionPercent: 0,
      themePercent: 0,
    });
    expect(direct).toBeGreaterThan(indirect);
  });

  it('never exceeds 100', () => {
    expect(
      service.scoreRelevance({
        directAssetPercent: 100,
        sectorPercent: 100,
        regionPercent: 100,
        themePercent: 100,
      }),
    ).toBe(100);
  });
});

describe('ranking', () => {
  it('lets a personally relevant item outrank a louder one', () => {
    const loudButIrrelevant = service.rankingScore(80, 0);
    const quieterButRelevant = service.rankingScore(60, 90);
    expect(quieterButRelevant).toBeGreaterThan(loudButIrrelevant);
  });

  it('keeps importance dominant at equal relevance', () => {
    expect(service.rankingScore(80, 50)).toBeGreaterThan(service.rankingScore(60, 50));
  });
});

describe('sectorsForThemes', () => {
  it('maps themes to the sectors they touch', () => {
    const sectors = service.sectorsForThemes(['rates', 'energy']);
    expect(sectors.financials).toBeGreaterThan(0);
    expect(sectors.energy).toBeGreaterThan(0);
  });

  it('keeps the strongest sensitivity when themes overlap', () => {
    const sectors = service.sectorsForThemes(['rates', 'banks']);
    expect(sectors.financials).toBe(1);
  });
});

describe('sector breadth', () => {
  it('keeps only strongly sensitive sectors, so "concerned sectors" stays meaningful', () => {
    // Several themes at once used to accumulate nearly every sector, which says nothing to a
    // reader and inflates the breadth component of the importance score.
    const sectors = service.sectorsForThemes([
      'rates',
      'inflation',
      'bonds',
      'banks',
      'currencies',
    ]);
    expect(Object.keys(sectors).length).toBeLessThanOrEqual(4);
    for (const weight of Object.values(sectors)) {
      expect(weight).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('keeps the most sensitive sectors first', () => {
    const sectors = service.sectorsForThemes(['rates']);
    const [first] = Object.entries(sectors);
    expect(first?.[0]).toBe('financials');
  });

  it('returns nothing for a theme list with no strong sensitivity', () => {
    expect(service.sectorsForThemes([])).toEqual({});
  });
});

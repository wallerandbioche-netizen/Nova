import type { MarketThemeKey, NewsCategory, TimeHorizon } from '@nova/types';

/**
 * Deterministic scoring configuration. Every weight is explicit and versioned so a score can
 * always be explained to a user — and so a change in ranking is a reviewable diff, not a
 * model whim.
 */
export const SCORING_VERSION = 'nova-scoring-v1';

/** Base importance per category, before modifiers. 0-100. */
export const CATEGORY_BASE_IMPORTANCE: Record<NewsCategory, number> = {
  central_banks: 72,
  macro: 66,
  geopolitics: 60,
  regulation: 52,
  markets: 50,
  commodities: 48,
  currencies: 46,
  sector: 44,
  company: 40,
};

/** Default reading horizon per category. */
export const CATEGORY_HORIZON: Record<NewsCategory, TimeHorizon> = {
  central_banks: 'medium_term',
  macro: 'medium_term',
  geopolitics: 'short_term',
  regulation: 'long_term',
  markets: 'short_term',
  commodities: 'short_term',
  currencies: 'medium_term',
  sector: 'medium_term',
  company: 'short_term',
};

/** Confidence granted to a source family. Used as the baseline confidence of an item. */
export const SOURCE_TIERS: Record<string, number> = {
  tier1: 88,
  tier2: 76,
  tier3: 62,
  unknown: 50,
};

export const SOURCE_TIER_BY_NAME: Record<string, keyof typeof SOURCE_TIERS> = {
  'banque centrale européenne': 'tier1',
  'federal reserve': 'tier1',
  insee: 'tier1',
  eurostat: 'tier1',
  reuters: 'tier1',
  bloomberg: 'tier1',
  'associated press': 'tier1',
  'les echos': 'tier2',
  'financial times': 'tier2',
  'wall street journal': 'tier2',
  'nova demo dataset': 'tier3',
};

export const IMPORTANCE_WEIGHTS = {
  /** Weight of the category baseline in the final importance score. */
  categoryBase: 0.5,
  /** Weight of how broad the event is (number of affected sectors/assets). */
  breadth: 0.2,
  /** Weight of freshness: a 3-day-old macro print matters less this morning. */
  freshness: 0.15,
  /** Weight of the magnitude signal extracted from the text (percentages, "record", …). */
  magnitude: 0.15,
} as const;

export const RELEVANCE_WEIGHTS = {
  /** Direct holding of an affected asset. */
  directAsset: 0.5,
  /** Exposure through the affected sectors. */
  sector: 0.25,
  /** Exposure through region. */
  region: 0.15,
  /** Exposure through a macro theme (rates, inflation…). */
  theme: 0.1,
} as const;

/** Keyword → theme mapping used by the classifier and the Market Radar. */
export const THEME_KEYWORDS: Record<MarketThemeKey, string[]> = {
  rates: ['taux', 'rate', 'bce', 'fed', 'banque centrale', 'monétaire', 'directeur', 'hike'],
  inflation: ['inflation', 'prix à la consommation', 'cpi', 'désinflation', 'ipc'],
  technology: [
    'tech',
    'technologie',
    'semi-conducteur',
    'intelligence artificielle',
    'logiciel',
    'nasdaq',
  ],
  energy: ['pétrole', 'brent', 'gaz', 'énergie', 'opep', 'baril', 'électricité'],
  banks: ['banque', 'bancaire', 'crédit', 'dépôt', 'bâle'],
  bonds: ['obligation', 'obligataire', 'oat', 'bund', 'treasury', 'rendement souverain', 'spread'],
  currencies: ['euro', 'dollar', 'devise', 'change', 'yen', 'eur/usd', 'parité'],
  commodities: ['matière première', 'or', 'cuivre', 'blé', 'métaux', 'once'],
  geopolitics: [
    'conflit',
    'sanction',
    'tension',
    'élection',
    'guerre',
    'droits de douane',
    'tarif',
  ],
};

/** Sectors most directly sensitive to each theme; used for indirect exposure. */
export const THEME_SECTOR_SENSITIVITY: Record<MarketThemeKey, Record<string, number>> = {
  rates: { financials: 0.9, real_estate: 0.85, utilities: 0.6, technology: 0.55 },
  inflation: { consumer_staples: 0.7, consumer_discretionary: 0.65, energy: 0.6, industrials: 0.5 },
  technology: { technology: 1, communication: 0.6 },
  energy: { energy: 1, industrials: 0.6, materials: 0.5, transport: 0.7 },
  banks: { financials: 1, real_estate: 0.5 },
  bonds: { financials: 0.8, utilities: 0.6, real_estate: 0.6 },
  currencies: { technology: 0.5, industrials: 0.55, consumer_discretionary: 0.5, materials: 0.5 },
  commodities: { materials: 1, energy: 0.8, industrials: 0.6 },
  geopolitics: { energy: 0.7, defense: 0.9, materials: 0.6, transport: 0.5 },
};

/** Minimum scores required for an item to reach the daily brief. */
export const BRIEF_THRESHOLDS = {
  minImportance: 35,
  minConfidence: 40,
  maxItemsFree: 3,
  maxItemsPremium: 5,
  /** A personally relevant item can enter the brief with a lower importance. */
  relevanceOverride: 55,
} as const;

import { createHash } from 'node:crypto';
import type { MarketThemeKey, NewsCategory, TimeHorizon } from '@nova/types';
import {
  CATEGORY_BASE_IMPORTANCE,
  CATEGORY_HORIZON,
  IMPORTANCE_WEIGHTS,
  RELEVANCE_WEIGHTS,
  SCORING_VERSION,
  SOURCE_TIERS,
  SOURCE_TIER_BY_NAME,
  THEME_KEYWORDS,
  THEME_SECTOR_SENSITIVITY,
} from '@nova/config';

/**
 * Deterministic news scoring.
 *
 * Nothing here calls a model: the same input always yields the same scores, and every score can
 * be explained to a user ("cet article est classé important parce que…"). The LLM only explains
 * what this engine has already decided (rule #59).
 *
 * A score is a *reading priority*, never a prediction of performance (rule #11).
 */
export interface ScoringInput {
  title: string;
  summary: string;
  body?: string | null;
  source: string;
  category: NewsCategory;
  publishedAt: Date;
  /** Number of distinct assets the item maps to. */
  affectedAssetCount: number;
  /** Number of distinct sectors the item maps to. */
  affectedSectorCount: number;
  /** Reference time used for freshness; injected so the function stays pure. */
  now: Date;
}

export interface ScoringResult {
  importanceScore: number;
  confidenceScore: number;
  horizon: TimeHorizon;
  themeKeys: MarketThemeKey[];
  /** Human-readable justification of the importance score, shown in the analysis screen. */
  rationale: string[];
  scoringVersion: string;
}

export interface RelevanceInput {
  /** Percentage of the portfolio held in the assets directly named by the item. */
  directAssetPercent: number;
  /** Percentage held in the sectors the item affects. */
  sectorPercent: number;
  /** Percentage held in the regions the item concerns. */
  regionPercent: number;
  /** Percentage exposed to the item's macro themes. */
  themePercent: number;
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(value)));

export class ScoringService {
  readonly version = SCORING_VERSION;

  /** Normalises a title for hashing: accents, case, punctuation and spacing are irrelevant. */
  normalizeTitle(title: string): string {
    return title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Deduplication key: same normalised title from the same source is the same story. */
  contentHash(title: string, source: string): string {
    return createHash('sha256')
      .update(`${this.normalizeTitle(title)}|${source.trim().toLowerCase()}`)
      .digest('hex');
  }

  /** Classifies an item when the provider gives no category, using keyword evidence. */
  classify(title: string, summary: string, providerCategory: NewsCategory | null): NewsCategory {
    if (providerCategory) return providerCategory;
    const text = `${title} ${summary}`.toLowerCase();

    const rules: [NewsCategory, RegExp][] = [
      ['central_banks', /banque centrale|bce|fed|taux directeur|politique monétaire/],
      ['macro', /inflation|prix à la consommation|ipc/],
      ['commodities', /pétrole|brent|baril|or |gaz|matière première/],
      ['currencies', /euro-dollar|eur\/usd|devise|parité|taux de change/],
      ['regulation', /règlement|réglementation|directive|autorité de marché|loi /],
      ['geopolitics', /droits de douane|sanction|conflit|tension géopolitique|élection/],
      ['sector', /secteur|filière|industrie du/],
      ['company', /résultats|chiffre d’affaires|bénéfice|publication trimestrielle/],
      ['macro', /croissance|pib|chômage|emploi|indice des prix/],
    ];

    for (const [category, pattern] of rules) {
      if (pattern.test(text)) return category;
    }
    return 'markets';
  }

  /** Extracts the macro themes an item touches, from a keyword dictionary. */
  extractThemes(title: string, summary: string, body?: string | null): MarketThemeKey[] {
    const text = `${title} ${summary} ${body ?? ''}`
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();

    const themes: MarketThemeKey[] = [];
    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS) as [
      MarketThemeKey,
      string[],
    ][]) {
      const matched = keywords.some((keyword) =>
        text.includes(keyword.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()),
      );
      if (matched) themes.push(theme);
    }
    return themes;
  }

  /** Confidence in the *information*, driven by source quality and hedging language. */
  private computeConfidence(input: ScoringInput): number {
    const sourceKey = input.source.trim().toLowerCase();
    const tier = SOURCE_TIER_BY_NAME[sourceKey] ?? 'unknown';
    let confidence = SOURCE_TIERS[tier] ?? SOURCE_TIERS.unknown ?? 50;

    const text = `${input.title} ${input.summary}`.toLowerCase();
    // Conditional reporting ("pourrait", "selon des sources") lowers confidence: NOVA must not
    // present a rumour with the same certainty as a published figure.
    if (/pourrait|serait|selon des sources|rumeur|envisag|projet de/.test(text)) confidence -= 15;
    if (/confirme|annonce officiellement|publie|communiqué/.test(text)) confidence += 5;

    return clamp(confidence);
  }

  /** Magnitude signal: explicit figures and superlatives indicate a more material event. */
  private computeMagnitude(input: ScoringInput): number {
    const text = `${input.title} ${input.summary}`.toLowerCase();
    let magnitude = 35;

    const percentMatch = text.match(/(\d+(?:[.,]\d+)?)\s?%/);
    if (percentMatch?.[1]) {
      const value = Number(percentMatch[1].replace(',', '.'));
      // 0 % → no bump, 10 % or more → full bump.
      magnitude += Math.min(value * 5, 50);
    }
    if (/record|historique|plus haut|plus bas|krach|effondrement/.test(text)) magnitude += 12;
    if (/légèrement|modér|stable|inchangé/.test(text)) magnitude -= 12;

    return clamp(magnitude);
  }

  /** Freshness decays over 48 h: a two-day-old item is no longer "this morning's news". */
  private computeFreshness(input: ScoringInput): number {
    const hours = (input.now.getTime() - input.publishedAt.getTime()) / 3_600_000;
    if (hours <= 0) return 100;
    if (hours >= 48) return 10;
    return clamp(100 - (hours / 48) * 90);
  }

  score(input: ScoringInput): ScoringResult {
    const categoryBase = CATEGORY_BASE_IMPORTANCE[input.category] ?? 45;
    const breadth = clamp(
      Math.min(input.affectedAssetCount * 12 + input.affectedSectorCount * 18, 100),
    );
    const freshness = this.computeFreshness(input);
    const magnitude = this.computeMagnitude(input);

    const importanceScore = clamp(
      categoryBase * IMPORTANCE_WEIGHTS.categoryBase +
        breadth * IMPORTANCE_WEIGHTS.breadth +
        freshness * IMPORTANCE_WEIGHTS.freshness +
        magnitude * IMPORTANCE_WEIGHTS.magnitude,
    );

    const rationale: string[] = [
      `Catégorie « ${input.category} » : poids de base ${categoryBase}/100.`,
      `Portée : ${input.affectedAssetCount} actif(s) et ${input.affectedSectorCount} secteur(s) identifiés.`,
      freshness > 60
        ? 'Information récente (moins de 24 heures).'
        : 'Information plus ancienne : son poids est réduit.',
    ];

    return {
      importanceScore,
      confidenceScore: this.computeConfidence(input),
      horizon: CATEGORY_HORIZON[input.category] ?? 'short_term',
      themeKeys: this.extractThemes(input.title, input.summary, input.body),
      rationale,
      scoringVersion: this.version,
    };
  }

  /**
   * Personal relevance: how much of *this* portfolio the event touches.
   *
   * Direct holdings weigh most, then sector, region and macro theme exposure. A user with no
   * portfolio simply gets 0 — the feed then ranks on importance alone.
   */
  scoreRelevance(input: RelevanceInput): number {
    const score =
      Math.min(input.directAssetPercent, 100) * RELEVANCE_WEIGHTS.directAsset * 2 +
      Math.min(input.sectorPercent, 100) * RELEVANCE_WEIGHTS.sector * 1.5 +
      Math.min(input.regionPercent, 100) * RELEVANCE_WEIGHTS.region * 1.2 +
      Math.min(input.themePercent, 100) * RELEVANCE_WEIGHTS.theme;
    return clamp(score);
  }

  /**
   * Sectors indirectly sensitive to a theme, used to explain indirect exposure.
   *
   * Only strongly sensitive sectors are kept, and the list is capped. An item that maps to ten
   * sectors tells the reader nothing — "les secteurs concernés sont : à peu près tous" is worse
   * than saying nothing, and it also inflates the breadth component of the importance score.
   */
  sectorsForThemes(
    themes: MarketThemeKey[],
    options: { minSensitivity?: number; max?: number } = {},
  ): Record<string, number> {
    const { minSensitivity = 0.7, max = 4 } = options;

    const sensitivity: Record<string, number> = {};
    for (const theme of themes) {
      for (const [sectorKey, weight] of Object.entries(THEME_SECTOR_SENSITIVITY[theme] ?? {})) {
        sensitivity[sectorKey] = Math.max(sensitivity[sectorKey] ?? 0, weight);
      }
    }

    return Object.fromEntries(
      Object.entries(sensitivity)
        .filter(([, weight]) => weight >= minSensitivity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max),
    );
  }

  /**
   * Final ranking key for a personalised feed.
   *
   * Importance dominates, but a strongly relevant item rises: NOVA's promise is "ce qui compte
   * pour vous", not "ce qui fait le plus de bruit" (product principle: contextualisation).
   */
  rankingScore(importanceScore: number, portfolioRelevanceScore: number): number {
    return Math.round(importanceScore * 0.6 + portfolioRelevanceScore * 0.4);
  }
}

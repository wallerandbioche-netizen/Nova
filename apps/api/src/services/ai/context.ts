import type {
  ContentDepth,
  ExperienceLevel,
  InvestmentHorizon,
  SourceReference,
} from '@nova/types';

/**
 * The structured context handed to the LLM.
 *
 * Only these fields ever leave the backend towards a model: no email, no name, no account id,
 * no absolute amounts. Exposure is expressed in percentages, and the portfolio value is given
 * as a coarse band rather than an exact figure (data minimisation, rules #15 and #47).
 */
export interface AiNewsContext {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string | null;
  publishedAt: string;
  category: string;
  importanceScore: number;
  confidenceScore: number;
  horizon: string;
  affectedAssets: { symbol: string; name: string }[];
  affectedSectors: string[];
  isDemo: boolean;
}

export interface AiPortfolioContext {
  /** Coarse band, e.g. "10 000 – 50 000 EUR". Never the exact amount. */
  valueBand: string;
  baseCurrency: string;
  positionCount: number;
  topSectors: { label: string; percent: number }[];
  topRegions: { label: string; percent: number }[];
  byAssetType: { label: string; percent: number }[];
  heldSymbols: string[];
  concentrationTopPercent: number;
  dayChangePercent: number | null;
  totalReturnPercent: number | null;
  themeExposure: { theme: string; percent: number }[];
  isDemoData: boolean;
  asOf: string;
}

export interface AiMarketContext {
  quotes: { label: string; changePercent: number | null; asOf: string }[];
  isDemo: boolean;
}

export interface AiInvestorContext {
  experienceLevel: ExperienceLevel;
  knowledgeLevel: ExperienceLevel;
  investmentHorizon: InvestmentHorizon;
  /** Present so the tone can adapt; never used to recommend an allocation. */
  riskTolerance: string;
  depth: ContentDepth;
}

export interface AiContext {
  intent: 'chat' | 'news' | 'portfolio';
  question: string | null;
  investor: AiInvestorContext | null;
  portfolio: AiPortfolioContext | null;
  news: AiNewsContext | null;
  market: AiMarketContext | null;
  /** Definitions retrieved from the human-written glossary, when the question matches one. */
  glossary: { term: string; definition: string } | null;
  sources: SourceReference[];
}

/** Buckets an exact amount so the model never receives a user's real portfolio value. */
export function valueBand(value: number, currency: string): string {
  const bands = [
    [0, 1_000],
    [1_000, 10_000],
    [10_000, 50_000],
    [50_000, 100_000],
    [100_000, 500_000],
  ] as const;
  for (const [min, max] of bands) {
    if (value < max) {
      return `${min.toLocaleString('fr-FR')} – ${max.toLocaleString('fr-FR')} ${currency}`;
    }
  }
  return `plus de 500 000 ${currency}`;
}

/** Serialises the context for the model: a single JSON block, clearly delimited. */
export function renderContext(context: AiContext): string {
  return `<contexte>\n${JSON.stringify(context, null, 2)}\n</contexte>`;
}

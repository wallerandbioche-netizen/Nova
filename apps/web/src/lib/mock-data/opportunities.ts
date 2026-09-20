import type { MarketAnalysis } from '@/types/analysis';
import { buildSeedAnalyses } from './seed-analyses';

export interface Opportunity {
  analysis: MarketAnalysis;
}

/**
 * The "opportunities" list is simply the subset of scanned instruments where
 * the engine actually found a setup — never a curated list of signals.
 */
export function buildOpportunities(asOf?: number): Opportunity[] {
  return buildSeedAnalyses(asOf)
    .filter((analysis) => analysis.setup !== null)
    .sort((a, b) => b.confluence.score - a.confluence.score)
    .map((analysis) => ({ analysis }));
}

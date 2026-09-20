import type { MarketAnalysis } from '@/types/analysis';

/**
 * Checks that a stored analysis carries everything the interface reads.
 *
 * Entries come from this browser's storage and from the account's journal, so
 * they can predate a schema change or arrive truncated. A partial entry is
 * skipped rather than allowed to break the page that renders it.
 */
export function isUsableAnalysis(value: unknown): value is MarketAnalysis {
  if (!value || typeof value !== 'object') return false;
  const analysis = value as Partial<MarketAnalysis>;

  return (
    typeof analysis.id === 'string' &&
    typeof analysis.createdAt === 'string' &&
    typeof analysis.timeframe === 'string' &&
    typeof analysis.lastPrice === 'number' &&
    typeof analysis.asset === 'object' &&
    analysis.asset !== null &&
    typeof analysis.asset.symbol === 'string' &&
    typeof analysis.asset.id === 'string' &&
    typeof analysis.confluence === 'object' &&
    analysis.confluence !== null &&
    typeof analysis.confluence.score === 'number' &&
    Array.isArray(analysis.confluence.factors) &&
    typeof analysis.marketStructure === 'object' &&
    analysis.marketStructure !== null &&
    Array.isArray(analysis.supportResistance) &&
    Array.isArray(analysis.patterns) &&
    typeof analysis.narrative === 'object' &&
    typeof analysis.dataSource === 'object' &&
    Array.isArray(analysis.notes)
  );
}

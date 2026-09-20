'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  appendAnalysis,
  readHistory,
  replaceHistory,
  subscribeHistory,
  type AnalysisStatus,
  type HistoryEntry,
} from '@/lib/storage/history';
import type { MarketAnalysis } from '@/types/analysis';
import { buildSeedAnalyses } from '@/lib/mock-data/seed-analyses';

const EMPTY: HistoryEntry[] = [];

/**
 * Journal entries. On first run the store is seeded with demo analyses
 * produced by the engine so the product is not empty — they stay labelled as
 * simulated.
 */
export function useHistory(): {
  entries: HistoryEntry[];
  ready: boolean;
  add(analysis: MarketAnalysis, status?: AnalysisStatus): void;
  reset(): void;
} {
  const entries = useSyncExternalStore(subscribeHistory, readHistory, () => EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (readHistory().length === 0) {
      const statuses: AnalysisStatus[] = [
        'en_cours',
        'confirme',
        'confirme',
        'en_cours',
        'invalide',
        'confirme',
        'invalide',
        'confirme',
      ];
      replaceHistory(
        buildSeedAnalyses().map((analysis, index) => ({
          analysis,
          status: statuses[index] ?? 'en_cours',
        })),
      );
    }
    setReady(true);
  }, []);

  const add = useCallback((analysis: MarketAnalysis, status: AnalysisStatus = 'en_cours') => {
    appendAnalysis(analysis, status);
  }, []);

  const reset = useCallback(() => {
    replaceHistory(
      buildSeedAnalyses().map((analysis) => ({ analysis, status: 'en_cours' as const })),
    );
  }, []);

  return { entries, ready, add, reset };
}

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
import { isUsableAnalysis } from '@/lib/storage/guards';
import { buildSeedAnalyses } from '@/lib/mock-data/seed-analyses';
import { useAccount } from './use-account';

const EMPTY: HistoryEntry[] = [];

interface RemoteEntry {
  id: string;
  status: AnalysisStatus;
  createdAt: string;
  analysis: MarketAnalysis;
}

/** Pushes one entry to the account, best effort: the journal is local first. */
async function pushEntry(entry: HistoryEntry): Promise<void> {
  try {
    await fetch('/api/analyses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entries: [
          {
            id: entry.analysis.id,
            status: entry.status,
            createdAt: entry.analysis.createdAt,
            analysis: entry.analysis,
          },
        ],
      }),
    });
  } catch {
    // Offline or not signed in: the entry stays in this browser.
  }
}

/**
 * Journal entries.
 *
 * The browser holds the journal; a signed-in account mirrors it so the same
 * analyses show up on another device. Captures stay local — they are heavy and
 * the journal reads fine without them.
 */
export function useHistory(): {
  entries: HistoryEntry[];
  ready: boolean;
  add(analysis: MarketAnalysis, status?: AnalysisStatus, screenshot?: string): void;
  reset(): void;
} {
  const entries = useSyncExternalStore(subscribeHistory, readHistory, () => EMPTY);
  const { account } = useAccount();
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

  // Merge what the account already holds with what this browser knows.
  useEffect(() => {
    if (!account) return;
    let active = true;

    (async () => {
      try {
        const response = await fetch('/api/analyses', { cache: 'no-store' });
        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok || !contentType.includes('application/json')) return;

        const payload = (await response.json()) as { entries: RemoteEntry[] };
        if (!active || !payload.entries.length) return;

        const local = readHistory();
        const byId = new Map(local.map((entry) => [entry.analysis.id, entry]));

        payload.entries.forEach((remote) => {
          // A row written by an older version can be incomplete: skip it
          // rather than let it break the journal.
          if (!isUsableAnalysis(remote.analysis)) return;
          const existing = byId.get(remote.id);
          byId.set(remote.id, {
            analysis: remote.analysis,
            status: remote.status,
            // The capture only ever lives in the browser that made it.
            ...(existing?.screenshot ? { screenshot: existing.screenshot } : {}),
          });
        });

        replaceHistory(
          [...byId.values()].sort(
            (a, b) =>
              new Date(b.analysis.createdAt).getTime() - new Date(a.analysis.createdAt).getTime(),
          ),
        );
      } catch {
        // Sync is a convenience; the local journal remains authoritative.
      }
    })();

    return () => {
      active = false;
    };
  }, [account]);

  const add = useCallback(
    (analysis: MarketAnalysis, status: AnalysisStatus = 'en_cours', screenshot?: string) => {
      appendAnalysis(analysis, status, screenshot);
      if (account) void pushEntry({ analysis, status });
    },
    [account],
  );

  const reset = useCallback(() => {
    replaceHistory(
      buildSeedAnalyses().map((analysis) => ({ analysis, status: 'en_cours' as const })),
    );
    if (account) void fetch('/api/analyses', { method: 'DELETE' }).catch(() => undefined);
  }, [account]);

  return { entries, ready, add, reset };
}

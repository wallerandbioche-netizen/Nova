'use client';

import type { MarketAnalysis } from '@/types/analysis';
import { createLocalStore } from './local-store';
import { isUsableAnalysis } from './guards';

export type AnalysisStatus = 'en_cours' | 'confirme' | 'invalide';

export interface HistoryEntry {
  analysis: MarketAnalysis;
  status: AnalysisStatus;
  /** Realised R multiple once the idea is closed. */
  realisedR?: number;
  /** The capture the analysis was run on, downscaled, when there is one. */
  screenshot?: string;
}

const MAX_ENTRIES = 60;
/** Only the most recent captures are kept: storage quota is small. */
const MAX_STORED_SCREENSHOTS = 8;

const store = createLocalStore<HistoryEntry[]>('scantrade.history', []);

export function readHistory(): HistoryEntry[] {
  return store.read();
}

/** Keeps only the entries the interface can actually render. */
export function usableEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.filter((entry) => isUsableAnalysis(entry.analysis));
}

export function appendAnalysis(
  analysis: MarketAnalysis,
  status: AnalysisStatus = 'en_cours',
  screenshot?: string,
): void {
  const entry: HistoryEntry = { analysis, status, ...(screenshot ? { screenshot } : {}) };
  const next = [entry, ...store.read()].slice(0, MAX_ENTRIES);

  // Drop the oldest captures rather than let the store hit its quota.
  let kept = 0;
  const trimmed = next.map((item) => {
    if (!item.screenshot) return item;
    kept += 1;
    if (kept <= MAX_STORED_SCREENSHOTS) return item;
    const { screenshot: _dropped, ...rest } = item;
    return rest;
  });

  store.write(trimmed);
}

export function replaceHistory(entries: HistoryEntry[]): void {
  store.write(usableEntries(entries).slice(0, MAX_ENTRIES));
}

export function clearHistory(): void {
  store.write([]);
}

export function subscribeHistory(listener: () => void): () => void {
  return store.subscribe(listener);
}

export function findAnalysis(id: string): HistoryEntry | undefined {
  return store.read().find((entry) => entry.analysis.id === id);
}

export const STATUS_LABEL: Record<AnalysisStatus, string> = {
  en_cours: 'En cours',
  confirme: 'Confirmé',
  invalide: 'Invalidé',
};

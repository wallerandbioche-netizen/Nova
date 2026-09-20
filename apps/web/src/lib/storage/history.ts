'use client';

import type { MarketAnalysis } from '@/types/analysis';
import { createLocalStore } from './local-store';

export type AnalysisStatus = 'en_cours' | 'confirme' | 'invalide';

export interface HistoryEntry {
  analysis: MarketAnalysis;
  status: AnalysisStatus;
  /** Realised R multiple once the idea is closed. */
  realisedR?: number;
}

const MAX_ENTRIES = 60;

const store = createLocalStore<HistoryEntry[]>('scantrade.history', []);

export function readHistory(): HistoryEntry[] {
  return store.read();
}

export function appendAnalysis(
  analysis: MarketAnalysis,
  status: AnalysisStatus = 'en_cours',
): void {
  const next = [{ analysis, status }, ...store.read()].slice(0, MAX_ENTRIES);
  store.write(next);
}

export function replaceHistory(entries: HistoryEntry[]): void {
  store.write(entries.slice(0, MAX_ENTRIES));
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

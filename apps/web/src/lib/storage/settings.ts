'use client';

import type { RiskProfile } from '@/types/analysis';
import { createLocalStore } from './local-store';

export type ThemePreference = 'light' | 'dark' | 'auto';

export interface Settings {
  displayName: string;
  email: string;
  theme: ThemePreference;
  riskProfile: RiskProfile;
  /** Mock subscription flag — the paywall reads it. */
  subscribed: boolean;
  accountSize: number;
  riskPercent: number;
  defaultAssetId: string;
  calibration: {
    experience: 'debutant' | 'intermediaire' | 'confirme';
    playground: 'actions' | 'crypto' | 'forex' | 'indices';
    objective: 'comprendre' | 'progresser' | 'performer';
  };
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: 'Trader',
  email: 'trader@icloud.com',
  theme: 'light',
  riskProfile: 'modere',
  subscribed: false,
  accountSize: 10_000,
  riskPercent: 1,
  defaultAssetId: 'XAUUSD',
  calibration: {
    experience: 'debutant',
    playground: 'actions',
    objective: 'comprendre',
  },
};

const store = createLocalStore<Settings>('scantrade.settings', DEFAULT_SETTINGS);

/**
 * Stored settings merged with the defaults. The merged object is memoised
 * because `useSyncExternalStore` requires a stable reference between reads.
 */
let lastRaw: Settings | null = null;
let lastMerged: Settings = DEFAULT_SETTINGS;

export function readSettings(): Settings {
  const raw = store.read();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastMerged = { ...DEFAULT_SETTINGS, ...raw };
  }
  return lastMerged;
}

export function writeSettings(settings: Settings): void {
  store.write(settings);
}

export function subscribeSettings(listener: () => void): () => void {
  return store.subscribe(listener);
}

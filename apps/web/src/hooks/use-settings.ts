'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_SETTINGS,
  readSettings,
  subscribeSettings,
  writeSettings,
  type Settings,
} from '@/lib/storage/settings';

/** Settings hook backed by localStorage, SSR-safe through useSyncExternalStore. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribeSettings, readSettings, () => DEFAULT_SETTINGS);

  const update = useCallback((patch: Partial<Settings>) => {
    writeSettings({ ...readSettings(), ...patch });
  }, []);

  return [settings, update];
}

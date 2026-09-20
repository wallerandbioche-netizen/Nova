'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { DEMO_ACCOUNT_STATE, type AccountState } from '@/types/account';
import { useSettings } from './use-settings';

export interface AccountApi extends AccountState {
  loading: boolean;
  /** Whether the paid sections should be readable right now. */
  unlocked: boolean;
  refresh(): Promise<void>;
  requestSignIn(email: string): Promise<{ ok: boolean; delivered: boolean; error?: string }>;
  signOut(): Promise<void>;
  /** Only meaningful in demo mode, where there is nothing to pay with. */
  setDemoUnlocked(value: boolean): void;
}

/**
 * One shared state for the whole page: every panel, badge and lock reads the
 * same answer, fetched once, instead of each component asking the server.
 */
const listeners = new Set<() => void>();
let snapshot: AccountState & { loading: boolean } = { ...DEMO_ACCOUNT_STATE, loading: true };
let inFlight: Promise<void> | null = null;
/** Set once the deployment is known to have no API behind it. */
let apiAbsent = false;

function publish(next: AccountState & { loading: boolean }): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load(force = false): Promise<void> {
  if (apiAbsent) return;
  if (inFlight && !force) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.includes('application/json')) {
        // No API behind this deployment: demonstration mode, and no point
        // asking again on the next page.
        apiAbsent = true;
        publish({ ...DEMO_ACCOUNT_STATE, loading: false });
        return;
      }
      publish({ ...((await response.json()) as AccountState), loading: false });
    } catch {
      apiAbsent = true;
      publish({ ...DEMO_ACCOUNT_STATE, loading: false });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function useAccount(): AccountApi {
  const [settings, updateSettings] = useSettings();
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );

  useEffect(() => {
    void load();
  }, []);

  const refresh = useCallback(() => {
    apiAbsent = false;
    return load(true);
  }, []);

  const requestSignIn = useCallback(async (email: string) => {
    try {
      const response = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        sent?: boolean;
        delivered?: boolean;
        error?: string;
      };
      if (!response.ok) {
        return { ok: false, delivered: false, error: payload.error ?? 'Connexion impossible.' };
      }
      return { ok: true, delivered: Boolean(payload.delivered) };
    } catch {
      return { ok: false, delivered: false, error: 'Connexion impossible.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    await load(true);
  }, []);

  const setDemoUnlocked = useCallback(
    (value: boolean) => updateSettings({ subscribed: value }),
    [updateSettings],
  );

  return {
    ...state,
    unlocked: state.accountsEnabled ? state.subscription.active : settings.subscribed,
    refresh,
    requestSignIn,
    signOut,
    setDemoUnlocked,
  };
}

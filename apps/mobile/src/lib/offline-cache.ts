import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline cache.
 *
 * Stores the last successful payload for the screens that must remain readable without a
 * connection: the daily brief, the portfolio and the lessons (rule #42).
 *
 * Every entry keeps the time it was captured, and the UI always displays it — cached data is
 * never presented as real time.
 */
const PREFIX = 'nova.cache.';

export interface CachedPayload<T> {
  data: T;
  cachedAt: string;
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const payload: CachedPayload<T> = { data, cachedAt: new Date().toISOString() };
    await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    // A cache write failure must never break a screen that already has its data.
  }
}

export async function readCache<T>(key: string): Promise<CachedPayload<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedPayload<T>;
  } catch {
    return null;
  }
}

export async function clearCachedPayloads(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(PREFIX));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // Nothing to do: the cache is a convenience, not a source of truth.
  }
}

/** "aujourd'hui à 08:12" / "hier à 19:40" / "le 12 septembre à 08:12". */
export function formatCachedAt(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfDate) / 86_400_000);

  if (dayDiff === 0) return `aujourd’hui à ${time}`;
  if (dayDiff === 1) return `hier à ${time}`;
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(date);
  return `le ${day} à ${time}`;
}

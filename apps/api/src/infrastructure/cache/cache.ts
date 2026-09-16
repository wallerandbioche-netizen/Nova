/**
 * Cache abstraction.
 *
 * Redis in staging/production; an in-memory implementation in development so the app runs
 * without extra infrastructure. Both honour the same contract, and a cache failure is never
 * allowed to fail a request — a miss is always an acceptable outcome.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Deletes every key matching a `prefix*` pattern. Used on writes that invalidate views. */
  delByPrefix(prefix: string): Promise<void>;
  /** Atomic counter used by quota tracking. Returns the value after increment. */
  increment(key: string, ttlSeconds: number): Promise<number>;
  close(): Promise<void>;
  readonly kind: 'memory' | 'redis';
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCache implements Cache {
  readonly kind = 'memory' as const;
  private readonly store = new Map<string, MemoryEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    const existing = this.store.get(key);
    // Keep the original expiry so a quota window is not extended by usage.
    const expiresAt = existing && existing.expiresAt > Date.now()
      ? existing.expiresAt
      : Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value: next, expiresAt });
    return next;
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

export function cacheKey(...parts: (string | number | undefined | null)[]): string {
  return ['nova', ...parts.filter((part) => part !== undefined && part !== null)].join(':');
}

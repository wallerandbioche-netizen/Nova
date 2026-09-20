'use client';

/**
 * Minimal persistence layer. Everything lives in the browser for now; the same
 * interface can be backed by an API later without touching the components.
 */
export interface Store<T> {
  read(): T;
  write(value: T): void;
  subscribe(listener: () => void): () => void;
}

export function createLocalStore<T>(key: string, fallback: T, version = 1): Store<T> {
  const storageKey = `${key}.v${version}`;
  const listeners = new Set<() => void>();
  let cache: T | null = null;

  const notify = () => listeners.forEach((listener) => listener());

  return {
    read() {
      if (typeof window === 'undefined') return fallback;
      if (cache !== null) return cache;
      try {
        const raw = window.localStorage.getItem(storageKey);
        cache = raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        cache = fallback;
      }
      return cache;
    },
    write(value: T) {
      cache = value;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(value));
        } catch {
          // Storage can be unavailable (private mode, quota); state stays in memory.
        }
      }
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheKey, MemoryCache } from './cache.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new MemoryCache();
  });

  it('stores and returns a value', async () => {
    await cache.set('k', { a: 1 }, 60);
    expect(await cache.get<{ a: number }>('k')).toEqual({ a: 1 });
  });

  it('expires a value after its TTL', async () => {
    await cache.set('k', 'v', 10);
    vi.advanceTimersByTime(9_000);
    expect(await cache.get('k')).toBe('v');
    vi.advanceTimersByTime(2_000);
    expect(await cache.get('k')).toBeNull();
  });

  it('returns null for an unknown key', async () => {
    expect(await cache.get('missing')).toBeNull();
  });

  it('deletes by prefix without touching other keys', async () => {
    await cache.set('nova:news:1', 1, 60);
    await cache.set('nova:news:2', 2, 60);
    await cache.set('nova:brief:1', 3, 60);
    await cache.delByPrefix('nova:news');
    expect(await cache.get('nova:news:1')).toBeNull();
    expect(await cache.get('nova:news:2')).toBeNull();
    expect(await cache.get('nova:brief:1')).toBe(3);
  });

  it('increments without extending the quota window', async () => {
    expect(await cache.increment('quota', 60)).toBe(1);
    vi.advanceTimersByTime(30_000);
    expect(await cache.increment('quota', 60)).toBe(2);
    // The window started at the first increment, so it ends 60s after it, not 90s.
    vi.advanceTimersByTime(31_000);
    expect(await cache.get('quota')).toBeNull();
  });

  it('builds namespaced keys and skips empty parts', () => {
    expect(cacheKey('news', 'feed', undefined, 3)).toBe('nova:news:feed:3');
  });
});

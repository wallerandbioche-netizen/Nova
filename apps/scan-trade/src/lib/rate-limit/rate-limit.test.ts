import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRateLimitStore, RATE_LIMITS, consumeRateLimit, type RateLimitStore } from './index';

const RULE = { bucket: 'test', limit: 3, windowMs: 60_000 };

describe('consumeRateLimit', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the limit and refuses the next one', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await consumeRateLimit(RULE, 'user_alice', store);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3 - attempt);
    }

    const blocked = await consumeRateLimit(RULE, 'user_alice', store);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts each subject separately', async () => {
    await consumeRateLimit(RULE, 'user_alice', store);
    await consumeRateLimit(RULE, 'user_alice', store);
    await consumeRateLimit(RULE, 'user_alice', store);

    const bob = await consumeRateLimit(RULE, 'user_bob', store);
    expect(bob.allowed).toBe(true);
  });

  it('counts each bucket separately', async () => {
    const other = { bucket: 'other', limit: 3, windowMs: 60_000 };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await consumeRateLimit(RULE, 'user_alice', store);
    }

    expect((await consumeRateLimit(other, 'user_alice', store)).allowed).toBe(true);
  });

  it('opens a fresh window once the old one elapses', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await consumeRateLimit(RULE, 'user_alice', store);
    }
    expect((await consumeRateLimit(RULE, 'user_alice', store)).allowed).toBe(false);

    vi.advanceTimersByTime(60_000);

    expect((await consumeRateLimit(RULE, 'user_alice', store)).allowed).toBe(true);
  });

  it('fails open when the counter store is down, rather than locking everyone out', async () => {
    const broken: RateLimitStore = {
      async increment() {
        throw new Error('base indisponible');
      },
    };

    const result = await consumeRateLimit(RULE, 'user_alice', broken);
    expect(result.allowed).toBe(true);
  });

  it('protects every sensitive endpoint the brief names', () => {
    expect(Object.keys(RATE_LIMITS).sort()).toEqual(
      ['accountDelete', 'billing', 'login', 'passwordReset', 'register', 'scan', 'upload'].sort(),
    );
    for (const rule of Object.values(RATE_LIMITS)) {
      expect(rule.limit).toBeGreaterThan(0);
      expect(rule.windowMs).toBeGreaterThan(0);
    }
  });
});

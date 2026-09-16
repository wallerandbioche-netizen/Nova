import { prisma } from '@/lib/db/prisma';
import { getCoreEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Fixed-window rate limiting (§43).
 *
 * The default store is Postgres, because the app is meant to run on serverless
 * instances where an in-process counter protects nothing. The memory store
 * exists for tests and single-process local runs.
 *
 * The same abstraction is the place where credits or monthly quotas will plug
 * in later — see `src/server/usage.ts`.
 */

export interface RateLimitStore {
  /** Increments the counter for `key` and returns its new value. */
  increment(key: string, windowStart: Date, expiresAt: Date): Promise<number>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, _windowStart: Date, expiresAt: Date): Promise<number> {
    const now = Date.now();
    for (const [existing, value] of this.counters) {
      if (value.expiresAt <= now) this.counters.delete(existing);
    }
    const current = this.counters.get(key);
    if (!current || current.expiresAt <= now) {
      this.counters.set(key, { count: 1, expiresAt: expiresAt.getTime() });
      return 1;
    }
    current.count += 1;
    return current.count;
  }

  clear(): void {
    this.counters.clear();
  }
}

export class PrismaRateLimitStore implements RateLimitStore {
  async increment(key: string, windowStart: Date, expiresAt: Date): Promise<number> {
    const row = await prisma.rateLimitCounter.upsert({
      where: { key },
      create: { key, count: 1, windowStart, expiresAt },
      update: { count: { increment: 1 } },
    });
    return row.count;
  }
}

export interface RateLimitRule {
  /** Namespace, e.g. `login` or `scan`. */
  bucket: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

/** Windows are kept short enough to be forgiving and long enough to bite. */
export const RATE_LIMITS = {
  login: { bucket: 'login', limit: 10, windowMs: 15 * 60_000 },
  register: { bucket: 'register', limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { bucket: 'password-reset', limit: 5, windowMs: 60 * 60_000 },
  upload: { bucket: 'upload', limit: 30, windowMs: 60 * 60_000 },
  scan: { bucket: 'scan', limit: 20, windowMs: 60 * 60_000 },
  billing: { bucket: 'billing', limit: 20, windowMs: 60 * 60_000 },
  accountDelete: { bucket: 'account-delete', limit: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

let store: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (store) return store;
  store = getCoreEnv().RATE_LIMIT_DRIVER === 'memory' ? new MemoryRateLimitStore() : new PrismaRateLimitStore();
  return store;
}

/** Test helper — also used to force the memory driver in single-process setups. */
export function setRateLimitStore(next: RateLimitStore | null): void {
  store = next;
}

export async function consumeRateLimit(
  rule: RateLimitRule,
  subject: string,
  storeOverride?: RateLimitStore,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartMs = Math.floor(now / rule.windowMs) * rule.windowMs;
  const resetAt = new Date(windowStartMs + rule.windowMs);
  const key = `${rule.bucket}:${subject}:${windowStartMs}`;

  try {
    const count = await (storeOverride ?? getRateLimitStore()).increment(key, new Date(windowStartMs), resetAt);
    const remaining = Math.max(0, rule.limit - count);
    return {
      allowed: count <= rule.limit,
      limit: rule.limit,
      remaining,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
    };
  } catch (error) {
    // A rate limiter that is down must not take the whole endpoint with it, but
    // the gap has to be visible in the logs.
    logger.error('rate_limit.store_unavailable', { bucket: rule.bucket, error });
    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit,
      resetAt,
      retryAfterSeconds: 0,
    };
  }
}

/** Best-effort cleanup of expired windows. Safe to call from a cron. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimitCounter.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

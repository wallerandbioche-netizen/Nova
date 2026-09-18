import { AppError } from './errors';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Requests allowed inside the window. */
  limit: number;
  windowMs: number;
}

/**
 * Fixed-window rate limiting, in memory.
 *
 * Enough for a single instance and for protecting the expensive routes (import, upload, render)
 * from a runaway client. Multi-instance deployments should point this at Redis — the call sites
 * do not change.
 */
export function rateLimit(key: string, options: RateLimitOptions): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > options.limit) {
    throw new AppError('RATE_LIMITED');
  }
}

export const RATE_LIMITS = {
  import: { limit: 12, windowMs: 60_000 },
  upload: { limit: 60, windowMs: 60_000 },
  render: { limit: 10, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 60_000 },
} as const;

export function resetRateLimits(): void {
  buckets.clear();
}

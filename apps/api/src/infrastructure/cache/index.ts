import type { Logger } from 'pino';
import type { Env } from '../../config/env.js';
import { MemoryCache, type Cache } from './cache.js';
import { RedisCache } from './redis-cache.js';

export * from './cache.js';
export { RedisCache } from './redis-cache.js';

export function createCache(env: Env, logger: Logger): Cache {
  if (env.REDIS_URL) return RedisCache.create(env.REDIS_URL, logger);
  logger.info('REDIS_URL not set — using the in-memory cache (single process only)');
  return new MemoryCache();
}

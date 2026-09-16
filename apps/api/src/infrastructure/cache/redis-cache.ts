import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Cache } from './cache.js';

export class RedisCache implements Cache {
  readonly kind = 'redis' as const;

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  static create(url: string, logger: Logger): RedisCache {
    const redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      // A cache outage must degrade to "no cache", never to a failed request.
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });
    redis.on('error', (error) => logger.warn({ err: error }, 'redis error'));
    return new RedisCache(redis, logger);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn({ err: error, key }, 'cache get failed, serving without cache');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'cache set failed');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'cache delete failed');
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      // SCAN rather than KEYS: never block Redis for other tenants of the instance.
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn({ err: error, prefix }, 'cache prefix delete failed');
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    try {
      const value = await this.redis.incr(key);
      if (value === 1) await this.redis.expire(key, ttlSeconds);
      return value;
    } catch (error) {
      this.logger.warn({ err: error, key }, 'cache increment failed');
      // Fail open on counting, but the caller treats -1 as "unknown quota".
      return -1;
    }
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}

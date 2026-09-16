import { describe, expect, it } from 'vitest';
import { corsOrigins, parseEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://nova:nova@localhost:5432/nova',
  JWT_SECRET: 'a'.repeat(40),
};

describe('parseEnv', () => {
  it('applies safe defaults', () => {
    const env = parseEnv({ ...base } as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.MARKET_DATA_PROVIDER).toBe('demo');
    expect(env.LLM_PROVIDER).toBe('demo');
    expect(env.JOBS_ENABLED).toBe(true);
  });

  it('rejects a short JWT secret', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: 'short' } as NodeJS.ProcessEnv)).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rejects a missing database url', () => {
    expect(() => parseEnv({ JWT_SECRET: base.JWT_SECRET } as NodeJS.ProcessEnv)).toThrow(
      /DATABASE_URL/,
    );
  });

  it('requires an endpoint when a real provider is selected', () => {
    expect(() => parseEnv({ ...base, NEWS_PROVIDER: 'http' } as NodeJS.ProcessEnv)).toThrow(
      /NEWS_API_URL/,
    );
  });

  it('requires an API key when a real LLM provider is selected', () => {
    expect(() => parseEnv({ ...base, LLM_PROVIDER: 'anthropic' } as NodeJS.ProcessEnv)).toThrow(
      /LLM_API_KEY/,
    );
  });

  it('refuses a placeholder secret in production', () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-with-at-least-32-random-characters',
        REDIS_URL: 'redis://localhost:6379',
      } as NodeJS.ProcessEnv),
    ).toThrow(/placeholder/);
  });

  it('requires Redis in production', () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'b'.repeat(40),
      } as NodeJS.ProcessEnv),
    ).toThrow(/REDIS_URL/);
  });

  it('parses the CORS origin list', () => {
    const env = parseEnv({
      ...base,
      CORS_ORIGINS: 'http://a.test, http://b.test ,',
    } as NodeJS.ProcessEnv);
    expect(corsOrigins(env)).toEqual(['http://a.test', 'http://b.test']);
  });
});

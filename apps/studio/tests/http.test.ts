import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readJson, readOptionalJson, clientKey, fail } from '@/lib/http';
import { AppError, messageForCode } from '@/lib/errors';
import { rateLimit, resetRateLimits, RATE_LIMITS } from '@/lib/rate-limit';

const schema = z.object({ name: z.string().optional(), style: z.string().optional() });

function request(body?: string, headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body }),
  });
}

describe('readOptionalJson', () => {
  // Regression: a POST with no body used to be rejected as malformed, which broke
  // "regenerate with the current settings".
  it('treats an empty body as no changes', async () => {
    expect(await readOptionalJson(request(), schema)).toBeNull();
    expect(await readOptionalJson(request(''), schema)).toBeNull();
    expect(await readOptionalJson(request('   '), schema)).toBeNull();
  });

  it('parses a body when there is one', async () => {
    expect(await readOptionalJson(request('{"style":"LUXURY"}'), schema)).toEqual({ style: 'LUXURY' });
  });

  it('still rejects a malformed body', async () => {
    await expect(readOptionalJson(request('{ nope'), schema)).rejects.toThrow(AppError);
  });

  it('propagates schema violations', async () => {
    await expect(readOptionalJson(request('{"style":42}'), schema)).rejects.toThrow();
  });
});

describe('readJson', () => {
  it('requires a body', async () => {
    await expect(readJson(request(), schema)).rejects.toThrow(AppError);
  });
});

describe('error responses', () => {
  it('maps an AppError to its status and payload', async () => {
    const response = fail(new AppError('INSUFFICIENT_CREDITS'));
    expect(response.status).toBe(402);
    const body = (await response.json()) as { error: { code: string; recovery: string } };
    expect(body.error.code).toBe('INSUFFICIENT_CREDITS');
    expect(body.error.recovery).toBe('BUY_CREDITS');
  });

  it('offers manual upload whenever an import cannot work', async () => {
    for (const code of ['IMPORT_BLOCKED', 'NO_IMAGES_FOUND', 'UNSUPPORTED_PLATFORM', 'IMAGES_UNREACHABLE'] as const) {
      const body = (await fail(new AppError(code)).json()) as { error: { recovery: string } };
      expect(body.error.recovery).toBe('MANUAL_UPLOAD');
    }
  });

  it('never leaks an unexpected error to the client', async () => {
    const response = fail(new Error('connection string postgres://user:password@host/db'));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe(messageForCode('INTERNAL'));
    expect(body.error.message).not.toContain('postgres');
  });

  it('turns a Zod error into a 422 with field details', async () => {
    const parse = z.object({ email: z.string().email() }).safeParse({ email: 'nope' });
    const response = fail(parse.success ? new Error('unreachable') : parse.error);
    expect(response.status).toBe(422);
  });
});

describe('rate limiting', () => {
  it('allows a burst then refuses', () => {
    resetRateLimits();
    const key = 'test:render';
    for (let i = 0; i < RATE_LIMITS.render.limit; i += 1) {
      expect(() => rateLimit(key, RATE_LIMITS.render)).not.toThrow();
    }
    expect(() => rateLimit(key, RATE_LIMITS.render)).toThrow(AppError);
  });

  it('keeps separate buckets per client', () => {
    resetRateLimits();
    for (let i = 0; i < RATE_LIMITS.auth.limit; i += 1) rateLimit('a', RATE_LIMITS.auth);
    expect(() => rateLimit('b', RATE_LIMITS.auth)).not.toThrow();
  });

  it('derives a key from the forwarded client address', () => {
    const req = new Request('https://example.com', { headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } });
    expect(clientKey(req, 'import')).toBe('203.0.113.9:import');
  });
});

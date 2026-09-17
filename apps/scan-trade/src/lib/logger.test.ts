import { describe, expect, it } from 'vitest';
import { redact } from './logger';

/** What must never reach a log drain — and what must (§47). */
describe('redact', () => {
  it('strips credentials whatever their casing', () => {
    const output = redact({
      password: 'hunter2',
      Password: 'hunter2',
      apiKey: 'sk-live-123',
      api_key: 'sk-live-123',
      AUTH_SECRET: 'abc',
      authorization: 'Bearer abc',
      cookie: 'session=abc',
      stripe_signature: 't=1,v1=abc',
      cardNumber: '4242424242424242',
      cvc: '123',
      iban: 'FR76...',
      accessToken: 'abc',
    }) as Record<string, unknown>;

    for (const value of Object.values(output)) {
      expect(value).toBe('[redacted]');
    }
  });

  it('keeps token counts, which are metrics rather than secrets', () => {
    const output = redact({
      inputTokens: 1200,
      outputTokens: 450,
      maxOutputTokens: 4096,
    }) as Record<string, unknown>;

    expect(output).toEqual({ inputTokens: 1200, outputTokens: 450, maxOutputTokens: 4096 });
  });

  it('keeps ordinary diagnostic fields', () => {
    const output = redact({
      userId: 'user_1',
      analysisId: 'analysis_1',
      durationMs: 812,
      status: 'COMPLETED',
    });

    expect(output).toEqual({
      userId: 'user_1',
      analysisId: 'analysis_1',
      durationMs: 812,
      status: 'COMPLETED',
    });
  });

  it('reaches into nested objects and arrays', () => {
    const output = redact({
      request: { headers: { authorization: 'Bearer abc' }, path: '/api/analyses' },
      users: [{ email: 'a@b.c', password: 'x' }],
    }) as Record<string, Record<string, unknown>>;

    expect((output.request?.headers as Record<string, unknown>).authorization).toBe('[redacted]');
    expect(output.request?.path).toBe('/api/analyses');
    expect((output.users as unknown as Array<Record<string, unknown>>)[0]?.password).toBe(
      '[redacted]',
    );
  });

  it('serialises an Error without losing its message', () => {
    const output = redact(new Error('boom')) as Record<string, unknown>;

    expect(output.name).toBe('Error');
    expect(output.message).toBe('boom');
  });

  it('stops descending instead of looping on a cyclic object', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic.self = cyclic;

    expect(() => redact(cyclic)).not.toThrow();
  });
});

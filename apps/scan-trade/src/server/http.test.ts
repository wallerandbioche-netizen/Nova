import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AnalysisValidationError } from '@/lib/ai';
import { ConfigurationError } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { StorageError } from '@/lib/storage';
import { getClientIp, toErrorResponse } from './http';

async function bodyOf(
  response: Response,
): Promise<{ error: { code: string; message: string; details?: unknown } }> {
  return (await response.json()) as { error: { code: string; message: string; details?: unknown } };
}

describe('toErrorResponse', () => {
  it('returns an AppError with its own status and message', async () => {
    const response = toErrorResponse(new AppError('subscription_required'));
    const body = await bodyOf(response);

    expect(response.status).toBe(402);
    expect(body.error.code).toBe('subscription_required');
    expect(body.error.message).toContain('abonnement');
  });

  it('turns a Zod failure into per-field messages', async () => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(10) });
    const parsed = schema.safeParse({ email: 'nope', password: 'court' });

    const response = toErrorResponse(parsed.error);
    const body = await bodyOf(response);

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('validation_error');
    expect((body.error.details as { fields: Record<string, string> }).fields).toHaveProperty(
      'email',
    );
    expect((body.error.details as { fields: Record<string, string> }).fields).toHaveProperty(
      'password',
    );
  });

  it('maps an incoherent model answer onto the sentence the brief specifies', async () => {
    const response = toErrorResponse(new AnalysisValidationError(['stop loss du mauvais côté']));
    const body = await bodyOf(response);

    expect(response.status).toBe(502);
    expect(body.error.message).toBe(
      'Analyse indisponible — les données générées sont incohérentes.',
    );
    // The internal reason stays server-side.
    expect(JSON.stringify(body)).not.toContain('mauvais côté');
  });

  it('maps a storage failure onto a retryable message', async () => {
    const response = toErrorResponse(new StorageError('bucket injoignable'));
    const body = await bodyOf(response);

    expect(response.status).toBe(502);
    expect(body.error.code).toBe('storage_error');
    expect(body.error.message).not.toContain('bucket');
  });

  it('never tells the client which environment variable is missing', async () => {
    const response = toErrorResponse(
      new ConfigurationError('AI_API_KEY manquante', ['AI_API_KEY']),
    );
    const body = await bodyOf(response);

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('AI_API_KEY');
  });

  it('never leaks a stack trace for an unexpected error', async () => {
    const response = toErrorResponse(
      new TypeError("Cannot read properties of undefined (reading 'foo')"),
    );
    const body = await bodyOf(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('Cannot read properties');
    expect(JSON.stringify(body)).not.toContain('at ');
  });

  it('carries a retry hint on a rate-limit refusal', async () => {
    const response = toErrorResponse(
      new AppError('rate_limited', undefined, { retryAfterSeconds: 42, limit: 10 }),
    );
    const body = await bodyOf(response);

    expect(response.status).toBe(429);
    expect(body.error.details).toMatchObject({ retryAfterSeconds: 42 });
  });

  it('answers 404 for a missing resource without confirming it exists elsewhere', async () => {
    const response = toErrorResponse(AppError.notFound());
    const body = await bodyOf(response);

    expect(response.status).toBe(404);
    expect(body.error.message).toContain("n'existe pas");
  });
});

describe('getClientIp', () => {
  it('takes the first address of an x-forwarded-for chain', () => {
    const request = new Request('https://scan-trade.test/api/analyses', {
      headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' },
    });

    expect(getClientIp(request)).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip', () => {
    const request = new Request('https://scan-trade.test/api/analyses', {
      headers: { 'x-real-ip': '203.0.113.9' },
    });

    expect(getClientIp(request)).toBe('203.0.113.9');
  });

  it('degrades to a constant rather than throwing when no header is present', () => {
    expect(getClientIp(new Request('https://scan-trade.test/api/analyses'))).toBe('unknown');
  });
});

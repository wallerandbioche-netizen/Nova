import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ConfigurationError } from '@/lib/env';
import { AppError, type AppErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { StorageError } from '@/lib/storage';
import { AnalysisValidationError } from '@/lib/ai';
import { consumeRateLimit, type RateLimitRule } from '@/lib/rate-limit';

/** Shared HTTP plumbing for route handlers: errors in, JSON out (§46). */

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Converts anything thrown inside a handler into a client-safe payload.
 * Stack traces are logged, never returned.
 */
export function toErrorResponse(
  error: unknown,
  context: Record<string, unknown> = {},
): NextResponse {
  if (error instanceof AppError) {
    if (error.status >= 500) logger.error('http.error', { ...context, code: error.code, error });
    else logger.info('http.client_error', { ...context, code: error.code });
    return NextResponse.json(error.toJSON(), { status: error.status });
  }

  if (error instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || 'form';
      if (!details[path]) details[path] = issue.message;
    }
    const appError = AppError.validation('Certaines informations envoyées sont invalides.', {
      fields: details,
    });
    return NextResponse.json(appError.toJSON(), { status: appError.status });
  }

  const mapped = mapKnownError(error);
  if (mapped) {
    logger.error('http.error', { ...context, code: mapped.code, error });
    return NextResponse.json(mapped.toJSON(), { status: mapped.status });
  }

  logger.error('http.unhandled', { ...context, error });
  const fallback = new AppError('internal_error');
  return NextResponse.json(fallback.toJSON(), { status: fallback.status });
}

function mapKnownError(error: unknown): AppError | null {
  if (error instanceof AnalysisValidationError) return new AppError('ai_invalid_response');
  if (error instanceof StorageError) return new AppError('storage_error');
  if (error instanceof ConfigurationError) {
    // The variable names go to the log, not to the client.
    logger.error('http.configuration_error', {
      variables: error.variables,
      message: error.message,
    });
    return new AppError('configuration_error');
  }
  return null;
}

/** Wraps a handler so no route can leak an unhandled rejection. */
export function route<A extends unknown[]>(
  name: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error, { route: name });
    }
  };
}

/**
 * Client address, best effort.
 * Used only for rate limiting — never for authorisation.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Applies a rate-limit rule, throwing a 429 with a Retry-After hint. */
export async function enforceRateLimit(rule: RateLimitRule, subject: string): Promise<void> {
  const result = await consumeRateLimit(rule, subject);
  if (!result.allowed) {
    throw new AppError('rate_limited', undefined, {
      retryAfterSeconds: result.retryAfterSeconds,
      limit: result.limit,
    });
  }
}

export function errorCodeOf(error: unknown): AppErrorCode | null {
  return error instanceof AppError ? error.code : null;
}

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, isAppError } from './errors';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Single error boundary for every API route.
 * The client always receives `{ error: { code, message, recovery? } }` and never a stack trace.
 */
export function fail(error: unknown): NextResponse {
  if (isAppError(error)) {
    return NextResponse.json(error.toJSON(), { status: error.status });
  }
  if (error instanceof ZodError) {
    const appError = new AppError('VALIDATION_FAILED', undefined, {
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return NextResponse.json(
      { ...appError.toJSON(), details: appError.details },
      { status: appError.status },
    );
  }

  console.error('[api] unhandled error', error);
  const fallback = new AppError('INTERNAL');
  return NextResponse.json(fallback.toJSON(), { status: fallback.status });
}

/** Wraps a route handler so thrown AppErrors become well-formed responses. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return fail(error);
    }
  };
}

export async function readJson<T>(
  request: Request,
  schema: { parse: (input: unknown) => T },
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Corps de requête illisible.');
  }
  return schema.parse(body);
}

/**
 * Same as readJson, but an absent or empty body is a valid "nothing to change" — a POST that
 * carries no settings is a normal request, not a malformed one.
 */
export async function readOptionalJson<T>(
  request: Request,
  schema: { parse: (input: unknown) => T },
): Promise<T | null> {
  const raw = (await request.text()).trim();
  if (raw === '') return null;
  try {
    return schema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AppError('VALIDATION_FAILED', 'Corps de requête illisible.');
    }
    throw error;
  }
}

/** Best-effort client identity for rate limiting. */
export function clientKey(request: Request, suffix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${forwarded ?? 'local'}:${suffix}`;
}

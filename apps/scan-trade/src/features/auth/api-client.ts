'use client';

import { defaultMessageFor, type AppErrorCode } from '@/lib/errors';

/**
 * Thin fetch wrapper for the client screens.
 *
 * Its job is to make sure the user always sees a sentence, never a status
 * code: any shape the server did not produce on purpose still resolves to a
 * readable message (§46).
 */

export interface ApiFailure {
  code: AppErrorCode | 'network_error';
  message: string;
  fields?: Record<string, string> | undefined;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: { fields?: Record<string, string> };
  };
}

export async function apiRequest<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch {
    return {
      ok: false,
      error: {
        code: 'network_error',
        message: 'Connexion impossible. Vérifie ta connexion internet puis réessaie.',
      },
    };
  }

  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }

  const payload = (await response.json().catch(() => null)) as (ErrorPayload & T) | null;

  if (!response.ok) {
    const code = (payload?.error?.code ?? 'internal_error') as AppErrorCode;
    return {
      ok: false,
      error: {
        code,
        message: payload?.error?.message ?? defaultMessageFor(code),
        fields: payload?.error?.details?.fields,
      },
    };
  }

  return { ok: true, data: (payload ?? undefined) as T };
}

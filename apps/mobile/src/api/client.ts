import Constants from 'expo-constants';
import type { ApiErrorBody, ApiErrorCode } from '@nova/types';

/**
 * HTTP client.
 *
 * Single point of contact with the API: all auth headers, error normalisation and token
 * refresh live here. Screens never call `fetch` directly, and never talk to a model.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(options: {
    code: ApiErrorCode;
    message: string;
    status: number;
    requestId?: string | null;
    details?: unknown;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId ?? null;
    this.details = options.details;
  }

  /** True when retrying could plausibly succeed (network blip, upstream hiccup). */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isOffline(): boolean {
    return this.status === 0;
  }
}

export interface TokenStore {
  getAccessToken: () => Promise<string | null>;
  getRefreshToken: () => Promise<string | null>;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  clear: () => Promise<void>;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skips the Authorization header (used by the auth routes themselves). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

const DEFAULT_BASE_URL = 'http://localhost:4000/v1';

export function resolveBaseUrl(): string {
  const configured = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  return configured ?? DEFAULT_BASE_URL;
}

export class ApiClient {
  private refreshPromise: Promise<boolean> | null = null;

  constructor(
    private readonly tokens: TokenStore,
    private readonly baseUrl: string = resolveBaseUrl(),
    private readonly onUnauthenticated?: () => void,
  ) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.send(path, options);

    // A 401 on an authenticated call: try one silent refresh, then replay once.
    if (response.status === 401 && !options.anonymous) {
      const refreshed = await this.refreshOnce();
      if (refreshed) {
        const replay = await this.send(path, options);
        return this.parse<T>(replay);
      }
      await this.tokens.clear();
      this.onUnauthenticated?.();
    }

    return this.parse<T>(response);
  }

  private async send(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    if (!options.anonymous) {
      const accessToken = await this.tokens.getAccessToken();
      if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    }

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch {
      // Network failure: surfaced as status 0 so the UI can show its offline state rather
      // than a generic error.
      throw new ApiError({
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Impossible de récupérer les dernières données.',
        status: 0,
      });
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      const body = payload as ApiErrorBody | null;
      throw new ApiError({
        code: body?.error?.code ?? 'INTERNAL_ERROR',
        message: body?.error?.message ?? 'Une erreur est survenue.',
        status: response.status,
        requestId: body?.error?.requestId ?? response.headers.get('x-request-id'),
        details: body?.error?.details,
      });
    }

    return payload as T;
  }

  /** Refreshes the session at most once at a time, whatever the number of parallel calls. */
  private async refreshOnce(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await this.tokens.getRefreshToken();
        if (!refreshToken) return false;

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;

        const body = (await response.json()) as {
          tokens: { accessToken: string; refreshToken: string };
        };
        await this.tokens.setTokens(body.tokens);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  get<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  patch<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  put<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  delete<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'DELETE', body });
  }
}

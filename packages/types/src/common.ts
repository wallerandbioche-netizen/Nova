import type { EpistemicKind } from './enums.js';

export type Iso8601 = string;

/** Cursor-paginated collection returned by every list endpoint. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SourceReference {
  name: string;
  url: string | null;
  publishedAt: Iso8601 | null;
}

/**
 * Provenance attached to any payload carrying market or news data.
 *
 * `isDemo` is propagated from the database to the UI: demo data is always labelled as such
 * (absolute rule #58 of the specification).
 */
export interface DataMeta {
  asOf: Iso8601;
  isDemo: boolean;
  /** Human readable provider name, e.g. "NOVA demo dataset" or "MarketStack". */
  provider: string;
  sources?: SourceReference[];
  /** True when the payload is served from cache or from an older successful run. */
  isStale?: boolean;
}

export interface Statement {
  kind: EpistemicKind;
  text: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'UPSTREAM_UNAVAILABLE',
  'FEATURE_NOT_AVAILABLE',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ApiError } from '../api/client';
import { formatCachedAt, readCache, writeCache } from '../lib/offline-cache';

/**
 * Query hook with an offline fallback.
 *
 * On success the payload is cached; when the network call fails, the last cached payload is
 * returned together with the time it was captured, so the screen can show real content and
 * state plainly that it is not live (rule #42).
 */
export interface NovaQueryResult<T> extends Pick<UseQueryResult<T>, 'refetch' | 'isRefetching'> {
  data: T | undefined;
  isLoading: boolean;
  error: ApiError | null;
  /** True when the data shown comes from the offline cache. */
  isFromCache: boolean;
  /** Human-readable capture time of the cached payload, e.g. "aujourd'hui à 08:12". */
  cachedAtLabel: string | null;
  isOffline: boolean;
}

export function useNovaQuery<T>(options: {
  queryKey: readonly (string | number | undefined)[];
  queryFn: () => Promise<T>;
  /** Cache key; omit to disable the offline fallback for this query. */
  cacheKey?: string;
  enabled?: boolean;
  staleTime?: number;
}): NovaQueryResult<T> {
  const [cached, setCached] = useState<{ data: T; cachedAt: string } | null>(null);

  const query = useQuery<T, ApiError>({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 30_000,
    // Only transient failures are retried: a 4xx will not fix itself.
    retry: (failureCount, error) => error.isRetryable && failureCount < 2,
  });

  // Load the cached payload once, so it is ready if the request fails.
  useEffect(() => {
    if (!options.cacheKey) return;
    let cancelled = false;
    void readCache<T>(options.cacheKey).then((payload) => {
      if (!cancelled && payload) setCached(payload);
    });
    return () => {
      cancelled = true;
    };
    // Only the cache key matters here: the payload is read once, to be ready if the request
    // fails. Re-running on every render of the options object would re-read on each render.
  }, [options.cacheKey]);

  useEffect(() => {
    if (options.cacheKey && query.data !== undefined) {
      void writeCache(options.cacheKey, query.data);
    }
  }, [query.data, options.cacheKey]);

  const failed = query.isError;
  const useCache = failed && cached !== null;

  return {
    data: query.data ?? (useCache ? cached.data : undefined),
    isLoading: query.isLoading && !useCache,
    error: failed && !useCache ? (query.error ?? null) : null,
    isFromCache: useCache,
    cachedAtLabel: useCache ? formatCachedAt(cached.cachedAt) : null,
    isOffline: query.error?.isOffline ?? false,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

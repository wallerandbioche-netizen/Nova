import { useSyncExternalStore } from 'react';
import { toHash } from './link';

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

function currentUrl(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

/** Route currently displayed, derived from the hash fragment. */
export function usePathname(): string {
  const url = useSyncExternalStore(subscribe, currentUrl, () => '/');
  const [pathname] = url.split('?');
  return pathname || '/';
}

export function useSearchParams(): URLSearchParams {
  const url = useSyncExternalStore(subscribe, currentUrl, () => '/');
  const [, query = ''] = url.split('?');
  return new URLSearchParams(query);
}

export function useRouter() {
  return {
    push(href: string) {
      window.location.hash = toHash(href).replace(/^#/, '');
    },
    replace(href: string) {
      window.location.replace(toHash(href));
    },
    back() {
      window.history.back();
    },
    refresh() {},
    prefetch() {},
  };
}

export function useParams<T extends Record<string, string>>(): T {
  return {} as T;
}

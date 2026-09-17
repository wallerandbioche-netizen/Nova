/**
 * API base URL resolution.
 *
 * Deliberately free of Expo imports so it can be unit-tested directly: pulling in the Expo
 * runtime would drag Flow-typed React Native sources into the test transform.
 */
export const DEFAULT_API_PORT = 4000;
export const DEFAULT_BASE_URL = `http://localhost:${DEFAULT_API_PORT}/v1`;

export interface BaseUrlSources {
  /** EXPO_PUBLIC_API_URL — explicit, wins everywhere. */
  explicitUrl?: string | null;
  isDev: boolean;
  /** Host serving the bundle in development, e.g. "192.168.1.24:8081". */
  hostUri?: string | null;
  /** `extra.apiBaseUrl` from app.json, used by standalone builds. */
  configuredUrl?: string | null;
}

/**
 * Decides which API URL the app talks to.
 *
 * The dev-host case is what makes the app usable on a real phone: Expo serves the bundle from
 * the developer's machine over the local network, so `localhost` inside the app would point at
 * the phone itself. Deriving the host from the dev server means scanning the QR code just
 * works, with no IP address to configure by hand.
 */
export function computeBaseUrl(sources: BaseUrlSources): string {
  if (sources.explicitUrl) return sources.explicitUrl.replace(/\/+$/, '');

  if (sources.isDev) {
    const host = sources.hostUri?.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${DEFAULT_API_PORT}/v1`;
    }
  }

  return sources.configuredUrl?.replace(/\/+$/, '') ?? DEFAULT_BASE_URL;
}

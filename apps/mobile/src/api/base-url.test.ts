import { describe, expect, it } from 'vitest';
import { computeBaseUrl } from './base-url';

/**
 * `computeBaseUrl` decides whether the app can reach the API at all — the dev-host case is what
 * makes a physical phone work, so every branch is pinned here.
 */
describe('computeBaseUrl', () => {
  it('prefers an explicit URL everywhere, and trims trailing slashes', () => {
    expect(
      computeBaseUrl({
        explicitUrl: 'https://api.nova.app/v1/',
        isDev: true,
        hostUri: '192.168.1.24:8081',
        configuredUrl: 'http://localhost:4000/v1',
      }),
    ).toBe('https://api.nova.app/v1');
  });

  it('derives the API host from the Expo dev server, so a phone reaches the machine', () => {
    expect(computeBaseUrl({ isDev: true, hostUri: '192.168.1.24:8081' })).toBe(
      'http://192.168.1.24:4000/v1',
    );
  });

  it('ignores a local dev host, which would point the phone at itself', () => {
    for (const hostUri of ['localhost:8081', '127.0.0.1:8081']) {
      expect(
        computeBaseUrl({ isDev: true, hostUri, configuredUrl: 'http://localhost:4000/v1' }),
      ).toBe('http://localhost:4000/v1');
    }
  });

  it('uses the app.json configuration outside development', () => {
    expect(
      computeBaseUrl({
        isDev: false,
        hostUri: '192.168.1.24:8081',
        configuredUrl: 'https://api.nova.app/v1',
      }),
    ).toBe('https://api.nova.app/v1');
  });

  it('falls back to localhost when nothing is configured', () => {
    expect(computeBaseUrl({ isDev: true })).toBe('http://localhost:4000/v1');
    expect(computeBaseUrl({ isDev: false, explicitUrl: '' })).toBe('http://localhost:4000/v1');
  });
});

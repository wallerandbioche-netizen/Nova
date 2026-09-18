import { describe, expect, it } from 'vitest';
import { parseListingUrl, isPrivateHost } from '@/lib/importers/url';
import { isPathAllowed } from '@/lib/importers/http';
import { detectPlatform } from '@/lib/importers';
import { AppError } from '@/lib/errors';

describe('parseListingUrl', () => {
  it('accepts a normal listing URL', () => {
    expect(parseListingUrl('https://www.airbnb.fr/rooms/12345').hostname).toBe('www.airbnb.fr');
  });

  it('adds a scheme when the user omits it', () => {
    expect(parseListingUrl('booking.com/hotel/fr/villa.html').protocol).toBe('https:');
  });

  it('drops the fragment', () => {
    expect(parseListingUrl('https://example.com/a#photos').toString()).toBe('https://example.com/a');
  });

  it.each(['', '   ', 'not a url', 'ftp://example.com/x', 'javascript:alert(1)'])(
    'rejects %j',
    (input) => {
      expect(() => parseListingUrl(input)).toThrow(AppError);
    },
  );

  it.each([
    'http://localhost:3000/x',
    'http://127.0.0.1/x',
    'http://10.0.0.5/x',
    'http://192.168.1.10/x',
    'http://169.254.169.254/latest/meta-data',
    'http://172.16.4.2/x',
    'http://db.internal/x',
  ])('refuses the private target %s', (input) => {
    expect(() => parseListingUrl(input)).toThrow(AppError);
  });
});

describe('isPrivateHost', () => {
  it('lets public hosts through', () => {
    expect(isPrivateHost('airbnb.com')).toBe(false);
    expect(isPrivateHost('172.32.0.1')).toBe(false);
  });
});

describe('detectPlatform', () => {
  it.each([
    ['https://www.airbnb.fr/rooms/1', 'AIRBNB'],
    ['https://www.booking.com/hotel/fr/x.html', 'BOOKING'],
    ['https://www.vrbo.com/1234', 'VRBO'],
    ['https://www.abritel.fr/location-vacances/p1', 'VRBO'],
    ['https://agence-immo.fr/annonce/42', 'GENERIC'],
    ['https://demo.nova.studio/villa', 'DEMO'],
  ])('maps %s to %s', (url, expected) => {
    expect(detectPlatform(url)?.platform).toBe(expected);
  });

  it('returns null for an invalid URL', () => {
    expect(detectPlatform('nope')).toBeNull();
  });
});

describe('robots.txt', () => {
  const robots = `
User-agent: *
Disallow: /private
Allow: /private/public-part

User-agent: NovaStudioBot
Disallow: /blocked
`;

  it('respects a rule written for our own agent', () => {
    expect(isPathAllowed(robots, '/blocked/page', 'NovaStudioBot/0.1')).toBe(false);
    expect(isPathAllowed(robots, '/private/x', 'NovaStudioBot/0.1')).toBe(true);
  });

  it('falls back to the wildcard group', () => {
    expect(isPathAllowed(robots, '/private/x', 'OtherBot/1')).toBe(false);
  });

  it('lets the most specific rule win', () => {
    expect(isPathAllowed(robots, '/private/public-part/a', 'OtherBot/1')).toBe(true);
  });

  it('allows everything when there is no matching rule', () => {
    expect(isPathAllowed(robots, '/rooms/1', 'OtherBot/1')).toBe(true);
  });

  it('handles wildcards and end anchors', () => {
    const rules = 'User-agent: *\nDisallow: /*.json$';
    expect(isPathAllowed(rules, '/data/file.json', 'Bot/1')).toBe(false);
    expect(isPathAllowed(rules, '/data/file.json?x=1', 'Bot/1')).toBe(true);
  });
});

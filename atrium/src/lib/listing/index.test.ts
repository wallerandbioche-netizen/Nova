import { describe, expect, it } from 'vitest';
import { AirbnbListingSource } from './airbnb';
import { DemoListingSource } from './demo';
import { parseUserInput, resolveSource } from './index';

describe('parseUserInput', () => {
  it('reconnaît un lien d\'annonce', () => {
    expect(parseUserInput('https://www.airbnb.fr/rooms/12345678')).toEqual({
      kind: 'url',
      url: 'https://www.airbnb.fr/rooms/12345678',
    });
  });

  it('reconnaît les entrées de développement', () => {
    expect(parseUserInput('demo:')).toEqual({ kind: 'demo' });
    expect(parseUserInput(' folder:/photos ')).toEqual({ kind: 'folder', path: '/photos' });
  });
});

describe('resolveSource', () => {
  it('dirige chaque entrée vers sa source', () => {
    expect(resolveSource({ kind: 'url', url: 'https://airbnb.fr/rooms/1' }).id).toBe('airbnb');
    expect(resolveSource({ kind: 'demo' }).id).toBe('demo');
    expect(resolveSource({ kind: 'upload', uploadId: 'up_1' }).id).toBe('upload');
  });

  it('refuse une URL qui n\'est pas une annonce', () => {
    expect(() => resolveSource({ kind: 'url', url: 'https://example.com/x' })).toThrow();
  });
});

describe('cloisonnement de la démonstration', () => {
  it('la source Airbnb ne sert jamais les photos de démonstration', () => {
    const airbnb = new AirbnbListingSource();
    expect(airbnb.supports({ kind: 'demo' })).toBe(false);
    // Elle ne connaît plus que des URL : aucun repli possible.
    expect(airbnb.supports({ kind: 'upload', uploadId: 'x' })).toBe(false);
  });

  it('la démonstration ne répond pas à un lien d\'annonce', () => {
    const demo = new DemoListingSource();
    expect(demo.supports({ kind: 'url', url: 'https://www.airbnb.fr/rooms/1' })).toBe(false);
    expect(demo.supports({ kind: 'demo' })).toBe(true);
  });
});

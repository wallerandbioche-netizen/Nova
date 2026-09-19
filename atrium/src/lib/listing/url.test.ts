import { describe, expect, it } from 'vitest';
import { looksLikeAirbnbUrl, parseAirbnbUrl } from './url';

describe('parseAirbnbUrl', () => {
  it('extrait un identifiant numérique', () => {
    const parsed = parseAirbnbUrl('https://www.airbnb.fr/rooms/12345678?adults=2');
    expect(parsed.listingId).toBe('12345678');
    expect(parsed.canonicalUrl).toBe('https://www.airbnb.fr/rooms/12345678');
  });

  it('accepte les domaines nationaux et les URL sans schéma', () => {
    expect(parseAirbnbUrl('airbnb.co.uk/rooms/99').listingId).toBe('99');
    expect(parseAirbnbUrl('https://airbnb.com/rooms/plus/42').listingId).toBe('42');
  });

  it('accepte les liens courts /h/slug', () => {
    expect(parseAirbnbUrl('https://www.airbnb.fr/h/villa-olivia').listingId).toBe('villa-olivia');
  });

  it('rejette les autres hôtes et chemins', () => {
    expect(looksLikeAirbnbUrl('https://example.com/rooms/1')).toBe(false);
    expect(looksLikeAirbnbUrl('https://www.airbnb.fr/s/Paris/homes')).toBe(false);
    expect(looksLikeAirbnbUrl('not a url')).toBe(false);
    // Un domaine qui contient « airbnb » sans en être un ne doit pas passer.
    expect(looksLikeAirbnbUrl('https://airbnb.evil.com/rooms/1')).toBe(false);
  });
});

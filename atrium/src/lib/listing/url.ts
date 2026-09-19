import { atriumError } from '@/lib/errors';

export interface ParsedAirbnbUrl {
  listingId: string;
  canonicalUrl: string;
  host: string;
}

const AIRBNB_HOST = /(^|\.)airbnb\.[a-z]{2,3}(\.[a-z]{2})?$/i;

/** Vrai pour n'importe quel domaine Airbnb national (airbnb.fr, airbnb.co.uk…). */
export function isAirbnbHost(host: string): boolean {
  return AIRBNB_HOST.test(host);
}

/**
 * Extrait l'identifiant d'annonce d'une URL Airbnb.
 * Accepte `/rooms/123`, `/rooms/plus/123`, `/h/slug`, avec ou sans paramètres.
 * Lève `INVALID_URL` pour tout le reste.
 */
export function parseAirbnbUrl(input: string): ParsedAirbnbUrl {
  const raw = input.trim();
  if (raw === '') throw atriumError('INVALID_URL', 'URL vide');

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw atriumError('INVALID_URL', `URL non analysable : ${raw}`);
  }

  if (!isAirbnbHost(url.hostname)) {
    throw atriumError('INVALID_URL', `Hôte non supporté : ${url.hostname}`);
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const roomsIndex = segments.indexOf('rooms');
  if (roomsIndex !== -1) {
    const candidate = segments.slice(roomsIndex + 1).find((s) => /^\d+$/.test(s));
    if (candidate) {
      return {
        listingId: candidate,
        canonicalUrl: `https://${url.hostname}/rooms/${candidate}`,
        host: url.hostname,
      };
    }
  }

  const hIndex = segments.indexOf('h');
  const slug = hIndex !== -1 ? segments[hIndex + 1] : undefined;
  if (slug) {
    return {
      listingId: slug,
      canonicalUrl: `https://${url.hostname}/h/${slug}`,
      host: url.hostname,
    };
  }

  throw atriumError('INVALID_URL', `Chemin non reconnu : ${url.pathname}`);
}

/** Validation légère utilisée par l'UI, sans lever d'exception. */
export function looksLikeAirbnbUrl(input: string): boolean {
  try {
    parseAirbnbUrl(input);
    return true;
  } catch {
    return false;
  }
}

import { env } from '@/lib/env';
import { atriumError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { robotsAllows } from './robots';
import type { FetchContext, ListingInput, ListingSource, RawListing } from './types';
import { parseAirbnbUrl } from './url';

const log = logger('airbnb');

/** Marqueurs d'une page de vérification : on s'arrête, on ne contourne pas. */
const CHALLENGE_MARKERS = /captcha|are you a human|px-captcha|challenge-platform|access denied/i;

const PHOTO_PATTERN = /https:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\\\s)]+/g;

function extractTitle(html: string): string | null {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (og?.[1]) return decodeEntities(og[1]);
  const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return title?.[1] ? decodeEntities(title[1].trim()) : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

/**
 * Extrait les photos d'une page d'annonce déjà récupérée.
 *
 * Volontairement conservateur : on ne suit que des URL d'images publiques
 * clairement identifiables, on normalise leur taille demandée et on garde
 * l'ordre d'apparition, qui reflète l'ordre de la galerie.
 */
export function extractPhotoUrls(html: string, limit = 40): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  // Les URL présentes dans le JSON embarqué de la page ont leurs barres
  // obliques échappées ; on les rétablit avant toute reconnaissance.
  const source = html.replace(/\\u002f/gi, '/');

  for (const match of source.matchAll(PHOTO_PATTERN)) {
    const raw = match[0];
    // Deux variantes de taille de la même photo ne comptent que pour une.
    const identity = raw.split('?')[0] ?? raw;
    if (seen.has(identity)) continue;
    // Les vignettes de profil et les miniatures d'interface ne sont pas des
    // photos d'annonce.
    if (/\/im\/pictures\/user\//.test(identity)) continue;
    seen.add(identity);
    urls.push(`${identity}?im_w=1440`);
    if (urls.length >= limit) break;
  }

  return urls;
}

/**
 * Source Airbnb.
 *
 * Les photos de l'annonce sont récupérées depuis sa page publique, après
 * vérification de `robots.txt` et avec un user-agent déclaré. Aucune
 * protection anti-robot n'est contournée : une page de vérification, un refus
 * ou une absence de photo interrompent la récupération avec une erreur.
 *
 * Cette source ne se rabat jamais sur autre chose. Un lien qu'on ne peut pas
 * lire doit le dire ; substituer d'autres photos serait mentir sur le contenu
 * de la vidéo. `AIRBNB_FETCH_MODE=disabled` refuse toute URL d'annonce, pour
 * un déploiement qui ne veut fonctionner que par import de photos.
 */
export class AirbnbListingSource implements ListingSource {
  readonly id = 'airbnb';
  readonly label = 'Annonce Airbnb';

  supports(input: ListingInput): boolean {
    if (input.kind !== 'url') return false;
    try {
      parseAirbnbUrl(input.url);
      return true;
    } catch {
      return false;
    }
  }

  async fetchListing(input: ListingInput, ctx: FetchContext): Promise<RawListing> {
    if (input.kind !== 'url') throw atriumError('SOURCE_UNAVAILABLE', 'Entrée inattendue');
    const parsed = parseAirbnbUrl(input.url);

    if (env.airbnbFetchMode === 'disabled') {
      throw atriumError(
        'SOURCE_UNAVAILABLE',
        'Récupération des annonces désactivée par configuration',
      );
    }

    return this.fetchLive(parsed.canonicalUrl, ctx);
  }

  private async fetchLive(url: string, ctx: FetchContext): Promise<RawListing> {
    const allowed = await robotsAllows(url, env.airbnbUserAgent, ctx.signal);
    if (!allowed) {
      throw atriumError('SOURCE_UNAVAILABLE', `robots.txt interdit la lecture de ${url}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'user-agent': env.airbnbUserAgent,
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
        ...(ctx.signal ? { signal: ctx.signal } : {}),
      });
    } catch (error) {
      throw atriumError('SOURCE_UNAVAILABLE', `Requête impossible : ${String(error)}`);
    }

    if (response.status === 429 || response.status === 403) {
      throw atriumError('SOURCE_UNAVAILABLE', `Accès refusé (${response.status})`);
    }
    if (!response.ok) {
      throw atriumError('SOURCE_UNAVAILABLE', `Réponse ${response.status}`);
    }

    const html = await response.text();
    if (CHALLENGE_MARKERS.test(html)) {
      // Une vérification anti-robot est une réponse claire : on s'arrête là.
      throw atriumError('SOURCE_UNAVAILABLE', 'Page de vérification renvoyée par le site');
    }

    const photos = extractPhotoUrls(html);
    log.info('annonce récupérée', { url, photos: photos.length });
    if (photos.length === 0) {
      throw atriumError('SOURCE_UNAVAILABLE', 'Aucune photo exploitable dans la page');
    }

    return {
      sourceId: this.id,
      sourceUrl: url,
      title: extractTitle(html),
      isDemo: false,
      photos: photos.map((photoUrl, index) => ({ position: index, sourceUrl: photoUrl })),
    };
  }
}

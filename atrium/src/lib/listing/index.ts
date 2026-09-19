import { env } from '@/lib/env';
import { atriumError } from '@/lib/errors';
import { AirbnbListingSource } from './airbnb';
import { LocalFolderListingSource } from './folder';
import { UploadedPhotosSource } from './upload';
import type { ListingInput, ListingSource } from './types';

export type { ListingInput, ListingSource, RawListing, RawPhoto } from './types';
export { parseAirbnbUrl, looksLikeAirbnbUrl } from './url';

/**
 * Registre des sources. Ajouter une plateforme revient à écrire une classe
 * et à l'inscrire ici : ni le pipeline ni l'interface n'en dépendent.
 */
function registry(): ListingSource[] {
  const sources: ListingSource[] = [new AirbnbListingSource(), new UploadedPhotosSource()];
  if (env.allowLocalFolderSource) sources.push(new LocalFolderListingSource());
  return sources;
}

export function resolveSource(input: ListingInput): ListingSource {
  const source = registry().find((candidate) => candidate.supports(input));
  if (!source) {
    throw atriumError(
      input.kind === 'url' ? 'INVALID_URL' : 'SOURCE_UNAVAILABLE',
      `Aucune source pour ${JSON.stringify(input)}`,
    );
  }
  return source;
}

/** Transforme la saisie brute de l'utilisateur en entrée de source typée. */
export function parseUserInput(raw: string): ListingInput {
  const value = raw.trim();
  if (value.startsWith('folder:')) {
    if (!env.allowLocalFolderSource) {
      throw atriumError('INVALID_URL', 'Source dossier local désactivée');
    }
    return { kind: 'folder', path: value.slice('folder:'.length).trim() };
  }
  return { kind: 'url', url: value };
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { atriumError } from '@/lib/errors';
import type { FetchContext, ListingInput, ListingSource, RawListing } from './types';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);

/** Liste les images d'un dossier, triées par nom pour un ordre stable. */
export async function readPhotoFolder(folder: string): Promise<string[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => null);
  if (!entries) throw atriumError('SOURCE_UNAVAILABLE', `Dossier introuvable : ${folder}`);

  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(folder, entry.name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/**
 * Dossier de photos local. C'est la source utilisée pour éprouver le moteur
 * vidéo sur de vraies photographies, sans passer par une annonce.
 */
export class LocalFolderListingSource implements ListingSource {
  readonly id = 'local_folder';
  readonly label = 'Dossier local';

  supports(input: ListingInput): boolean {
    return input.kind === 'folder';
  }

  async fetchListing(input: ListingInput, _ctx: FetchContext): Promise<RawListing> {
    void _ctx;
    if (input.kind !== 'folder') throw atriumError('SOURCE_UNAVAILABLE', 'Entrée inattendue');
    const folder = path.resolve(input.path);
    const files = await readPhotoFolder(folder);

    return {
      sourceId: this.id,
      sourceUrl: null,
      title: path.basename(folder),
      isDemo: false,
      photos: files.map((file, index) => ({ position: index, localPath: file })),
    };
  }
}

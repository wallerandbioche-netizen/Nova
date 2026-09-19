import path from 'node:path';
import { env } from '@/lib/env';
import { atriumError } from '@/lib/errors';
import { safeKey } from '@/lib/storage/local';
import { readPhotoFolder } from './folder';
import type { FetchContext, ListingInput, ListingSource, RawListing } from './types';

export function uploadDir(uploadId: string): string {
  return path.join(env.storageDir, 'uploads', safeKey(uploadId));
}

/**
 * Photos importées par l'utilisateur. C'est le chemin qui fonctionne toujours,
 * quelles que soient les conditions d'accès aux annonces en ligne.
 */
export class UploadedPhotosSource implements ListingSource {
  readonly id = 'upload';
  readonly label = 'Photos importées';

  supports(input: ListingInput): boolean {
    return input.kind === 'upload';
  }

  async fetchListing(input: ListingInput, _ctx: FetchContext): Promise<RawListing> {
    void _ctx;
    if (input.kind !== 'upload') throw atriumError('SOURCE_UNAVAILABLE', 'Entrée inattendue');
    const files = await readPhotoFolder(uploadDir(input.uploadId));

    return {
      sourceId: this.id,
      sourceUrl: null,
      title: null,
      isDemo: false,
      photos: files.map((file, index) => ({ position: index, localPath: file })),
    };
  }
}

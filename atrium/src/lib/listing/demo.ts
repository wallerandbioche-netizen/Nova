import path from 'node:path';
import { ensureSamplePhotos } from '@/lib/samples/generate';
import { SAMPLE_SCENES } from '@/lib/samples/scenes';
import type { FetchContext, ListingInput, ListingSource, RawListing } from './types';

export const DEMO_FOLDER = path.resolve(process.cwd(), 'samples/demo-listing');

/**
 * Annonce de démonstration. Les photos sont générées localement à la première
 * utilisation : le produit est testable de bout en bout sans réseau, sans clé
 * et sans dépendre d'un site tiers.
 */
export class DemoListingSource implements ListingSource {
  readonly id = 'demo';
  readonly label = 'Annonce de démonstration';

  supports(input: ListingInput): boolean {
    return input.kind === 'url';
  }

  async fetchListing(input: ListingInput, _ctx: FetchContext): Promise<RawListing> {
    void _ctx;
    const photos = await ensureSamplePhotos(DEMO_FOLDER);
    const captions = new Map(SAMPLE_SCENES.map((scene) => [scene.file, scene.caption]));

    return {
      sourceId: this.id,
      sourceUrl: input.kind === 'url' ? input.url : null,
      title: 'Villa Olivia — démonstration',
      isDemo: true,
      photos: photos.map((photo, index) => ({
        position: index,
        localPath: photo.absolutePath,
        ...(captions.get(photo.file) ? { caption: captions.get(photo.file)! } : {}),
      })),
    };
  }
}

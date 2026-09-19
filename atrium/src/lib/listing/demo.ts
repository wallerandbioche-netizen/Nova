import path from 'node:path';
import { atriumError } from '@/lib/errors';
import { ensureSamplePhotos } from '@/lib/samples/generate';
import { SAMPLE_SCENES } from '@/lib/samples/scenes';
import type { FetchContext, ListingInput, ListingSource, RawListing } from './types';

export const DEMO_FOLDER = path.resolve(process.cwd(), 'samples/demo-listing');

/**
 * Annonce de démonstration.
 *
 * Elle n'est servie que lorsqu'elle est demandée explicitement. Elle n'est
 * jamais substituée aux photos d'une vraie annonce : un lien qu'on ne peut pas
 * lire doit produire une erreur, pas des images qui ne sont pas les vôtres.
 *
 * Les photos sont dessinées localement à la première utilisation. Elles
 * servent à éprouver le moteur — cadrage, mouvements, transitions — sur des
 * formats et des compositions variés, pas à illustrer un logement.
 */
export class DemoListingSource implements ListingSource {
  readonly id = 'demo';
  readonly label = 'Démonstration';

  supports(input: ListingInput): boolean {
    return input.kind === 'demo';
  }

  async fetchListing(input: ListingInput, _ctx: FetchContext): Promise<RawListing> {
    void _ctx;
    if (input.kind !== 'demo') throw atriumError('SOURCE_UNAVAILABLE', 'Entrée inattendue');

    const photos = await ensureSamplePhotos(DEMO_FOLDER);
    const captions = new Map(SAMPLE_SCENES.map((scene) => [scene.file, scene.caption]));

    return {
      sourceId: this.id,
      sourceUrl: null,
      title: 'Démonstration',
      isDemo: true,
      photos: photos.map((photo, index) => ({
        position: index,
        localPath: photo.absolutePath,
        ...(captions.get(photo.file) ? { caption: captions.get(photo.file)! } : {}),
      })),
    };
  }
}

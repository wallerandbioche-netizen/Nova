import type { ImportSource } from '@prisma/client';
import { ensureDemoAssets, DEMO_PHOTOS } from '../demo/assets';
import type { ImportResult, ListingImporter } from './types';

/**
 * Demo mode: `https://demo.nova.studio/villa` (or any /demo URL) returns a full, local photo set.
 * It exists so the whole pipeline — selection, storyboard, render, download — can be exercised
 * end to end without depending on any third-party platform.
 */
export class DemoImporter implements ListingImporter {
  readonly platform: ImportSource = 'DEMO';
  readonly label = 'Démonstration';

  supports(url: URL): boolean {
    return (
      url.hostname === 'demo.nova.studio' ||
      url.hostname === 'demo' ||
      url.pathname.startsWith('/demo')
    );
  }

  async import(_url: URL): Promise<ImportResult> {
    const files = await ensureDemoAssets();
    return {
      platform: this.platform,
      title: 'Villa Bellevue — démonstration',
      location: 'Saint-Paul-de-Vence',
      images: files.map((file, index) => ({
        url: file.publicPath,
        hint: DEMO_PHOTOS[index]?.hint,
        width: file.width,
        height: file.height,
        priority: 100 - index,
      })),
      notice: 'Jeu de photos de démonstration généré localement.',
    };
  }
}

import type { ImportSource } from '@prisma/client';
import { AppError } from '../errors';
import { fetchText, isAllowedByRobots } from './http';
import { extractImageCandidates, extractMetaContent, extractTitle } from './html';
import type { ImportResult, ListingImporter } from './types';

/**
 * Reads the public sharing metadata any listing page exposes (OpenGraph, JSON-LD, <img>).
 * This is the base class every platform importer specialises.
 */
export class GenericUrlImporter implements ListingImporter {
  readonly platform: ImportSource = 'GENERIC';
  readonly label: string = 'Page web';

  supports(_url: URL): boolean {
    return true;
  }

  async import(url: URL): Promise<ImportResult> {
    if (!(await isAllowedByRobots(url))) {
      throw new AppError(
        'IMPORT_BLOCKED',
        "Le site demande à ne pas être exploré automatiquement. Importez les photos manuellement pour continuer.",
      );
    }

    const { body, finalUrl } = await fetchText(url);
    const base = new URL(finalUrl);
    const images = this.selectImages(body, base);

    if (images.length === 0) throw new AppError('NO_IMAGES_FOUND');

    return {
      platform: this.platform,
      title: extractTitle(body),
      location: this.extractLocation(body),
      images,
      notice: this.notice(images.length),
    };
  }

  protected selectImages(html: string, base: URL) {
    return extractImageCandidates(html, base);
  }

  protected extractLocation(html: string): string | undefined {
    return (
      extractMetaContent(html, 'og:locality') ??
      extractMetaContent(html, 'place:location:locality') ??
      undefined
    );
  }

  protected notice(_count: number): string | undefined {
    return undefined;
  }
}

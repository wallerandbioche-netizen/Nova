import type { ImportSource } from '@prisma/client';
import { GenericUrlImporter } from './generic';
import type { RemoteImageCandidate } from './types';

/**
 * Platform importers.
 *
 * None of these bypass a CAPTCHA, log in, or work around anti-bot protection. They read the same
 * public metadata a link preview would, and when a platform does not expose it — which is the
 * normal case for Airbnb and Booking today — the import returns an honest, empty result and the
 * product offers manual upload. When an official partner API becomes available, it plugs in here
 * without touching the rest of the application.
 */

export class AirbnbImporter extends GenericUrlImporter {
  override readonly platform: ImportSource = 'AIRBNB';
  override readonly label = 'Airbnb';

  override supports(url: URL): boolean {
    return /(^|\.)airbnb\.[a-z.]+$/i.test(url.hostname);
  }

  protected override notice(count: number): string | undefined {
    return count < 5
      ? "Airbnb n'expose publiquement qu'une partie des photos d'une annonce. Complétez avec un import manuel si nécessaire."
      : undefined;
  }
}

export class BookingImporter extends GenericUrlImporter {
  override readonly platform: ImportSource = 'BOOKING';
  override readonly label = 'Booking.com';

  override supports(url: URL): boolean {
    return /(^|\.)booking\.com$/i.test(url.hostname);
  }

  protected override selectImages(html: string, base: URL): RemoteImageCandidate[] {
    // Booking serves several sizes of the same photo; keep the largest variant of each.
    const images = super.selectImages(html, base);
    const byPhoto = new Map<string, RemoteImageCandidate>();
    for (const image of images) {
      const identity = image.url.replace(/\/(max|square)\d+[^/]*\//i, '/SIZE/');
      const current = byPhoto.get(identity);
      if (!current || sizeHint(image.url) > sizeHint(current.url)) byPhoto.set(identity, image);
    }
    return [...byPhoto.values()];
  }
}

export class VrboImporter extends GenericUrlImporter {
  override readonly platform: ImportSource = 'VRBO';
  override readonly label = 'Vrbo';

  override supports(url: URL): boolean {
    return /(^|\.)(vrbo\.com|abritel\.fr|homeaway\.[a-z.]+)$/i.test(url.hostname);
  }
}

function sizeHint(url: string): number {
  const match = /(?:max|square|_)(\d{3,4})/i.exec(url);
  return match?.[1] ? Number(match[1]) : 0;
}

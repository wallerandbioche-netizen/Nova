import type { ImportSource } from '@prisma/client';
import { AppError } from '../errors';
import { DemoImporter } from './demo';
import { GenericUrlImporter } from './generic';
import { AirbnbImporter, BookingImporter, VrboImporter } from './platforms';
import type { ImportResult, ListingImporter } from './types';
import { parseListingUrl } from './url';

export type { ImportResult, ListingImporter, RemoteImageCandidate } from './types';
export { parseListingUrl, isPrivateHost } from './url';

const importers: ListingImporter[] = [
  new DemoImporter(),
  new AirbnbImporter(),
  new BookingImporter(),
  new VrboImporter(),
];

const fallback = new GenericUrlImporter();

export function resolveImporter(url: URL): ListingImporter {
  return importers.find((importer) => importer.supports(url)) ?? fallback;
}

export function detectPlatform(rawUrl: string): { platform: ImportSource; label: string } | null {
  try {
    const url = parseListingUrl(rawUrl);
    const importer = resolveImporter(url);
    return { platform: importer.platform, label: importer.label };
  } catch {
    return null;
  }
}

/**
 * Runs the right importer for a URL.
 * Any failure is translated into an AppError carrying the manual-upload recovery path, so the
 * user is never stuck on a dead end.
 */
export async function importListing(rawUrl: string): Promise<ImportResult> {
  const url = parseListingUrl(rawUrl);
  const importer = resolveImporter(url);
  try {
    const result = await importer.import(url);
    if (result.images.length === 0) throw new AppError('NO_IMAGES_FOUND');
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('IMPORT_BLOCKED', undefined, { cause: error });
  }
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Listing, ListingImage } from '@prisma/client';
import { prisma } from '../lib/db';
import { getEnv } from '../lib/config/env';
import { AppError } from '../lib/errors';
import { fetchBinary } from '../lib/importers/http';
import { importListing, parseListingUrl, resolveImporter } from '../lib/importers';
import { selectImages } from '../lib/selection';
import { getStorage, storageKeys } from '../lib/storage';
import { ingestImage, markDuplicates } from './images';

export interface ImportOutcome {
  listing: Listing & { images: ListingImage[] };
  /** Ids the automatic selection recommends, in narrative order. */
  suggestedSelection: string[];
  notice?: string | undefined;
}

/**
 * Imports a listing URL into a Listing with real, analysed, stored photos.
 *
 * Failures are first-class: the listing row is still created, marked NEEDS_MANUAL_UPLOAD, and
 * the user is sent to manual upload with an explanation — never to an empty screen.
 */
export async function importListingForUser(userId: string, rawUrl: string): Promise<ImportOutcome> {
  const url = parseListingUrl(rawUrl);
  const importer = resolveImporter(url);

  const listing = await prisma.listing.create({
    data: {
      userId,
      sourceUrl: url.toString(),
      sourcePlatform: importer.platform,
      status: 'IMPORTING',
    },
  });

  try {
    const result = await importListing(rawUrl);
    const env = getEnv();
    const candidates = result.images.slice(0, env.MAX_IMAGES_PER_LISTING);

    let sortOrder = 0;
    const failures: string[] = [];
    for (const candidate of candidates) {
      try {
        const buffer = await loadCandidate(candidate.url, env.MAX_UPLOAD_BYTES);
        await ingestImage({
          userId,
          listingId: listing.id,
          buffer,
          originalUrl: candidate.url.startsWith('http') ? candidate.url : undefined,
          hint: candidate.hint,
          sortOrder,
        });
        sortOrder += 1;
      } catch {
        // One unreachable or unusable photo must not abort an otherwise good import.
        failures.push(candidate.url);
      }
    }

    if (sortOrder === 0) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { status: 'NEEDS_MANUAL_UPLOAD', importNotice: 'Aucune photo exploitable.' },
      });
      throw new AppError('NO_IMAGES_FOUND');
    }

    await markDuplicates(listing.id);

    const notice =
      failures.length > 0
        ? `${sortOrder} photos importées, ${failures.length} inaccessibles.`
        : result.notice;

    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        status: 'READY',
        title: result.title ?? null,
        location: result.location ?? null,
        importedAt: new Date(),
        importNotice: notice ?? null,
      },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });

    return {
      listing: updated,
      suggestedSelection: suggestSelection(updated.images),
      notice: notice ?? undefined,
    };
  } catch (error) {
    await prisma.listing
      .update({
        where: { id: listing.id },
        data: {
          status: 'NEEDS_MANUAL_UPLOAD',
          importNotice: error instanceof AppError ? error.message : 'Import automatique impossible.',
        },
      })
      .catch(() => {});
    throw error;
  }
}

/** Creates an empty listing for the manual upload path. */
export async function createManualListing(userId: string, title?: string): Promise<Listing> {
  return prisma.listing.create({
    data: {
      userId,
      sourcePlatform: 'MANUAL',
      status: 'NEEDS_MANUAL_UPLOAD',
      title: title ?? null,
    },
  });
}

export function suggestSelection(images: ListingImage[]): string[] {
  const { selected } = selectImages(
    images.map((image) => ({
      id: image.id,
      width: image.width,
      height: image.height,
      quality: image.quality,
      sharpness: image.sharpness ?? 0.5,
      phash: image.phash,
      room: image.roomType,
      sortOrder: image.sortOrder,
    })),
  );
  return selected.map((image) => image.id);
}

/** Loads a candidate photo: a demo asset from disk, anything else over HTTP. */
async function loadCandidate(source: string, maxBytes: number): Promise<Buffer> {
  if (source.startsWith('/')) {
    const filePath = path.resolve(process.cwd(), 'public', source.replace(/^\/+/, ''));
    const publicRoot = path.resolve(process.cwd(), 'public');
    if (!filePath.startsWith(publicRoot + path.sep)) throw new AppError('IMAGES_UNREACHABLE');
    return readFile(filePath);
  }
  const { body } = await fetchBinary(new URL(source), maxBytes);
  return body;
}

/** Deletes a listing, its photos and every stored byte that belongs to it. */
export async function deleteListing(userId: string, listingId: string): Promise<void> {
  const listing = await prisma.listing.findFirst({ where: { id: listingId, userId } });
  if (!listing) throw new AppError('NOT_FOUND');
  await getStorage().deletePrefix(storageKeys.listingPrefix(userId, listingId)).catch(() => {});
  await prisma.listing.delete({ where: { id: listingId } });
}

/** Loads a listing the caller is allowed to see, or throws. */
export async function requireListing(
  userId: string,
  listingId: string,
): Promise<Listing & { images: ListingImage[] }> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, userId },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!listing) throw new AppError('NOT_FOUND');
  return listing;
}

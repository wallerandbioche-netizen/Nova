import sharp from 'sharp';
import type { ListingImage, Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { getEnv } from '../lib/config/env';
import { AppError } from '../lib/errors';
import { getImageAnalyzer } from '../lib/image-analysis';
import { getStorage, storageKeys } from '../lib/storage';

/** The widest edge we keep. Beyond 1080p output, extra pixels cost storage and buy nothing. */
const MAX_EDGE = 2560;
const THUMBNAIL_EDGE = 480;
const MIN_WIDTH = 640;

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export interface IngestInput {
  userId: string;
  listingId: string;
  buffer: Buffer;
  originalUrl?: string | undefined;
  hint?: string | undefined;
  sortOrder: number;
}

/**
 * Normalises, analyses, stores and records one photo.
 *
 * Everything the product later needs — dimensions, sharpness, hash, room, focal point — is
 * computed once, here, and cached on the row. A regeneration never re-reads or re-analyses a
 * photo it already has.
 */
export async function ingestImage(input: IngestInput): Promise<ListingImage> {
  const storage = getStorage();

  const probe = sharp(input.buffer, { failOn: 'none' });
  const metadata = await probe.metadata().catch(() => null);
  if (!metadata?.width || !metadata.height) {
    throw new AppError('UNSUPPORTED_FILE_TYPE', "Ce fichier n'est pas une image lisible.");
  }
  if (metadata.width < MIN_WIDTH && metadata.height < MIN_WIDTH) {
    throw new AppError('RESOLUTION_TOO_LOW');
  }

  // EXIF rotation is applied once, here, so every later stage sees the photo as the eye does.
  const normalised = await sharp(input.buffer, { failOn: 'none' })
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const analysis = await getImageAnalyzer().analyze({
    buffer: normalised,
    hint: input.hint,
  });

  const thumbnail = await sharp(normalised)
    .resize(THUMBNAIL_EDGE, THUMBNAIL_EDGE, { fit: 'inside' })
    .webp({ quality: 72 })
    .toBuffer();

  const image = await prisma.listingImage.create({
    data: {
      listingId: input.listingId,
      originalUrl: input.originalUrl ?? null,
      storageKey: '',
      width: analysis.width,
      height: analysis.height,
      format: 'jpeg',
      bytes: normalised.byteLength,
      sortOrder: input.sortOrder,
      phash: analysis.phash,
      sharpness: analysis.sharpness,
      brightness: analysis.brightness,
      quality: analysis.quality,
      roomType: analysis.room,
      roomConfidence: analysis.roomConfidence,
      focalX: analysis.focalX,
      focalY: analysis.focalY,
      analyzedAt: new Date(),
      metadata: (input.hint ? { hint: input.hint } : {}) as Prisma.InputJsonValue,
    },
  });

  const key = storageKeys.listingImage(input.userId, input.listingId, image.id, 'jpg');
  const thumbnailKey = storageKeys.listingThumbnail(input.userId, input.listingId, image.id);

  try {
    await storage.put({ key, body: normalised, contentType: 'image/jpeg' });
    await storage.put({ key: thumbnailKey, body: thumbnail, contentType: 'image/webp' });
  } catch (cause) {
    // Never leave a row pointing at bytes that are not there.
    await prisma.listingImage.delete({ where: { id: image.id } }).catch(() => {});
    throw cause instanceof AppError ? cause : new AppError('STORAGE_UNAVAILABLE', undefined, { cause });
  }

  return prisma.listingImage.update({
    where: { id: image.id },
    data: { storageKey: key, thumbnailKey },
  });
}

/** Flags near-duplicates inside a listing so the UI can show why a photo was left out. */
export async function markDuplicates(listingId: string): Promise<void> {
  const { hammingDistance, DUPLICATE_THRESHOLD } = await import('../lib/image-analysis/phash');
  const images = await prisma.listingImage.findMany({
    where: { listingId },
    orderBy: [{ quality: 'desc' }, { sortOrder: 'asc' }],
  });

  const keepers: typeof images = [];
  for (const image of images) {
    const duplicate = keepers.find(
      (other) =>
        image.phash && other.phash && hammingDistance(image.phash, other.phash) <= DUPLICATE_THRESHOLD,
    );
    if (duplicate) {
      await prisma.listingImage.update({
        where: { id: image.id },
        data: { duplicateOfId: duplicate.id },
      });
    } else {
      keepers.push(image);
    }
  }
}

export function assertUploadAcceptable(file: { size: number; type: string }): void {
  const env = getEnv();
  if (file.size > env.MAX_UPLOAD_BYTES) throw new AppError('FILE_TOO_LARGE');
  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    throw new AppError('UNSUPPORTED_FILE_TYPE');
  }
}

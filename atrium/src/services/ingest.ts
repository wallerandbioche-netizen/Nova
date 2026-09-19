import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { atriumError } from '@/lib/errors';
import { perceptualHash } from '@/lib/images/hash';
import type { RawListing, RawPhoto } from '@/lib/listing';
import { logger } from '@/lib/logger';
import { newId } from '@/lib/id';
import { storage } from '@/lib/storage/local';
import type { Image } from '@/types/domain';

const log = logger('ingest');

/** Au-delà, une annonce apporte surtout des redites. */
const MAX_PHOTOS = 40;
/** Plus haute définition conservée : au-delà, le rendu ne gagne rien. */
const MAX_EDGE = 2800;
const MAX_DOWNLOAD_BYTES = 16 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 20_000;

async function readPhoto(photo: RawPhoto, signal: AbortSignal | undefined): Promise<Buffer> {
  if (photo.localPath) return fs.readFile(photo.localPath);
  if (!photo.sourceUrl) throw new Error('Photo sans source');

  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const response = await fetch(photo.sourceUrl, { signal: composite, redirect: 'follow' });
  if (!response.ok) throw new Error(`Réponse ${response.status}`);

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) throw new Error(`Type inattendu : ${contentType}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('Image trop lourde');
  return buffer;
}

export interface IngestOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Récupère les photos d'une annonce et les normalise dans l'espace du projet.
 *
 * Chaque photo est réorientée selon ses métadonnées, ramenée à une définition
 * de travail et réencodée : le reste du pipeline ne manipule ensuite que des
 * fichiers homogènes, dont les dimensions sont connues.
 */
export async function ingestListing(
  projectId: string,
  listing: RawListing,
  options: IngestOptions = {},
): Promise<Image[]> {
  const store = storage();
  await store.projectDir(projectId);

  const photos = listing.photos.slice(0, MAX_PHOTOS);
  const images: Image[] = [];

  for (const [index, photo] of photos.entries()) {
    options.signal?.throwIfAborted();
    const slug = String(index + 1).padStart(2, '0');
    const key = `source/photo_${slug}.jpg`;

    try {
      const input = await readPhoto(photo, options.signal);
      const normalized = await sharp(input, { failOn: 'none' })
        .rotate()
        .removeAlpha()
        .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
        .toBuffer();

      const absolute = await store.write(projectId, key, normalized);
      const metadata = await sharp(absolute).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (width < 320 || height < 320) throw new Error('Photo trop petite');

      images.push({
        id: newId('img'),
        projectId,
        path: key,
        sourceUrl: photo.sourceUrl ?? null,
        order: index,
        width,
        height,
        orientation:
          Math.abs(width - height) / Math.max(width, height) < 0.06
            ? 'square'
            : width > height
              ? 'landscape'
              : 'portrait',
        hash: await perceptualHash(absolute),
        duplicateOf: null,
        analysis: null,
        score: 0,
        selected: false,
      });
    } catch (error) {
      // Une photo illisible ne doit pas faire échouer l'annonce entière.
      log.warn(`photo ${slug} ignorée`, String(error));
    }

    options.onProgress?.(index + 1, photos.length);
  }

  if (images.length < 3) {
    throw atriumError('NOT_ENOUGH_PHOTOS', `${images.length} photo(s) exploitable(s)`);
  }

  return images;
}

/** Légendes d'origine, indexées par position, pour l'étape d'analyse. */
export function captionsByPosition(listing: RawListing): Map<number, string> {
  const captions = new Map<number, string>();
  for (const photo of listing.photos) {
    if (photo.caption) captions.set(photo.position, photo.caption);
  }
  return captions;
}

export function absolutePath(projectId: string, image: Image): string {
  return path.join(storage().resolve(projectId, image.path));
}

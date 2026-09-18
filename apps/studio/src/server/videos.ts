import { randomInt } from 'node:crypto';
import type { AspectRatio, DurationPreset, Video, VideoStyle } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppError } from '../lib/errors';
import { getFormat } from '../lib/video/formats';
import { MIN_IMAGES } from '../lib/video/storyboard';
import { getStorage, storageKeys } from '../lib/storage';
import { requireListing } from './listings';

export interface CreateVideoInput {
  userId: string;
  listingId: string;
  imageIds: string[];
  name?: string | undefined;
  style: VideoStyle;
  aspectRatio: AspectRatio;
  duration: DurationPreset;
}

/**
 * Creates a video project in DRAFT. Nothing is rendered and nothing is charged here — the job
 * queue owns both, so an HTTP request never waits on a render.
 */
export async function createVideo(input: CreateVideoInput): Promise<Video> {
  const listing = await requireListing(input.userId, input.listingId);

  const known = new Set(listing.images.map((image) => image.id));
  const imageIds = input.imageIds.filter((id) => known.has(id));
  if (imageIds.length !== input.imageIds.length) {
    throw new AppError('VALIDATION_FAILED', 'Certaines photos ne font pas partie de cette annonce.');
  }
  if (imageIds.length < MIN_IMAGES) throw new AppError('NOT_ENOUGH_IMAGES');

  const format = getFormat(input.aspectRatio);

  return prisma.video.create({
    data: {
      userId: input.userId,
      listingId: input.listingId,
      name: input.name?.trim() || defaultName(listing.title),
      style: input.style,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      width: format.width,
      height: format.height,
      imageOrder: imageIds,
      // A fresh seed per project; reused on every regeneration of that project so the same
      // settings always give the same edit back.
      seed: randomInt(1, 2 ** 31 - 1),
      status: 'DRAFT',
    },
  });
}

export interface UpdateVideoInput {
  name?: string | undefined;
  style?: VideoStyle | undefined;
  aspectRatio?: AspectRatio | undefined;
  duration?: DurationPreset | undefined;
  imageIds?: string[] | undefined;
}

export async function updateVideo(
  userId: string,
  videoId: string,
  input: UpdateVideoInput,
): Promise<Video> {
  const video = await requireVideo(userId, videoId);
  if (video.status === 'QUEUED' || video.status === 'PROCESSING' || video.status === 'RENDERING') {
    throw new AppError('CONFLICT', 'Cette vidéo est en cours de génération.');
  }

  let imageOrder: string[] | undefined;
  if (input.imageIds) {
    const listing = await requireListing(userId, video.listingId);
    const known = new Set(listing.images.map((image) => image.id));
    imageOrder = input.imageIds.filter((id) => known.has(id));
    if (imageOrder.length < MIN_IMAGES) throw new AppError('NOT_ENOUGH_IMAGES');
  }

  const format = input.aspectRatio ? getFormat(input.aspectRatio) : null;

  return prisma.video.update({
    where: { id: videoId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || video.name } : {}),
      ...(input.style ? { style: input.style } : {}),
      ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
      ...(format ? { width: format.width, height: format.height } : {}),
      ...(input.duration ? { duration: input.duration } : {}),
      ...(imageOrder ? { imageOrder } : {}),
    },
  });
}

export async function requireVideo(userId: string, videoId: string): Promise<Video> {
  const video = await prisma.video.findFirst({ where: { id: videoId, userId } });
  if (!video) throw new AppError('NOT_FOUND');
  return video;
}

/** Copies a project's settings into a new draft — the "duplicate" action. */
export async function duplicateVideo(userId: string, videoId: string): Promise<Video> {
  const video = await requireVideo(userId, videoId);
  return prisma.video.create({
    data: {
      userId,
      listingId: video.listingId,
      name: `${video.name} (copie)`,
      style: video.style,
      aspectRatio: video.aspectRatio,
      duration: video.duration,
      width: video.width,
      height: video.height,
      imageOrder: video.imageOrder,
      seed: randomInt(1, 2 ** 31 - 1),
      status: 'DRAFT',
    },
  });
}

export async function deleteVideo(userId: string, videoId: string): Promise<void> {
  const video = await requireVideo(userId, videoId);
  await getStorage().deletePrefix(storageKeys.videoPrefix(userId, video.id)).catch(() => {});
  await prisma.video.delete({ where: { id: video.id } });
}

export async function listVideos(userId: string, limit = 50) {
  return prisma.video.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      listing: { select: { title: true, sourcePlatform: true } },
      jobs: { orderBy: { queuedAt: 'desc' }, take: 1 },
    },
  });
}

function defaultName(listingTitle: string | null): string {
  const base = listingTitle?.trim();
  if (base) return base.slice(0, 80);
  const now = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
  return `Ma vidéo — ${now}`;
}

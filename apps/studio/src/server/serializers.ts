import type { GenerationJob, Listing, ListingImage, Video } from '@prisma/client';
import { getStorage } from '../lib/storage';
import { ROOM_LABELS } from '../lib/image-analysis/rooms';
import { STAGE_LABELS } from './render-service';

const THUMBNAIL_TTL_SECONDS = 60 * 60;
const VIDEO_TTL_SECONDS = 60 * 30;

export interface SerialisedImage {
  id: string;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape' | 'square';
  quality: number;
  room: string;
  roomLabel: string;
  isDuplicate: boolean;
  sortOrder: number;
  thumbnailUrl: string;
}

/** Only ever hands the client a thumbnail URL — full-size photos stay on the server. */
export async function serialiseImage(image: ListingImage): Promise<SerialisedImage> {
  const storage = getStorage();
  const key = image.thumbnailKey ?? image.storageKey;
  return {
    id: image.id,
    width: image.width,
    height: image.height,
    orientation:
      image.width === image.height ? 'square' : image.width > image.height ? 'landscape' : 'portrait',
    quality: Number(image.quality.toFixed(2)),
    room: image.roomType,
    roomLabel: ROOM_LABELS[image.roomType],
    isDuplicate: Boolean(image.duplicateOfId),
    sortOrder: image.sortOrder,
    thumbnailUrl: await storage.signedUrl(key, THUMBNAIL_TTL_SECONDS),
  };
}

export async function serialiseListing(listing: Listing & { images: ListingImage[] }) {
  return {
    id: listing.id,
    title: listing.title,
    location: listing.location,
    sourceUrl: listing.sourceUrl,
    platform: listing.sourcePlatform,
    status: listing.status,
    notice: listing.importNotice,
    createdAt: listing.createdAt.toISOString(),
    images: await Promise.all(
      [...listing.images].sort((a, b) => a.sortOrder - b.sortOrder).map(serialiseImage),
    ),
  };
}

export async function serialiseVideo(
  video: Video & { jobs?: GenerationJob[]; listing?: { title: string | null } | null },
) {
  const storage = getStorage();
  const job = video.jobs?.[0];

  return {
    id: video.id,
    name: video.name,
    listingId: video.listingId,
    listingTitle: video.listing?.title ?? null,
    style: video.style,
    aspectRatio: video.aspectRatio,
    duration: video.duration,
    status: video.status,
    width: video.width,
    height: video.height,
    fps: video.fps,
    durationSeconds: video.durationSeconds,
    bytes: video.bytes,
    imageIds: video.imageOrder,
    error: video.errorCode ? { code: video.errorCode, message: video.errorMessage } : null,
    createdAt: video.createdAt.toISOString(),
    completedAt: video.completedAt?.toISOString() ?? null,
    videoUrl: video.storageKey ? await storage.signedUrl(video.storageKey, VIDEO_TTL_SECONDS) : null,
    posterUrl: video.thumbnailKey
      ? await storage.signedUrl(video.thumbnailKey, THUMBNAIL_TTL_SECONDS)
      : null,
    job: job ? serialiseJob(job) : null,
  };
}

export function serialiseJob(job: GenerationJob) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    stageLabel: STAGE_LABELS[job.stage] ?? job.stage,
    progress: job.progress,
    error: job.error,
    queuedAt: job.queuedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

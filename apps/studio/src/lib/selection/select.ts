import type { RoomType } from '@prisma/client';
import { hammingDistance, DUPLICATE_THRESHOLD, SIMILARITY_THRESHOLD } from '../image-analysis/phash';
import { isOutdoor } from '../image-analysis/rooms';

export interface SelectableImage {
  id: string;
  width: number;
  height: number;
  quality: number;
  sharpness: number;
  phash: string | null;
  room: RoomType;
  /** Position in the source listing: a proxy for "the owner put their best photo first". */
  sortOrder: number;
}

export interface SelectionOptions {
  /** Photos narrower than this are never used: they would be upscaled on screen. */
  minWidth?: number;
  maxImages?: number;
  minImages?: number;
  /** How many photos of the same room may appear. */
  maxPerRoom?: number;
}

export interface SelectionResult {
  selected: SelectableImage[];
  /** Why each rejected photo was left out, so the UI can explain itself. */
  rejected: { image: SelectableImage; reason: RejectionReason }[];
}

export type RejectionReason =
  | 'TOO_SMALL'
  | 'DUPLICATE'
  | 'TOO_SIMILAR'
  | 'LOW_QUALITY'
  | 'ROOM_QUOTA'
  | 'OVER_LIMIT';

const DEFAULTS = {
  minWidth: 640,
  maxImages: 18,
  minImages: 3,
  maxPerRoom: 3,
} as const;

/**
 * Picks the photos that will actually make a good video.
 *
 * The order of operations matters: hard disqualifications first (too small), then duplicates,
 * then near-duplicates, then a per-room quota so a listing with nine sofa shots does not produce
 * nine seconds of sofa. Within every step the best-scoring photo wins, and the listing's own
 * first photo keeps a bonus — owners lead with their best shot.
 */
export function selectImages(
  images: SelectableImage[],
  options: SelectionOptions = {},
): SelectionResult {
  const config = { ...DEFAULTS, ...options };
  const rejected: SelectionResult['rejected'] = [];

  const usable = images.filter((image) => {
    if (image.width < config.minWidth) {
      rejected.push({ image, reason: 'TOO_SMALL' });
      return false;
    }
    return true;
  });

  const ranked = [...usable].sort((a, b) => score(b) - score(a));

  const kept: SelectableImage[] = [];
  const roomCount = new Map<RoomType, number>();

  for (const image of ranked) {
    const duplicateOf = kept.find(
      (other) => image.phash && other.phash && hammingDistance(image.phash, other.phash) <= DUPLICATE_THRESHOLD,
    );
    if (duplicateOf) {
      rejected.push({ image, reason: 'DUPLICATE' });
      continue;
    }

    const similarCount = kept.filter(
      (other) =>
        image.phash &&
        other.phash &&
        hammingDistance(image.phash, other.phash) <= SIMILARITY_THRESHOLD,
    ).length;
    if (similarCount >= 1 && image.room !== 'OTHER' && (roomCount.get(image.room) ?? 0) >= 1) {
      rejected.push({ image, reason: 'TOO_SIMILAR' });
      continue;
    }

    const count = roomCount.get(image.room) ?? 0;
    if (image.room !== 'OTHER' && count >= config.maxPerRoom) {
      rejected.push({ image, reason: 'ROOM_QUOTA' });
      continue;
    }

    kept.push(image);
    roomCount.set(image.room, count + 1);
  }

  // Keep the strongest ones when there are more than a video can carry.
  const withinLimit = kept.slice(0, config.maxImages);
  for (const image of kept.slice(config.maxImages)) {
    rejected.push({ image, reason: 'OVER_LIMIT' });
  }

  // A short listing is better served by a weaker photo than by no video at all.
  if (withinLimit.length < config.minImages) {
    for (const { image, reason } of [...rejected]) {
      if (withinLimit.length >= config.minImages) break;
      if (reason === 'TOO_SMALL') continue;
      withinLimit.push(image);
      rejected.splice(rejected.findIndex((r) => r.image.id === image.id), 1);
    }
  }

  return { selected: orderForNarrative(withinLimit), rejected };
}

function score(image: SelectableImage): number {
  const leadBonus = image.sortOrder === 0 ? 0.12 : image.sortOrder < 3 ? 0.05 : 0;
  return image.quality + leadBonus;
}

/**
 * Narrative order: arrive at the property, walk through it, step outside, end on the best
 * outdoor shot. Rooms that do not exist in the set are simply skipped — nothing is invented.
 */
const ROOM_SEQUENCE: RoomType[] = [
  'EXTERIOR',
  'LIVING_ROOM',
  'DINING',
  'KITCHEN',
  'BEDROOM',
  'BATHROOM',
  'OTHER',
  'TERRACE',
  'GARDEN',
  'POOL',
  'VIEW',
];

export function orderForNarrative(images: SelectableImage[]): SelectableImage[] {
  if (images.length <= 2) return [...images];

  const remaining = [...images];

  // Open on the strongest photo available, preferring an establishing outdoor shot.
  const opener =
    pickBest(remaining, (image) => image.room === 'EXTERIOR') ??
    pickBest(remaining, () => true);
  // Close on the most striking outdoor/view photo that is left.
  const closer =
    pickBest(remaining, (image) => image.room === 'VIEW' || image.room === 'POOL') ??
    pickBest(remaining, (image) => isOutdoor(image.room)) ??
    pickBest(remaining, () => true);

  const middle = remaining.sort((a, b) => {
    const roomDelta = ROOM_SEQUENCE.indexOf(a.room) - ROOM_SEQUENCE.indexOf(b.room);
    if (roomDelta !== 0) return roomDelta;
    // Within a room, the best photo leads.
    return b.quality - a.quality;
  });

  return [...(opener ? [opener] : []), ...middle, ...(closer ? [closer] : [])];
}

/** Removes and returns the best image matching a predicate. */
function pickBest(
  pool: SelectableImage[],
  predicate: (image: SelectableImage) => boolean,
): SelectableImage | null {
  let bestIndex = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < pool.length; i += 1) {
    const image = pool[i];
    if (!image || !predicate(image)) continue;
    if (image.quality > bestScore) {
      bestScore = image.quality;
      bestIndex = i;
    }
  }
  if (bestIndex === -1) return null;
  return pool.splice(bestIndex, 1)[0] ?? null;
}

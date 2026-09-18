import type { DurationPreset } from '@prisma/client';
import { clamp } from '../utils';
import type { StylePreset } from './styles';

export const DURATION_PRESETS: { id: DurationPreset; label: string; seconds: number | null }[] = [
  { id: 'AUTO', label: 'Automatique', seconds: null },
  { id: 'S15', label: '15 secondes', seconds: 15 },
  { id: 'S30', label: '30 secondes', seconds: 30 },
  { id: 'S45', label: '45 secondes', seconds: 45 },
];

export const MIN_DURATION_SECONDS = 8;
export const MAX_DURATION_SECONDS = 60;

/** Roughly two seconds of finished video per photo — the rule of thumb of the trade. */
const SECONDS_PER_PHOTO = 2;

/** The style that rule of thumb is calibrated on; the others scale from it. */
const REFERENCE_SHOT_SECONDS = 2.9;

/**
 * Automatic duration: ~2 s per photo, adjusted by how fast the chosen style cuts, and kept
 * inside the window a property video should live in.
 *
 * On the default style: 10 photos land near 20 s, 15 near 30 s, 20 near 40 s.
 */
export function automaticDuration(imageCount: number, style: StylePreset): number {
  const paceFactor = style.baseShotSeconds / REFERENCE_SHOT_SECONDS;
  const raw = imageCount * SECONDS_PER_PHOTO * paceFactor + 2;
  return clamp(Math.round(raw), 14, 48);
}

export function resolveTargetDuration(
  preset: DurationPreset,
  imageCount: number,
  style: StylePreset,
): number {
  const configured = DURATION_PRESETS.find((entry) => entry.id === preset)?.seconds;
  const target = configured ?? automaticDuration(imageCount, style);
  return clamp(target, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS);
}

/**
 * Splits a target duration into shot lengths.
 *
 * Every shot gets the style's base length, varied deterministically so the cut never falls on a
 * metronome, and the opening and closing shots hold a little longer — that is what makes a video
 * feel edited rather than generated. The result is then scaled to hit the target exactly.
 */
export function distributeShotDurations(
  count: number,
  targetSeconds: number,
  style: StylePreset,
  rng: () => number,
): number[] {
  if (count <= 0) return [];

  const weights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const isBookend = i === 0 || i === count - 1;
    const variation = 1 + (rng() * 2 - 1) * style.shotVariation;
    weights.push(style.baseShotSeconds * variation * (isBookend ? style.bookendMultiplier : 1));
  }

  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const scale = targetSeconds / totalWeight;

  // The style sets the floor; above ~6 s a shot stalls whatever the style.
  const floor = style.minShotSeconds * 0.8;
  return weights.map((weight) => clamp(Number((weight * scale).toFixed(3)), floor, 6));
}

/**
 * How many photos a target duration can carry at this style's pace.
 *
 * Shots overlap during transitions, so a shot only costs its length minus one transition; the
 * limit is what keeps a 15-second video from turning into a slideshow of one-second flashes.
 */
export function maxShotsForDuration(targetSeconds: number, style: StylePreset): number {
  // A shot only costs its length minus the transition it overlaps with.
  const netCostPerShot = Math.max(0.8, style.minShotSeconds - style.transitionSeconds * 0.5);
  return Math.max(3, Math.floor(targetSeconds / netCostPerShot));
}

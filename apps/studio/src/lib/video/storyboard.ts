import { AppError } from '../errors';
import { createRng } from '../utils';
import { distributeShotDurations, maxShotsForDuration, resolveTargetDuration } from './duration';
import { buildMove } from './framing';
import { getFormat } from './formats';
import { getStyle } from './styles';
import type { AnimationName, Storyboard, StoryboardInput, StoryboardScene, TransitionName } from './types';

export const MIN_IMAGES = 3;

/**
 * Builds the edit.
 *
 * Deterministic by construction: the same images, style, format, duration and seed always
 * produce the same storyboard — which is what makes a regeneration reproducible and a render
 * cacheable. Movement is chosen per photo rather than at random: a portrait photo is not panned
 * sideways, and the same move never lands on two consecutive shots.
 */
export function buildStoryboard(input: StoryboardInput): Storyboard {
  if (input.images.length < MIN_IMAGES) {
    throw new AppError('NOT_ENOUGH_IMAGES');
  }

  const style = getStyle(input.style);
  const format = getFormat(input.aspectRatio);
  const fps = input.fps ?? 30;
  const rng = createRng(input.seed);

  const targetSeconds = resolveTargetDuration(input.duration, input.images.length, style);
  const capacity = maxShotsForDuration(targetSeconds, style);
  // Keep the strongest photos when the chosen duration cannot carry them all.
  const images =
    input.images.length <= capacity
      ? input.images
      : [...input.images]
          .map((image, index) => ({ image, index }))
          .sort((a, b) => b.image.quality - a.image.quality)
          .slice(0, capacity)
          .sort((a, b) => a.index - b.index)
          .map((entry) => entry.image);

  // Shots overlap during transitions, so the finished video is shorter than the sum of its
  // shots. Add the overlap back before splitting the time, or every video would come out
  // 25-30 % shorter than the duration the user picked.
  const overlapSeconds = Math.max(0, images.length - 1) * style.transitionSeconds;
  const durations = distributeShotDurations(images.length, targetSeconds + overlapSeconds, style, rng);

  const scenes: StoryboardScene[] = [];
  let previousAnimation: AnimationName | null = null;

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const duration = durations[index];
    if (!image || duration === undefined) continue;

    const animation = pickAnimation(image, style.animations, previousAnimation, rng);
    previousAnimation = animation;

    const transitionIn: TransitionName =
      index === 0 ? 'fade' : pick(style.transitions, rng) ?? 'crossfade';
    const transitionDuration =
      index === 0 ? Math.min(0.6, style.transitionSeconds) : style.transitionSeconds;

    const { startRect, endRect } = buildMove({
      imageWidth: image.width,
      imageHeight: image.height,
      outputRatio: format.width / format.height,
      focalX: image.focalX,
      focalY: image.focalY,
      animation,
      zoomAmplitude: style.zoomAmplitude,
      panAmplitude: style.panAmplitude,
    });

    scenes.push({
      index,
      imageId: image.id,
      // Laid out on the timeline below, once every shot length is known.
      startSeconds: 0,
      durationSeconds: duration,
      animation,
      transitionIn,
      transitionDurationSeconds: transitionDuration,
      startRect,
      endRect,
    });
  }

  // Lay the scenes out, overlapping each shot with the next by its transition: that overlap
  // *is* the crossfade, and it is why the total is shorter than the sum of the shots.
  let timeline = 0;
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    if (!scene) continue;
    scene.startSeconds = Number(timeline.toFixed(3));
    timeline += scene.durationSeconds;
    const next = scenes[index + 1];
    if (next) timeline -= next.transitionDurationSeconds;
  }

  const durationSeconds = Number(timeline.toFixed(3));

  return {
    version: 1,
    style: input.style,
    aspectRatio: input.aspectRatio,
    width: format.width,
    height: format.height,
    fps,
    durationInFrames: Math.max(1, Math.round(durationSeconds * fps)),
    durationSeconds,
    scenes,
  };
}

/**
 * Chooses a move that suits the photo: vertical photos get vertical moves, wide photos get
 * horizontal ones, and the same move never repeats twice in a row.
 */
function pickAnimation(
  image: { width: number; height: number },
  allowed: AnimationName[],
  previous: AnimationName | null,
  rng: () => number,
): AnimationName {
  const portrait = image.height > image.width * 1.05;
  const landscape = image.width > image.height * 1.05;

  const suitable = allowed.filter((animation) => {
    if (portrait && (animation === 'panLeft' || animation === 'panRight')) return false;
    if (landscape && (animation === 'panUp' || animation === 'panDown')) return false;
    return animation !== previous;
  });

  const pool = suitable.length > 0 ? suitable : allowed.filter((a) => a !== previous);
  return pick(pool, rng) ?? 'slowZoomIn';
}

function pick<T>(items: T[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length) % items.length];
}

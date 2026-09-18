import { clamp } from '../utils';
import type { AnimationName, CropRect } from './types';

export interface FramingInput {
  imageWidth: number;
  imageHeight: number;
  /** Output aspect ratio as width / height. */
  outputRatio: number;
  focalX: number;
  focalY: number;
}

/**
 * Framing rules, in one place.
 *
 * 1. A photo is never stretched: every crop keeps the output aspect ratio exactly.
 * 2. A photo is never letterboxed either — the frame is always filled, the way a videographer
 *    would frame it, by cropping and moving inside the image.
 * 3. The move is built around the focal point, so the subject stays in frame from first to last
 *    frame instead of drifting onto a blank wall.
 */

/** The largest crop, in normalised units, that keeps the output ratio inside the source image. */
export function maxCoverRect(input: FramingInput): { width: number; height: number } {
  const imageRatio = input.imageWidth / input.imageHeight;
  if (imageRatio > input.outputRatio) {
    // Source is wider than the frame: full height, narrower width.
    return { width: input.outputRatio / imageRatio, height: 1 };
  }
  // Source is taller than the frame: full width, shorter height.
  return { width: 1, height: imageRatio / input.outputRatio };
}

/** How much of the source survives the crop, 0..1. Low values mean a wide photo in a tall frame. */
export function coverage(input: FramingInput): number {
  const rect = maxCoverRect(input);
  return rect.width * rect.height;
}

/** Builds a crop rect at a given zoom, centred on the focal point and clamped inside the image. */
export function rectAtZoom(input: FramingInput, zoom: number, offsetX = 0, offsetY = 0): CropRect {
  const max = maxCoverRect(input);
  const safeZoom = Math.max(1, zoom);
  const width = max.width / safeZoom;
  const height = max.height / safeZoom;

  const targetCentreX = input.focalX + offsetX;
  const targetCentreY = input.focalY + offsetY;

  return {
    x: clamp(targetCentreX - width / 2, 0, 1 - width),
    y: clamp(targetCentreY - height / 2, 0, 1 - height),
    width,
    height,
  };
}

export interface MoveInput extends FramingInput {
  animation: AnimationName;
  /** Zoom travelled over the shot, e.g. 0.08 for 8 %. */
  zoomAmplitude: number;
  /** Fraction of the available slack used by a pan, 0..1. */
  panAmplitude: number;
}

/**
 * Turns an animation name into a start and end crop.
 *
 * Pans use the slack the crop leaves inside the image, never more, so a movement is only as
 * large as the photo can actually carry. When there is no slack in a direction (a portrait photo
 * in a portrait frame has none horizontally) the pan degrades into a gentle push instead of
 * juddering against the edge.
 */
export function buildMove(input: MoveInput): { startRect: CropRect; endRect: CropRect } {
  const baseZoom = 1 + input.zoomAmplitude / 2;
  const zoomIn = { from: 1, to: 1 + input.zoomAmplitude };
  const zoomOut = { from: 1 + input.zoomAmplitude, to: 1 };

  // A wide photo in a tall frame (or the reverse) loses a lot of the image. Pan across it rather
  // than zooming further in: that is what recovers the room instead of hiding it.
  const wideMismatch = coverage(input) < 0.55;

  switch (input.animation) {
    case 'slowZoomIn':
      return pair(input, zoomIn, { x: 0, y: 0 }, { x: 0, y: 0 });
    case 'slowZoomOut':
      return pair(input, zoomOut, { x: 0, y: 0 }, { x: 0, y: 0 });
    case 'subtlePush':
      return pair(input, zoomIn, { x: 0, y: 0 }, drift(input, 'x', 0.35));
    case 'subtlePull':
      return pair(input, zoomOut, drift(input, 'y', 0.3), { x: 0, y: 0 });
    case 'panLeft':
      return panPair(input, 'x', +1, wideMismatch ? 1 : 0.8, baseZoom);
    case 'panRight':
      return panPair(input, 'x', -1, wideMismatch ? 1 : 0.8, baseZoom);
    case 'panUp':
      return panPair(input, 'y', +1, wideMismatch ? 1 : 0.8, baseZoom);
    case 'panDown':
      return panPair(input, 'y', -1, wideMismatch ? 1 : 0.8, baseZoom);
    default:
      return pair(input, zoomIn, { x: 0, y: 0 }, { x: 0, y: 0 });
  }
}

function pair(
  input: FramingInput,
  zoom: { from: number; to: number },
  startOffset: { x: number; y: number },
  endOffset: { x: number; y: number },
): { startRect: CropRect; endRect: CropRect } {
  return {
    startRect: rectAtZoom(input, zoom.from, startOffset.x, startOffset.y),
    endRect: rectAtZoom(input, zoom.to, endOffset.x, endOffset.y),
  };
}

/**
 * A pan holds the zoom and slides the crop along one axis, using at most the slack available.
 * `direction` is +1 to start left/up of the focal point and travel toward it, -1 for the reverse.
 */
function panPair(
  input: FramingInput,
  axis: 'x' | 'y',
  direction: 1 | -1,
  amplitudeScale: number,
  zoom: number,
): { startRect: CropRect; endRect: CropRect } {
  const rect = rectAtZoom(input, zoom);
  const size = axis === 'x' ? rect.width : rect.height;
  const slack = Math.max(0, 1 - size);
  const travel = slack * amplitudeScale;

  if (travel < 0.01) {
    // No room to move: a barely perceptible push reads better than a static frame.
    return pair(input, { from: 1, to: 1.03 }, { x: 0, y: 0 }, { x: 0, y: 0 });
  }

  const focal = axis === 'x' ? input.focalX : input.focalY;
  const startCentre = clamp(focal - (direction * travel) / 2, size / 2, 1 - size / 2);
  const endCentre = clamp(focal + (direction * travel) / 2, size / 2, 1 - size / 2);

  const build = (centre: number): CropRect =>
    axis === 'x'
      ? { ...rect, x: clamp(centre - rect.width / 2, 0, 1 - rect.width) }
      : { ...rect, y: clamp(centre - rect.height / 2, 0, 1 - rect.height) };

  return { startRect: build(startCentre), endRect: build(endCentre) };
}

/** A small offset along one axis, scaled by how much slack the frame leaves. */
function drift(input: FramingInput, axis: 'x' | 'y', scale: number): { x: number; y: number } {
  const rect = rectAtZoom(input, 1);
  const slack = Math.max(0, 1 - (axis === 'x' ? rect.width : rect.height));
  const amount = slack * scale * 0.5;
  return axis === 'x' ? { x: amount, y: 0 } : { x: 0, y: amount };
}

/**
 * Turns a crop rect into the CSS box of the full image inside the output frame.
 *
 * The image element is sized to `1/width` and `1/height` of the frame and shifted so the crop
 * lands exactly on the frame. Because every rect this module produces already carries the output
 * aspect ratio, the resulting box preserves the photo's own aspect ratio exactly — there is no
 * code path that can stretch a photo.
 */
export function rectToImageBox(rect: CropRect): {
  width: number;
  height: number;
  left: number;
  top: number;
} {
  // `+ 0` normalises -0, which would otherwise render as "-0%".
  return {
    width: 100 / rect.width,
    height: 100 / rect.height,
    left: -(rect.x / rect.width) * 100 + 0,
    top: -(rect.y / rect.height) * 100 + 0,
  };
}

/** Linear interpolation between two rects; the renderer eases the progress, not the geometry. */
export function interpolateRect(from: CropRect, to: CropRect, progress: number): CropRect {
  const t = clamp(progress, 0, 1);
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

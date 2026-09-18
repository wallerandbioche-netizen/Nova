import sharp from 'sharp';
import { clamp } from '../utils';
import { computeDHash } from './phash';
import { detectRoomFromHint } from './rooms';
import type { AnalyzerInput, ImageAnalysis, ImageAnalyzer } from './types';

/**
 * Local image analysis with sharp — no network, no model, no per-image cost.
 *
 * It measures what can be measured honestly: resolution, sharpness, exposure, a perceptual hash,
 * and where the visual detail sits in the frame (the focal point the camera move is built
 * around). Room type comes from the listing's own caption; when there is no caption, the room
 * stays "OTHER" rather than being invented.
 */
export class HeuristicImageAnalyzer implements ImageAnalyzer {
  readonly name = 'heuristic';

  async analyze(input: AnalyzerInput): Promise<ImageAnalysis> {
    const image = sharp(input.buffer, { failOn: 'none' });
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width === 0 || height === 0) {
      throw new Error('Image illisible : dimensions inconnues');
    }

    // One small grayscale copy drives every measurement below.
    const detailSize = 64;
    const { data: detail } = await image
      .clone()
      .greyscale()
      .resize(detailSize, detailSize, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: hashPixels } = await image
      .clone()
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const energy = gradientEnergy(detail, detailSize, detailSize);
    const sharpness = clamp(Math.sqrt(energy.mean) / 4.5, 0, 1);
    const brightness = mean(detail) / 255;
    const focal = focalPoint(energy.map, detailSize, detailSize);
    const room = detectRoomFromHint(input.hint);

    return {
      width,
      height,
      format: metadata.format ?? 'jpeg',
      bytes: input.buffer.byteLength,
      sharpness,
      brightness,
      quality: qualityScore({ width, height, sharpness, brightness }),
      phash: computeDHash(new Uint8Array(hashPixels), 9, 8),
      room: room.room,
      roomConfidence: room.confidence,
      focalX: focal.x,
      focalY: focal.y,
    };
  }
}

/**
 * Per-pixel gradient magnitude: a cheap stand-in for "how much detail is here".
 *
 * Uses forward differences rather than a central difference on purpose: a central difference
 * compares i-1 with i+1 and is therefore blind to detail that alternates every pixel — exactly
 * the fine texture that separates a sharp photo from a soft one.
 */
export function gradientEnergy(
  pixels: Uint8Array | Buffer,
  width: number,
  height: number,
): { map: Float32Array; mean: number } {
  const map = new Float32Array(width * height);
  let total = 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const i = y * width + x;
      const dx = (pixels[i + 1] ?? 0) - (pixels[i] ?? 0);
      const dy = (pixels[i + width] ?? 0) - (pixels[i] ?? 0);
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      map[i] = magnitude;
      total += magnitude;
    }
  }
  return { map, mean: total / Math.max(1, (width - 1) * (height - 1)) };
}

/**
 * Focal point = detail-weighted centroid, pulled back toward the centre.
 *
 * Interiors put their detail where the furniture and windows are; that is what the eye follows,
 * and keeping it inside the frame is what stops a Ken Burns move from panning onto a blank wall.
 * The pull toward the centre keeps the result stable when detail is spread evenly.
 */
export function focalPoint(
  energy: Float32Array,
  width: number,
  height: number,
): { x: number; y: number } {
  let weightedX = 0;
  let weightedY = 0;
  let total = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = energy[y * width + x] ?? 0;
      if (value <= 0) continue;
      weightedX += value * (x / (width - 1));
      weightedY += value * (y / (height - 1));
      total += value;
    }
  }
  if (total === 0) return { x: 0.5, y: 0.5 };

  const centreBias = 0.45;
  return {
    x: clamp(weightedX / total + (0.5 - weightedX / total) * centreBias, 0.15, 0.85),
    y: clamp(weightedY / total + (0.5 - weightedY / total) * centreBias, 0.15, 0.85),
  };
}

export interface QualityInput {
  width: number;
  height: number;
  sharpness: number;
  brightness: number;
}

/**
 * 0..1 quality score. Resolution and sharpness carry most of the weight; exposure only
 * penalises photos that are genuinely too dark or blown out.
 */
export function qualityScore({ width, height, sharpness, brightness }: QualityInput): number {
  const pixels = width * height;
  const resolution = clamp(Math.log10(pixels / 200_000) / Math.log10(10), 0, 1);
  const exposure = 1 - clamp(Math.abs(brightness - 0.52) / 0.42, 0, 1);
  const aspect = width / height;
  // Extreme panoramas crop badly into any output format.
  const shapePenalty = aspect > 3 || aspect < 0.34 ? 0.15 : 0;

  return clamp(resolution * 0.4 + sharpness * 0.4 + exposure * 0.2 - shapePenalty, 0, 1);
}

function mean(values: Uint8Array | Buffer): number {
  let total = 0;
  for (let i = 0; i < values.length; i += 1) total += values[i] ?? 0;
  return values.length === 0 ? 0 : total / values.length;
}

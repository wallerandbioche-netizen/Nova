import sharp from 'sharp';
import type { FocusPoint } from '@/types/domain';

export interface ImageStats {
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait' | 'square';
  /** Luminance moyenne, 0 → 1. */
  brightness: number;
  /** Écart-type de la luminance, normalisé — proxy de contraste. */
  contrast: number;
  /** Saturation moyenne, 0 → 1. */
  saturation: number;
  /** Énergie de gradient moyenne, normalisée — proxy de netteté. */
  sharpness: number;
  /** Part de pixels à dominante végétale. */
  greenRatio: number;
  /** Part de pixels à dominante bleue et claire (eau, ciel). */
  blueRatio: number;
  /** Part de pixels quasi brûlés : fenêtres, ciel surexposé. */
  highlightRatio: number;
  /** Centre de gravité de l'énergie visuelle, normalisé. */
  saliency: FocusPoint;
  /** Concentration de cette énergie, 0 (uniforme) → 1 (un seul sujet). */
  saliencyStrength: number;
}

const GRID = 64;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Statistiques d'une photo calculées localement, sans modèle.
 * Elles servent à la fois au scoring, au repli hors-ligne de l'analyse
 * et à la vérification des réponses du modèle de vision.
 */
export async function readImageStats(filePath: string): Promise<ImageStats> {
  const image = sharp(filePath).removeAlpha();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error(`Dimensions illisibles pour ${filePath}`);
  }

  const rgb = await sharp(filePath)
    .removeAlpha()
    .resize(GRID, GRID, { fit: 'fill' })
    .raw()
    .toBuffer();

  const luma = new Float32Array(GRID * GRID);
  let lumaSum = 0;
  let satSum = 0;
  let green = 0;
  let blue = 0;
  let highlight = 0;

  for (let i = 0; i < GRID * GRID; i += 1) {
    const r = (rgb[i * 3] ?? 0) / 255;
    const g = (rgb[i * 3 + 1] ?? 0) / 255;
    const b = (rgb[i * 3 + 2] ?? 0) / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = l;
    lumaSum += l;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    satSum += max === 0 ? 0 : (max - min) / max;

    if (g > r * 1.08 && g > b * 1.08 && l > 0.1 && l < 0.75) green += 1;
    if (b > r * 1.12 && b >= g * 0.98) blue += 1;
    if (l > 0.92) highlight += 1;
  }

  const count = GRID * GRID;
  const brightness = lumaSum / count;
  let variance = 0;
  for (let i = 0; i < count; i += 1) variance += (luma[i]! - brightness) ** 2;
  const contrast = clamp01(Math.sqrt(variance / count) / 0.32);

  // Énergie de gradient par pixel → carte de saillance grossière.
  const energy = new Float32Array(count);
  let energySum = 0;
  let energyMax = 0;
  for (let y = 1; y < GRID - 1; y += 1) {
    for (let x = 1; x < GRID - 1; x += 1) {
      const i = y * GRID + x;
      const dx = Math.abs(luma[i + 1]! - luma[i - 1]!);
      const dy = Math.abs(luma[i + GRID]! - luma[i - GRID]!);
      const e = Math.hypot(dx, dy);
      energy[i] = e;
      energySum += e;
      if (e > energyMax) energyMax = e;
    }
  }

  const sharpness = clamp01((energySum / count) * 12);

  // Centre de gravité de l'énergie, avec un léger biais central pour ne pas
  // accrocher un coin bruité, puis mesure de concentration.
  let wx = 0;
  let wy = 0;
  let wsum = 0;
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const i = y * GRID + x;
      const nx = (x + 0.5) / GRID;
      const ny = (y + 0.5) / GRID;
      const centerBias = 1 - 0.45 * Math.hypot(nx - 0.5, ny - 0.5);
      const w = energy[i]! * centerBias;
      wx += nx * w;
      wy += ny * w;
      wsum += w;
    }
  }

  const saliency: FocusPoint =
    wsum > 0 ? { x: clamp01(wx / wsum), y: clamp01(wy / wsum) } : { x: 0.5, y: 0.5 };

  let spread = 0;
  if (wsum > 0) {
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const i = y * GRID + x;
        const nx = (x + 0.5) / GRID;
        const ny = (y + 0.5) / GRID;
        spread += (energy[i]! / wsum) * Math.hypot(nx - saliency.x, ny - saliency.y);
      }
    }
  }

  const orientation =
    Math.abs(width - height) / Math.max(width, height) < 0.06
      ? 'square'
      : width > height
        ? 'landscape'
        : 'portrait';

  return {
    width,
    height,
    orientation,
    brightness,
    contrast,
    saturation: clamp01(satSum / count),
    sharpness,
    greenRatio: green / count,
    blueRatio: blue / count,
    highlightRatio: highlight / count,
    saliency,
    saliencyStrength: clamp01(1 - spread / 0.42),
  };
}

/** Encode une version allégée de la photo pour l'envoi au modèle de vision. */
export async function toVisionPayload(
  filePath: string,
  maxEdge = 768,
): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const buffer = await sharp(filePath)
    .removeAlpha()
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
  return { base64: buffer.toString('base64'), mediaType: 'image/jpeg' };
}

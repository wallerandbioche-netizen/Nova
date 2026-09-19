import sharp from 'sharp';
import type { NormalizedRect } from '@/types/domain';
import { lerpExpression } from './easing';
import { unionBox } from './framing';

/**
 * Préparation d'un plan.
 *
 * ffmpeg ne sait pas faire varier la taille d'un `crop` au fil du temps, et
 * `zoompan` ne sait cadrer qu'au format de son entrée. La chaîne combine donc
 * les deux : `crop` déplace une fenêtre de taille constante — c'est le
 * panoramique — et `zoompan` resserre à l'intérieur — c'est le travelling.
 *
 * Le suréchantillonnage est fait une seule fois, par sharp, sur la seule zone
 * utile de la photo : ffmpeg n'a plus qu'à découper, ce qui évite de
 * rééchantillonner l'image entière à chaque image de la vidéo.
 */

/** Résolution de travail visée, en multiples de la largeur de sortie. */
const SUPERSAMPLE = 2;
const MAX_WORK_EDGE = 4600;
const MAX_WORK_PIXELS = 20_000_000;

const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2);

export interface ShotInput {
  sourceWidth: number;
  sourceHeight: number;
  startRect: NormalizedRect;
  endRect: NormalizedRect;
  outputWidth: number;
  outputHeight: number;
  duration: number;
  fps: number;
}

export interface ShotPlan {
  /** Zone de la photo à extraire, en pixels source. */
  extract: { left: number; top: number; width: number; height: number };
  /** Taille de l'image de travail après suréchantillonnage. */
  work: { width: number; height: number };
  /** Fenêtre de panoramique, de taille constante, au format de sortie. */
  crop: { width: number; height: number };
  cropStart: { x: number; y: number };
  cropEnd: { x: number; y: number };
  /** Position du cadre visible à l'intérieur de la fenêtre. */
  insetStart: { x: number; y: number; width: number };
  insetEnd: { x: number; y: number; width: number };
  frames: number;
  duration: number;
}

export function planShot(input: ShotInput): ShotPlan {
  const { sourceWidth: sw, sourceHeight: sh, outputWidth: ow, outputHeight: oh } = input;
  const box = unionBox(input.startRect, input.endRect, sw, sh);

  const toPixels = (rect: NormalizedRect) => ({
    x: rect.x * sw,
    y: rect.y * sh,
    width: rect.width * sw,
    height: rect.height * sh,
  });
  const rects = [toPixels(input.startRect), toPixels(input.endRect)] as const;

  const smallestVisible = Math.min(rects[0].width, rects[1].width);
  const ideal = (SUPERSAMPLE * ow) / smallestVisible;
  const floor = ow / smallestVisible;
  const scale = Math.min(
    Math.max(Math.min(ideal, 3), Math.min(floor, 3)),
    MAX_WORK_EDGE / box.width,
    MAX_WORK_EDGE / box.height,
    Math.sqrt(MAX_WORK_PIXELS / (box.width * box.height)),
  );

  const work = { width: even(box.width * scale), height: even(box.height * scale) };
  const sx = work.width / box.width;
  const sy = work.height / box.height;

  const inWork = rects.map((rect) => ({
    x: (rect.x - box.x) * sx,
    y: (rect.y - box.y) * sy,
    width: rect.width * sx,
    height: rect.height * sy,
  }));

  // Fenêtre de panoramique : assez grande pour contenir le plus large des
  // deux cadres, au format de sortie exactement.
  let cropWidth = even(Math.min(work.width, Math.ceil(Math.max(inWork[0]!.width, inWork[1]!.width))));
  let cropHeight = even((cropWidth * oh) / ow);
  if (cropHeight > work.height) {
    cropHeight = even(work.height);
    cropWidth = even(Math.min(work.width, (cropHeight * ow) / oh));
  }

  const place = (index: 0 | 1) => {
    const rect = inWork[index]!;
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const x = Math.min(Math.max(centerX - cropWidth / 2, 0), work.width - cropWidth);
    const y = Math.min(Math.max(centerY - cropHeight / 2, 0), work.height - cropHeight);
    return {
      crop: { x: Math.round(x), y: Math.round(y) },
      // Position du cadre à l'intérieur de la fenêtre : compense le
      // recentrage forcé lorsque la fenêtre bute sur un bord.
      inset: {
        x: Math.min(Math.max(rect.x - x, 0), Math.max(0, cropWidth - rect.width)),
        y: Math.min(Math.max(rect.y - y, 0), Math.max(0, cropHeight - rect.height)),
        width: Math.min(rect.width, cropWidth),
      },
    };
  };

  const start = place(0);
  const end = place(1);

  return {
    extract: { left: box.x, top: box.y, width: box.width, height: box.height },
    work,
    crop: { width: cropWidth, height: cropHeight },
    cropStart: start.crop,
    cropEnd: end.crop,
    insetStart: start.inset,
    insetEnd: end.inset,
    frames: Math.max(2, Math.round(input.duration * input.fps)),
    duration: Math.max(2, Math.round(input.duration * input.fps)) / input.fps,
  };
}

/**
 * Chaîne de filtres du plan. `crop` déplace, `zoompan` resserre, et la sortie
 * est ramenée au format exact demandé.
 */
export function buildShotFilter(
  plan: ShotPlan,
  outputWidth: number,
  outputHeight: number,
  fps: number,
): string {
  const { frames, crop } = plan;
  const cropX = lerpExpression(plan.cropStart.x, plan.cropEnd.x, 'n', frames);
  const cropY = lerpExpression(plan.cropStart.y, plan.cropEnd.y, 'n', frames);
  const insetX = lerpExpression(plan.insetStart.x, plan.insetEnd.x, 'on', frames);
  const insetY = lerpExpression(plan.insetStart.y, plan.insetEnd.y, 'on', frames);
  const visible = lerpExpression(plan.insetStart.width, plan.insetEnd.width, 'on', frames);

  const maxX = plan.work.width - crop.width;
  const maxY = plan.work.height - crop.height;

  return [
    `crop=w=${crop.width}:h=${crop.height}` +
      `:x='max(0,min(${maxX},${cropX}))'` +
      `:y='max(0,min(${maxY},${cropY}))'`,
    `zoompan=z='max(1,${crop.width}/max(1,${visible}))'` +
      `:x='max(0,min(iw-iw/zoom,${insetX}))'` +
      `:y='max(0,min(ih-ih/zoom,${insetY}))'` +
      `:d=1:s=${outputWidth}x${outputHeight}:fps=${fps}`,
    'format=yuv420p',
    'setsar=1',
  ].join(',');
}

/**
 * Extrait la zone utile de la photo et la porte à la résolution de travail.
 * Le rééchantillonnage passe par sharp (Lanczos), nettement meilleur et plus
 * rapide que de le confier à ffmpeg image par image.
 *
 * `exposure` rapproche le plan de la luminosité de la série ; à 1, la photo
 * traverse le traitement sans être touchée.
 */
export async function prepareShotImage(
  sourcePath: string,
  plan: ShotPlan,
  outputPath: string,
  exposure = 1,
): Promise<void> {
  const pipeline = sharp(sourcePath, { failOn: 'none' })
    .rotate()
    .removeAlpha()
    .extract({
      left: plan.extract.left,
      top: plan.extract.top,
      width: plan.extract.width,
      height: plan.extract.height,
    })
    .resize(plan.work.width, plan.work.height, { kernel: 'lanczos3', fit: 'fill' });

  if (exposure !== 1) pipeline.modulate({ brightness: exposure });

  await pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(outputPath);
}

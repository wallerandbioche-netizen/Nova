import type { FocusPoint, MotionType, NormalizedRect } from '@/types/domain';

/**
 * Moteur de cadrage.
 *
 * Chaque photo devient un plan : une fenêtre de caméra qui se déplace
 * lentement d'un rectangle de départ vers un rectangle d'arrivée. Les deux
 * rectangles ont exactement le format de sortie, restent dans les limites de
 * la photo, et ne perdent jamais le sujet de vue.
 *
 * Tout est exprimé en pixels source puis normalisé en sortie, pour que le
 * rendu puisse travailler à n'importe quelle résolution.
 */

interface MotionSpec {
  /** Échelle du plan au début et à la fin : 1 = cadre le plus large possible. */
  zoomStart: number;
  zoomEnd: number;
  /** Attirance du cadre vers le point focal, au début puis à la fin. */
  pullStart: number;
  pullEnd: number;
  axis: 'none' | 'x' | 'y' | 'xy';
  direction: number;
  /** Amplitude du déplacement, en fraction de la largeur du plan. */
  travel: number;
}

const MOTION_SPECS: Record<MotionType, MotionSpec> = {
  slow_push_in: { zoomStart: 1.0, zoomEnd: 1.075, pullStart: 0.3, pullEnd: 0.72, axis: 'none', direction: 0, travel: 0 },
  slow_pull_out: { zoomStart: 1.085, zoomEnd: 1.0, pullStart: 0.7, pullEnd: 0.28, axis: 'none', direction: 0, travel: 0 },
  focus_push: { zoomStart: 1.02, zoomEnd: 1.14, pullStart: 0.45, pullEnd: 0.92, axis: 'none', direction: 0, travel: 0 },
  // Un panoramique ne doit pas se payer en resserrant le cadre : il puise sa
  // course dans la largeur disponible de la photo, pas dans un zoom.
  pan_left: { zoomStart: 1.04, zoomEnd: 1.06, pullStart: 0.8, pullEnd: 0.8, axis: 'x', direction: -1, travel: 0.16 },
  pan_right: { zoomStart: 1.04, zoomEnd: 1.06, pullStart: 0.8, pullEnd: 0.8, axis: 'x', direction: 1, travel: 0.16 },
  pan_up: { zoomStart: 1.04, zoomEnd: 1.07, pullStart: 0.8, pullEnd: 0.8, axis: 'y', direction: -1, travel: 0.12 },
  pan_down: { zoomStart: 1.04, zoomEnd: 1.07, pullStart: 0.8, pullEnd: 0.8, axis: 'y', direction: 1, travel: 0.12 },
  diagonal_drift: { zoomStart: 1.04, zoomEnd: 1.1, pullStart: 0.55, pullEnd: 0.85, axis: 'xy', direction: 1, travel: 0.12 },
  parallax_drift: { zoomStart: 1.14, zoomEnd: 1.05, pullStart: 0.75, pullEnd: 0.6, axis: 'x', direction: 1, travel: 0.1 },
};

/** Part du plan qui doit rester libre autour du sujet, de chaque côté. */
const SUBJECT_MARGIN = 0.06;

/** En deçà de cette part du déplacement voulu, un panoramique n'a plus de sens. */
const MIN_TRAVEL_RATIO = 0.5;

export interface FramingInput {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  focusPoint: FocusPoint;
  motion: MotionType;
}

export interface Framing {
  /** Mouvement réellement applicable, après dégradation éventuelle. */
  motion: MotionType;
  startRect: NormalizedRect;
  endRect: NormalizedRect;
}

interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number): number =>
  max < min ? (min + max) / 2 : Math.min(max, Math.max(min, value));

/**
 * Place le centre du plan : entre le centre de l'image et le point focal,
 * puis décalé du déplacement voulu, puis ramené dans les limites de la photo,
 * et enfin corrigé pour que le sujet reste dans le cadre avec sa marge.
 */
function placeCenter(
  axisSize: number,
  windowSize: number,
  focus: number,
  pull: number,
  offset: number,
): number {
  const imageCenter = axisSize / 2;
  const focusPx = focus * axisSize;
  const desired = imageCenter + (focusPx - imageCenter) * pull + offset;

  const low = windowSize / 2;
  const high = axisSize - windowSize / 2;
  let center = clamp(desired, low, high);

  // Le sujet ne doit jamais sortir du cadre : si le déplacement l'a chassé,
  // on ramène la caméra vers lui plutôt que de couper.
  const margin = windowSize * SUBJECT_MARGIN;
  const minCenter = focusPx - windowSize / 2 + margin;
  const maxCenter = focusPx + windowSize / 2 - margin;
  center = clamp(center, Math.min(minCenter, maxCenter), Math.max(minCenter, maxCenter));

  return clamp(center, low, high);
}

function buildRects(input: FramingInput, motion: MotionType): { rects: [PixelRect, PixelRect]; travelRatio: number } {
  const { sourceWidth: sw, sourceHeight: sh, focusPoint } = input;
  const aspect = input.targetWidth / input.targetHeight;
  const spec = MOTION_SPECS[motion];

  // Plan le plus large possible au format de sortie.
  const baseWidth = Math.min(sw, sh * aspect);
  const baseHeight = baseWidth / aspect;

  const zooms: [number, number] = [spec.zoomStart, spec.zoomEnd];
  const widths = zooms.map((z) => baseWidth / z) as [number, number];
  const heights = zooms.map((z) => baseHeight / z) as [number, number];

  // Course disponible, mesurée sur le plan le plus large des deux.
  const widest = Math.max(widths[0], widths[1]);
  const tallest = Math.max(heights[0], heights[1]);
  const roomX = Math.max(0, sw - widest);
  const roomY = Math.max(0, sh - tallest);

  const wantedX = spec.axis === 'x' || spec.axis === 'xy' ? spec.travel * widest : 0;
  const wantedY = spec.axis === 'y' || spec.axis === 'xy' ? spec.travel * tallest : 0;
  const travelX = Math.min(wantedX, roomX);
  const travelY = Math.min(wantedY, roomY);

  const wanted = Math.hypot(wantedX, wantedY);
  const granted = Math.hypot(travelX, travelY);
  const travelRatio = wanted === 0 ? 1 : granted / wanted;

  // Le mouvement démarre en amont du sujet et se termine légèrement au-delà :
  // l'œil suit le déplacement et se repose sur le point d'intérêt.
  const offsets: Array<{ x: number; y: number }> = [
    { x: -0.7 * travelX * spec.direction, y: -0.7 * travelY * spec.direction },
    { x: 0.3 * travelX * spec.direction, y: 0.3 * travelY * spec.direction },
  ];

  const pulls: [number, number] = [spec.pullStart, spec.pullEnd];

  const rects = [0, 1].map((index) => {
    const width = widths[index === 0 ? 0 : 1];
    const height = heights[index === 0 ? 0 : 1];
    const offset = offsets[index]!;
    const cx = placeCenter(sw, width, focusPoint.x, pulls[index === 0 ? 0 : 1], offset.x);
    const cy = placeCenter(sh, height, focusPoint.y, pulls[index === 0 ? 0 : 1], offset.y);
    return { x: cx - width / 2, y: cy - height / 2, width, height };
  }) as [PixelRect, PixelRect];

  return { rects, travelRatio };
}

/**
 * Calcule le cadre de départ et d'arrivée d'un plan.
 *
 * Si la photo n'offre pas assez de course pour le panoramique demandé — cas
 * d'une photo paysage recadrée en vertical, par exemple — le mouvement est
 * remplacé par un travelling avant, et le mouvement effectif est renvoyé.
 */
export function computeFraming(input: FramingInput): Framing {
  let motion = input.motion;
  const first = buildRects(input, motion);
  let rects = first.rects;

  if (first.travelRatio < MIN_TRAVEL_RATIO) {
    motion =
      MOTION_SPECS[motion].zoomEnd >= MOTION_SPECS[motion].zoomStart
        ? 'slow_push_in'
        : 'slow_pull_out';
    rects = buildRects(input, motion).rects;
  }

  const toNormalized = (rect: PixelRect): NormalizedRect => ({
    x: rect.x / input.sourceWidth,
    y: rect.y / input.sourceHeight,
    width: rect.width / input.sourceWidth,
    height: rect.height / input.sourceHeight,
  });

  return { motion, startRect: toNormalized(rects[0]), endRect: toNormalized(rects[1]) };
}

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Plus petite zone de la photo contenant les deux cadres.
 *
 * C'est la seule partie de l'image que le rendu a besoin de charger : elle est
 * découpée et suréchantillonnée une fois pour toutes, puis la caméra s'y
 * déplace. Contrairement aux cadres, cette zone n'a aucune contrainte de
 * format — un panoramique ample produit une zone plus large que la sortie.
 */
export function unionBox(
  start: NormalizedRect,
  end: NormalizedRect,
  sourceWidth: number,
  sourceHeight: number,
  padding = 1,
): PixelBox {
  const left = Math.min(start.x, end.x) * sourceWidth - padding;
  const top = Math.min(start.y, end.y) * sourceHeight - padding;
  const right = Math.max(start.x + start.width, end.x + end.width) * sourceWidth + padding;
  const bottom = Math.max(start.y + start.height, end.y + end.height) * sourceHeight + padding;

  const x = Math.max(0, Math.floor(left));
  const y = Math.max(0, Math.floor(top));

  return {
    x,
    y,
    width: Math.min(sourceWidth - x, Math.ceil(right) - x),
    height: Math.min(sourceHeight - y, Math.ceil(bottom) - y),
  };
}

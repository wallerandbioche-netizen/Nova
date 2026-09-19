import type { ImageStats } from '@/lib/images/stats';
import type { FocusPoint, MotionType, RoomType } from '@/types/domain';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Qualité technique : netteté, exposition, contraste, définition.
 * Une photo sous-exposée ou molle ne doit jamais ouvrir une vidéo.
 */
export function qualityFromStats(stats: ImageStats): number {
  const exposure = clamp01(1 - Math.abs(stats.brightness - 0.54) / 0.44);
  const blown = clamp01(1 - Math.max(0, stats.highlightRatio - 0.16) * 2.6);
  const definition = clamp01(Math.log10(Math.max(stats.width * stats.height, 1) / 250_000) / 1.2);
  const score =
    0.34 * clamp01(stats.sharpness * 1.15) +
    0.24 * exposure +
    0.2 * clamp01(stats.contrast * 1.1) +
    0.14 * definition +
    0.08 * blown;
  return clamp01(score);
}

/**
 * Composition : sujet bien posé sur une ligne de force, sujet lisible,
 * cadrage exploitable. C'est ce qui départage deux photos nettes.
 */
export function compositionFromStats(stats: ImageStats): number {
  const { x, y } = stats.saliency;
  const thirdsX = 1 - Math.min(Math.abs(x - 1 / 3), Math.abs(x - 2 / 3), Math.abs(x - 0.5)) / 0.33;
  const thirdsY = 1 - Math.min(Math.abs(y - 1 / 3), Math.abs(y - 2 / 3), Math.abs(y - 0.5)) / 0.33;
  const centred = 1 - Math.hypot(x - 0.5, y - 0.5) / 0.71;
  const score =
    0.3 * clamp01(thirdsX) +
    0.2 * clamp01(thirdsY) +
    0.22 * clamp01(stats.saliencyStrength) +
    0.16 * clamp01(centred) +
    0.12 * clamp01(stats.contrast);
  return clamp01(score);
}

/**
 * Mouvement proposé pour une photo, avant arbitrage de variété par le
 * storyboard. La règle : la caméra va vers le sujet, jamais à l'opposé.
 */
export function suggestMotion(
  roomType: RoomType,
  focus: FocusPoint,
  stats: ImageStats,
): MotionType {
  const dx = focus.x - 0.5;
  const dy = focus.y - 0.5;

  // Une vue ou un extérieur large mérite un mouvement ample et horizontal.
  const isWide = roomType === 'view' || roomType === 'exterior' || roomType === 'garden';
  if (isWide && Math.abs(dx) > 0.06) return dx > 0 ? 'pan_right' : 'pan_left';

  // Un sujet franchement décentré appelle un déplacement, pas un zoom.
  if (Math.abs(dx) > 0.12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    return dx > 0 ? 'pan_right' : 'pan_left';
  }
  if (Math.abs(dy) > 0.12 && Math.abs(dy) > Math.abs(dx) * 1.4) {
    return dy > 0 ? 'pan_down' : 'pan_up';
  }
  if (Math.abs(dx) > 0.08 && Math.abs(dy) > 0.08) return 'diagonal_drift';

  // Sujet centré et lisible : on entre dedans. Sinon on ouvre le plan.
  if (stats.saliencyStrength > 0.55) return 'focus_push';
  return stats.brightness > 0.6 ? 'slow_push_in' : 'slow_pull_out';
}

/**
 * Courbe de mouvement de la caméra.
 *
 * Un `smoothstep` pur s'arrête net en fin de plan, ce qui trahit le diaporama
 * au moment du fondu. On lui mêle un quart de mouvement linéaire : la caméra
 * démarre et se termine doucement sans jamais s'immobiliser, et le mouvement
 * se prolonge visuellement à travers la transition.
 */
const LINEAR_SHARE = 0.25;

export function ease(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return LINEAR_SHARE * p + (1 - LINEAR_SHARE) * p * p * (3 - 2 * p);
}

/** La même courbe, en expression ffmpeg, à partir d'une variable de progression. */
export function easeExpression(progressExpr: string): string {
  const p = `(${progressExpr})`;
  return `(${LINEAR_SHARE}*${p}+${1 - LINEAR_SHARE}*${p}*${p}*(3-2*${p}))`;
}

/** Progression 0 → 1 sur `frames` images, à partir d'un compteur ffmpeg. */
export function progressExpression(counter: 'n' | 'on', frames: number): string {
  return frames <= 1 ? '0' : `min(1,${counter}/${frames - 1})`;
}

/** Interpolation d'une valeur sur la durée du plan, en expression ffmpeg. */
export function lerpExpression(
  from: number,
  to: number,
  counter: 'n' | 'on',
  frames: number,
): string {
  const rounded = (value: number): string => value.toFixed(4);
  if (Math.abs(to - from) < 1e-6) return rounded(from);
  const e = easeExpression(progressExpression(counter, frames));
  return `(${rounded(from)}+(${rounded(to - from)})*${e})`;
}

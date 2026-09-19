/**
 * Harmonisation de l'exposition.
 *
 * Un lot de photos prises au fil des heures alterne les pièces claires et les
 * pièces sombres. Enchaînées, elles donnent une vidéo qui clignote — c'est ce
 * qui distingue le plus nettement un montage amateur d'un montage tenu.
 *
 * Le principe : la série est sa propre référence. On ne vise aucune exposition
 * idéale — un logement clair doit rester clair — on réduit seulement l'écart
 * entre les plans. Trois garde-fous en découlent :
 *
 *  - la cible est la médiane de la série, sans valeur absolue imposée ;
 *  - la correction n'est que partielle, pour que chaque photo garde son
 *    caractère ;
 *  - une série déjà homogène n'est pas touchée du tout.
 */

/** Part de l'écart à la médiane réellement rattrapée. */
const STRENGTH = 0.6;

/** Amplitude maximale, en multiplicateur de luminosité. */
const MIN_FACTOR = 0.92;
const MAX_FACTOR = 1.08;

/** En deçà de cet écart entre les plans, il n'y a rien à harmoniser. */
const SPREAD_THRESHOLD = 0.08;

/** En deçà de cette correction, l'effet serait invisible : on s'abstient. */
const DEAD_ZONE = 0.012;

/** Sous cette luminosité, la photo est trop sombre pour être rattrapée. */
const TOO_DARK = 0.02;

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0.5;
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low]!;
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
}

/**
 * Multiplicateurs de luminosité, un par plan, dans l'ordre reçu.
 * Un plan sans correction reçoit exactement 1, ce qui lui évite un
 * retraitement inutile.
 */
export function exposurePlan(brightnesses: number[]): number[] {
  const usable = brightnesses.filter((value) => Number.isFinite(value) && value > TOO_DARK);
  if (usable.length < 2) return brightnesses.map(() => 1);

  const sorted = [...usable].sort((a, b) => a - b);
  const target = quantile(sorted, 0.5);

  // Les extrêmes sont mesurés aux déciles : une seule photo aberrante ne doit
  // pas à elle seule déclencher le traitement de toute la série.
  const spread = quantile(sorted, 0.9) - quantile(sorted, 0.1);
  if (spread < SPREAD_THRESHOLD) return brightnesses.map(() => 1);

  return brightnesses.map((brightness) => {
    if (!Number.isFinite(brightness) || brightness <= TOO_DARK) return 1;
    const full = target / brightness;
    const partial = 1 + (full - 1) * STRENGTH;
    const bounded = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, partial));
    return Math.abs(bounded - 1) < DEAD_ZONE ? 1 : bounded;
  });
}

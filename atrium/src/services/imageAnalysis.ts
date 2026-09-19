import { hammingDistance } from '@/lib/images/hash';
import { visionAnalyzer, type VisionInput } from '@/lib/vision';
import type { Image, RoomType } from '@/types/domain';
import { absolutePath } from './ingest';

/**
 * Deux photos dont les empreintes diffèrent de moins de ce nombre de bits
 * montrent le même cadrage. Au-delà, l'angle change assez pour apporter
 * quelque chose à la séquence.
 */
export const DUPLICATE_THRESHOLD = 8;

/** Nombre de photos conservées par espace, pour éviter l'effet catalogue. */
const ROOM_CAPS: Partial<Record<RoomType, number>> = {
  living_room: 2,
  kitchen: 2,
  dining_room: 1,
  bedroom: 3,
  bathroom: 2,
  hallway: 1,
  office: 1,
  terrace: 2,
  garden: 1,
  pool: 2,
  exterior: 2,
  view: 2,
  detail: 2,
  other: 2,
};

const DEFAULT_CAP = 2;
const MIN_SELECTED = 5;
const MAX_SELECTED = 12;
/** En deçà, une photo dessert la vidéo plus qu'elle ne la sert. */
const MIN_QUALITY = 0.2;

export interface AnalysisOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Analyse chaque photo, puis calcule le score de sélection.
 *
 * Le score combine qualité technique et composition, et sanctionne ce qui
 * nuit à une vidéo immobilière : un texte incrusté, des personnes
 * reconnaissables, une photo déjà vue sous le même angle.
 */
export async function analyzeImages(
  projectId: string,
  images: Image[],
  captions: Map<number, string>,
  options: AnalysisOptions = {},
): Promise<Image[]> {
  const analyzer = visionAnalyzer();
  const inputs: VisionInput[] = images.map((image) => ({
    imageId: image.id,
    path: absolutePath(projectId, image),
    width: image.width,
    height: image.height,
    caption: captions.get(image.order),
  }));

  const results = await analyzer.analyze(inputs, {
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const byId = new Map(results.map((result) => [result.imageId, result]));
  for (const image of images) {
    const analysis = byId.get(image.id);
    if (!analysis) continue;
    const { imageId: _ignored, ...rest } = analysis;
    image.analysis = rest;
    image.score = baseScore(image);
  }

  return images;
}

/**
 * Écarte les doublons puis arrête la sélection. Séparé de l'analyse pour que
 * l'interface puisse rendre compte des deux étapes distinctement.
 */
export function curateImages(images: Image[]): Image[] {
  markDuplicates(images);
  select(images);
  return images;
}

function baseScore(image: Image): number {
  const analysis = image.analysis;
  if (!analysis) return 0;

  let score = analysis.qualityScore * 0.6 + analysis.compositionScore * 0.4;
  // Un texte incrusté ou un filigrane est rédhibitoire : la vidéo doit être
  // faite des seules photographies.
  if (analysis.hasText) score -= 0.35;
  // Des personnes reconnaissables ne sont pas souhaitables dans une
  // présentation de logement.
  if (analysis.hasPeople) score -= 0.15;
  // Un espace bien identifié aide à construire le récit.
  score += (analysis.roomConfidence - 0.5) * 0.08;

  return Math.min(1, Math.max(0, score));
}

/**
 * Regroupe les photos quasi identiques et ne retient que la meilleure de
 * chaque groupe. Les autres restent dans le projet, marquées comme doublons.
 */
export function markDuplicates(images: Image[]): Image[] {
  const ranked = [...images].sort((a, b) => b.score - a.score);
  const kept: Image[] = [];

  for (const image of ranked) {
    const twin = kept.find(
      (candidate) => hammingDistance(candidate.hash, image.hash) <= DUPLICATE_THRESHOLD,
    );
    if (twin) image.duplicateOf = twin.id;
    else {
      image.duplicateOf = null;
      kept.push(image);
    }
  }

  return images;
}

/**
 * Choisit les photos de la vidéo : les meilleures d'abord, sous plafond par
 * espace, pour qu'une belle chambre ne prenne pas toute la place.
 */
export function select(images: Image[]): Image[] {
  for (const image of images) image.selected = false;

  const candidates = images
    .filter((image) => image.duplicateOf === null && image.analysis !== null)
    .filter((image) => (image.analysis?.qualityScore ?? 0) >= MIN_QUALITY)
    .sort((a, b) => b.score - a.score);

  const target = Math.min(
    MAX_SELECTED,
    Math.max(MIN_SELECTED, Math.round(candidates.length * 0.75)),
  );

  const perRoom = new Map<RoomType, number>();
  const pick = (image: Image, cap: number): boolean => {
    const room = image.analysis!.roomType;
    const used = perRoom.get(room) ?? 0;
    if (used >= cap) return false;
    perRoom.set(room, used + 1);
    image.selected = true;
    return true;
  };

  let chosen = 0;
  for (const image of candidates) {
    if (chosen >= target) break;
    if (pick(image, ROOM_CAPS[image.analysis!.roomType] ?? DEFAULT_CAP)) chosen += 1;
  }

  // Si les plafonds ont trop restreint la sélection, on les desserre plutôt
  // que de livrer une vidéo trop courte.
  if (chosen < MIN_SELECTED) {
    for (const image of candidates) {
      if (chosen >= Math.min(MIN_SELECTED, candidates.length)) break;
      if (image.selected) continue;
      if (pick(image, Number.POSITIVE_INFINITY)) chosen += 1;
    }
  }

  return images;
}

import { atriumError } from '@/lib/errors';
import { newId } from '@/lib/id';
import { computeFraming } from '@/lib/video/framing';
import {
  FORMAT_DIMENSIONS,
  type Image,
  type MotionType,
  type RoomType,
  type Scene,
  type TransitionType,
  type VideoFormat,
} from '@/types/domain';

/**
 * Construction du récit visuel.
 *
 * L'ordre d'origine d'une annonce suit la logique de celui qui l'a publiée,
 * pas celle d'un film. On reconstruit donc une progression : une ouverture
 * large, les pièces de vie, les chambres, les espaces d'eau, puis le dehors,
 * et une dernière vue large pour refermer.
 */

const INDOOR_CHAPTERS: RoomType[] = [
  'living_room',
  'dining_room',
  'kitchen',
  'bedroom',
  'bathroom',
  'office',
  'hallway',
  'detail',
  'other',
  'exterior',
  'garden',
  'terrace',
  'pool',
  'view',
];

const OUTDOOR_CHAPTERS: RoomType[] = [
  'exterior',
  'garden',
  'terrace',
  'pool',
  'view',
  'living_room',
  'dining_room',
  'kitchen',
  'bedroom',
  'bathroom',
  'office',
  'hallway',
  'detail',
  'other',
];

const OUTDOOR_ROOMS = new Set<RoomType>(['exterior', 'garden', 'terrace', 'pool', 'view']);
const OPENING_ROOMS: RoomType[] = ['view', 'exterior', 'pool', 'terrace', 'living_room'];
const CLOSING_ROOMS: RoomType[] = ['view', 'pool', 'terrace', 'garden', 'exterior'];

/** Durées cibles de la vidéo finale, une fois les fondus déduits. */
const MIN_TOTAL = 16;
const MAX_TOTAL = 42;
const MIN_SCENE = 2.1;
const MAX_SCENE = 4.6;

const TRANSITION_LENGTHS: Record<TransitionType, number> = {
  cross_dissolve: 0.55,
  fade: 0.6,
  soft_zoom: 0.45,
  continuous: 0.75,
};

const ALTERNATE: Record<MotionType, MotionType> = {
  slow_push_in: 'slow_pull_out',
  slow_pull_out: 'slow_push_in',
  pan_left: 'pan_right',
  pan_right: 'pan_left',
  pan_up: 'pan_down',
  pan_down: 'pan_up',
  diagonal_drift: 'parallax_drift',
  parallax_drift: 'diagonal_drift',
  focus_push: 'slow_pull_out',
};

const PUSH_MOTIONS = new Set<MotionType>(['slow_push_in', 'focus_push']);

type Role = 'opening' | 'body' | 'closing';

function roomOf(image: Image): RoomType {
  return image.analysis?.roomType ?? 'other';
}

function best(images: Image[], rooms: RoomType[]): Image | null {
  for (const room of rooms) {
    const found = images
      .filter((image) => roomOf(image) === room)
      .sort((a, b) => b.score - a.score)[0];
    if (found) return found;
  }
  return null;
}

/**
 * Ordonne les photos retenues : ouverture, chapitres, clôture.
 * Les chapitres absents sont simplement sautés, et une annonce à dominante
 * extérieure commence par le dehors plutôt que par un salon secondaire.
 */
export function orderImages(selected: Image[]): Image[] {
  const outdoorShare =
    selected.filter((image) => OUTDOOR_ROOMS.has(roomOf(image))).length / selected.length;
  const chapters = outdoorShare > 0.55 ? OUTDOOR_CHAPTERS : INDOOR_CHAPTERS;

  const remaining = [...selected];
  const take = (image: Image | null): Image | null => {
    if (!image) return null;
    const index = remaining.indexOf(image);
    if (index === -1) return null;
    remaining.splice(index, 1);
    return image;
  };

  const opening =
    take(best(remaining, OPENING_ROOMS)) ??
    take([...remaining].sort((a, b) => b.score - a.score)[0] ?? null);

  // La clôture n'est réservée que si elle ne prive pas le corps du film.
  const closing = remaining.length >= 3 ? take(best(remaining, CLOSING_ROOMS)) : null;

  const body = remaining.sort((a, b) => {
    const chapterDiff = chapters.indexOf(roomOf(a)) - chapters.indexOf(roomOf(b));
    return chapterDiff !== 0 ? chapterDiff : b.score - a.score;
  });

  return [opening, ...body, closing].filter((image): image is Image => image !== null);
}

function baseDuration(image: Image, role: Role): number {
  const analysis = image.analysis;
  const merit = analysis ? analysis.qualityScore * 0.6 + analysis.compositionScore * 0.4 : 0.5;
  if (role !== 'body') {
    return Math.min(4.4, Math.max(3.4, 3.5 + merit * 0.9));
  }
  return Math.min(3.8, Math.max(2.3, 2.45 + merit * 1.1));
}

/**
 * Ajuste l'ensemble des durées pour que la vidéo tienne dans la fourchette
 * visée, sans jamais aplatir le rythme : le rapport entre les plans est
 * conservé, seules les bornes par plan s'appliquent.
 */
function fitTotal(durations: number[], transitions: number[]): number[] {
  const overlap = transitions.reduce((sum, value) => sum + value, 0);
  const effective = (values: number[]): number =>
    values.reduce((sum, value) => sum + value, 0) - overlap;

  const current = effective(durations);
  if (current >= MIN_TOTAL && current <= MAX_TOTAL) return durations;

  // Une vidéo plus courte que le minimum avec peu de photos reste acceptable :
  // les bornes par plan priment, mieux vaut cela qu'étirer chaque plan.
  const target = current > MAX_TOTAL ? MAX_TOTAL : MIN_TOTAL;
  const factor = (target + overlap) / (current + overlap);
  return durations.map((value) => Math.min(MAX_SCENE, Math.max(MIN_SCENE, value * factor)));
}

export interface StoryboardInput {
  projectId: string;
  images: Image[];
  format: VideoFormat;
}

/**
 * Transforme les photos retenues en scènes : ordre, durée, mouvement,
 * transition et cadrage. C'est ici que se décide tout ce que l'utilisateur
 * n'a pas à choisir.
 */
export function buildStoryboard({ projectId, images, format }: StoryboardInput): Scene[] {
  const selected = images.filter((image) => image.selected && image.analysis);
  if (selected.length < 3) {
    throw atriumError('NOT_ENOUGH_PHOTOS', `${selected.length} photo(s) retenue(s)`);
  }

  const ordered = orderImages(selected);
  const { width: targetWidth, height: targetHeight } = FORMAT_DIMENSIONS[format];
  const last = ordered.length - 1;

  const roles: Role[] = ordered.map((_, index) =>
    index === 0 ? 'opening' : index === last ? 'closing' : 'body',
  );

  // ── Transitions ───────────────────────────────────────────────────────────
  const transitionTypes: Array<TransitionType | null> = ordered.map((image, index) => {
    if (index === last) return null;
    const next = ordered[index + 1]!;
    // Un dernier plan large mérite une respiration qui l'annonce.
    if (index === last - 1 && ordered.length >= 8) return 'soft_zoom';
    return roomOf(image) === roomOf(next) ? 'continuous' : 'cross_dissolve';
  });

  const transitionLengths = transitionTypes.map((type) =>
    type ? TRANSITION_LENGTHS[type] : 0,
  );

  // ── Durées ────────────────────────────────────────────────────────────────
  const durations = fitTotal(
    ordered.map((image, index) => {
      const base = baseDuration(image, roles[index]!);
      // Une variation déterministe casse la régularité de métronome sans
      // rendre le montage imprévisible d'une exécution à l'autre.
      const jitter = (((index * 7919) % 5) - 2) * 0.06;
      return base + jitter;
    }),
    transitionLengths.filter((value) => value > 0),
  );

  // ── Mouvements et cadrages ────────────────────────────────────────────────
  const scenes: Scene[] = [];
  const recent: MotionType[] = [];

  for (const [index, image] of ordered.entries()) {
    const analysis = image.analysis!;
    let motion = analysis.recommendedMotion;

    // Deux plans de suite ne partagent pas le même mouvement, et trois
    // travellings avant d'affilée ne sont pas un montage.
    if (recent[recent.length - 1] === motion) motion = ALTERNATE[motion];
    if (PUSH_MOTIONS.has(motion) && recent.slice(-2).every((m) => PUSH_MOTIONS.has(m))) {
      motion = analysis.focusPoint.x >= 0.5 ? 'pan_right' : 'pan_left';
    }

    const framing = computeFraming({
      sourceWidth: image.width,
      sourceHeight: image.height,
      targetWidth,
      targetHeight,
      focusPoint: analysis.focusPoint,
      motion,
    });

    recent.push(framing.motion);

    scenes.push({
      id: newId('scn'),
      projectId,
      imageId: image.id,
      order: index,
      duration: durations[index]!,
      // Le cadrage peut avoir refusé le mouvement demandé : on consigne celui
      // qui sera réellement filmé.
      motionType: framing.motion,
      transitionType: transitionTypes[index]!,
      transitionDuration: transitionLengths[index]!,
      focusPoint: analysis.focusPoint,
      startRect: framing.startRect,
      endRect: framing.endRect,
    });
  }

  return scenes;
}

/** Durée utile de la séquence, fondus enchaînés déduits. */
export function storyboardDuration(scenes: Scene[]): number {
  return scenes.reduce(
    (total, scene) => total + scene.duration - (scene.transitionType ? scene.transitionDuration : 0),
    0,
  );
}

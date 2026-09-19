/**
 * Modèle de domaine d'Atrium.
 *
 * Un `Project` est l'unité de travail : une source (URL d'annonce, dossier
 * local, photos importées) transformée en une `Video`. Le chemin entre les
 * deux passe par des `Image` analysées puis des `Scene` ordonnées.
 */

// ── Espaces ───────────────────────────────────────────────────────────────────

export const ROOM_TYPES = [
  'living_room',
  'kitchen',
  'dining_room',
  'bedroom',
  'bathroom',
  'hallway',
  'office',
  'terrace',
  'garden',
  'pool',
  'exterior',
  'view',
  'detail',
  'other',
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

/** Libellés utilisateur (jamais incrustés dans la vidéo : UI uniquement). */
export const ROOM_LABELS: Record<RoomType, string> = {
  living_room: 'Salon',
  kitchen: 'Cuisine',
  dining_room: 'Salle à manger',
  bedroom: 'Chambre',
  bathroom: 'Salle de bain',
  hallway: 'Entrée',
  office: 'Bureau',
  terrace: 'Terrasse',
  garden: 'Jardin',
  pool: 'Piscine',
  exterior: 'Extérieur',
  view: 'Vue',
  detail: 'Détail',
  other: 'Autre espace',
};

// ── Mouvements et transitions ────────────────────────────────────────────────

export const MOTION_TYPES = [
  'slow_push_in',
  'slow_pull_out',
  'pan_left',
  'pan_right',
  'pan_up',
  'pan_down',
  'diagonal_drift',
  'focus_push',
  'parallax_drift',
] as const;

export type MotionType = (typeof MOTION_TYPES)[number];

export const TRANSITION_TYPES = ['cross_dissolve', 'fade', 'soft_zoom', 'continuous'] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

// ── Formats ──────────────────────────────────────────────────────────────────

export const VIDEO_FORMATS = ['9:16', '16:9', '4:5'] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export const FORMAT_DIMENSIONS: Record<VideoFormat, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

export const FORMAT_LABELS: Record<VideoFormat, string> = {
  '9:16': 'Vertical',
  '16:9': 'Paysage',
  '4:5': 'Portrait',
};

// ── Géométrie ────────────────────────────────────────────────────────────────

/** Point normalisé dans l'image source : (0,0) haut-gauche, (1,1) bas-droite. */
export interface FocusPoint {
  x: number;
  y: number;
}

/** Rectangle normalisé dans l'image source. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Entités ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  createdAt: string;
}

export type ProjectStatus = 'queued' | 'running' | 'ready' | 'failed';

export interface Project {
  id: string;
  userId: string | null;
  sourceId: string;
  sourceUrl: string | null;
  status: ProjectStatus;
  format: VideoFormat;
  listing: Listing | null;
  images: Image[];
  scenes: Scene[];
  videos: Video[];
  job: GenerationJob;
  error: ProjectError | null;
  createdAt: string;
  updatedAt: string;
}

export interface Listing {
  id: string;
  projectId: string;
  sourceId: string;
  sourceUrl: string | null;
  title: string | null;
  photoCount: number;
  /** Vrai lorsque les photos proviennent d'un jeu de démonstration local. */
  isDemo: boolean;
}

export interface ImageAnalysis {
  roomType: RoomType;
  /** Confiance du classement d'espace, 0 → 1. */
  roomConfidence: number;
  qualityScore: number;
  compositionScore: number;
  brightness: number;
  sharpness: number;
  hasPeople: boolean;
  hasText: boolean;
  /** Ce que la photo montre d'essentiel — pilote le cadrage, jamais affiché. */
  highlight: string | null;
  focusPoint: FocusPoint;
  recommendedMotion: MotionType;
  /** `vision` = modèle multimodal, `heuristic` = analyse locale. */
  analyzer: 'vision' | 'heuristic';
}

export interface Image {
  id: string;
  projectId: string;
  /** Chemin relatif au stockage du projet. */
  path: string;
  /** URL d'origine lorsque la photo a été récupérée en ligne. */
  sourceUrl: string | null;
  order: number;
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait' | 'square';
  /** Empreinte perceptuelle 64 bits, en hexadécimal, pour la déduplication. */
  hash: string;
  /** Identifiant de l'image conservée lorsque celle-ci est un doublon. */
  duplicateOf: string | null;
  analysis: ImageAnalysis | null;
  /** Score final de sélection, doublons et pénalités inclus. */
  score: number;
  selected: boolean;
}

export interface Scene {
  id: string;
  projectId: string;
  imageId: string;
  order: number;
  /** Secondes de métrage utile, hors recouvrement de transition. */
  duration: number;
  motionType: MotionType;
  /** Transition vers la scène suivante ; `null` sur la dernière. */
  transitionType: TransitionType | null;
  transitionDuration: number;
  focusPoint: FocusPoint;
  /** Cadre de départ et d'arrivée de la caméra, normalisés sur la source. */
  startRect: NormalizedRect;
  endRect: NormalizedRect;
}

export interface Video {
  id: string;
  projectId: string;
  url: string;
  /** Chemin relatif au stockage, utilisé côté serveur. */
  path: string;
  format: VideoFormat;
  width: number;
  height: number;
  duration: number;
  sizeBytes: number;
  sceneCount: number;
  createdAt: string;
}

// ── Job de génération ────────────────────────────────────────────────────────

export const STAGE_IDS = [
  'fetch',
  'analyze',
  'select',
  'storyboard',
  'animate',
  'finalize',
] as const;

export type StageId = (typeof STAGE_IDS)[number];

export const STAGE_LABELS: Record<StageId, string> = {
  fetch: 'Récupération des photos',
  analyze: 'Analyse des espaces',
  select: 'Sélection des meilleures vues',
  storyboard: 'Construction de la séquence',
  animate: 'Animation des photos',
  finalize: 'Finalisation de la vidéo',
};

/** Poids relatif de chaque étape dans la progression globale. */
export const STAGE_WEIGHTS: Record<StageId, number> = {
  fetch: 0.1,
  analyze: 0.22,
  select: 0.06,
  storyboard: 0.07,
  animate: 0.42,
  finalize: 0.13,
};

export type StageStatus = 'pending' | 'active' | 'done' | 'failed';

export interface StageState {
  id: StageId;
  status: StageStatus;
  /** Avancement interne de l'étape, 0 → 1. */
  progress: number;
  startedAt: string | null;
  endedAt: string | null;
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface GenerationJob {
  id: string;
  projectId: string;
  status: JobStatus;
  stages: StageState[];
  /** Progression globale pondérée, 0 → 1. */
  progress: number;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

// ── Erreurs présentables ─────────────────────────────────────────────────────

export const ERROR_CODES = [
  'INVALID_URL',
  'SOURCE_UNAVAILABLE',
  'NOT_ENOUGH_PHOTOS',
  'RENDER_FAILED',
  'FFMPEG_MISSING',
  'UNKNOWN',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ProjectError {
  code: ErrorCode;
  /** Message destiné à l'utilisateur : jamais de trace technique. */
  message: string;
}

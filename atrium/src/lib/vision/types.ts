import type { FocusPoint, MotionType, RoomType } from '@/types/domain';

export interface VisionInput {
  imageId: string;
  /** Chemin absolu de la photo sur le disque. */
  path: string;
  width: number;
  height: number;
  /** Légende d'origine si l'annonce en fournit une. */
  caption?: string | undefined;
}

export interface VisionOutput {
  imageId: string;
  roomType: RoomType;
  roomConfidence: number;
  qualityScore: number;
  compositionScore: number;
  brightness: number;
  sharpness: number;
  hasPeople: boolean;
  hasText: boolean;
  highlight: string | null;
  focusPoint: FocusPoint;
  recommendedMotion: MotionType;
  analyzer: 'vision' | 'heuristic';
}

export interface AnalyzeOptions {
  /** Appelé après chaque lot ; `done` et `total` comptent des photos. */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Analyseur de photos. Deux implémentations : un modèle de vision multimodal
 * et une analyse locale déterministe utilisée hors ligne ou en repli.
 */
export interface VisionAnalyzer {
  readonly id: 'vision' | 'heuristic';
  analyze(inputs: VisionInput[], options?: AnalyzeOptions): Promise<VisionOutput[]>;
}

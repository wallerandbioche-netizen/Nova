import type {
  ProjectError,
  ProjectStatus,
  StageId,
  StageStatus,
  VideoFormat,
} from './domain';

/**
 * Vue transmise au navigateur. Volontairement plus pauvre que le domaine :
 * ni chemins de fichiers, ni scores bruts, ni détails techniques d'erreur.
 */

export interface StageView {
  id: StageId;
  label: string;
  status: StageStatus;
  progress: number;
}

export interface VideoView {
  url: string;
  format: VideoFormat;
  width: number;
  height: number;
  duration: number;
  sizeBytes: number;
  sceneCount: number;
}

export interface ProjectView {
  id: string;
  status: ProjectStatus;
  /** Progression globale, 0 → 1. */
  progress: number;
  format: VideoFormat;
  stages: StageView[];
  listing: { title: string | null; photoCount: number; isDemo: boolean } | null;
  photos: { total: number; selected: number; duplicates: number };
  video: VideoView | null;
  /** Formats déjà rendus, disponibles sans attendre. */
  renderedFormats: VideoFormat[];
  error: ProjectError | null;
}

export interface CreateProjectResponse {
  id: string;
}

export interface UploadResponse {
  uploadId: string;
  photoCount: number;
}

export interface ApiErrorResponse {
  error: ProjectError;
}

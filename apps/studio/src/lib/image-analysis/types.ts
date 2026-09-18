import type { RoomType } from '@prisma/client';

export interface AnalyzerInput {
  buffer: Buffer;
  /** Caption or alt text from the source page, when there is one. */
  hint?: string | undefined;
}

export interface ImageAnalysis {
  width: number;
  height: number;
  format: string;
  bytes: number;
  /** 0..1 — how much fine detail the photo holds. Low means blurry or upscaled. */
  sharpness: number;
  /** 0..1 — mean luminance. Very low or very high hurts on video. */
  brightness: number;
  /** 0..1 — combined score used to rank photos against one another. */
  quality: number;
  phash: string;
  room: RoomType;
  roomConfidence: number;
  /** Normalised point of interest; the Ken Burns move is built around it. */
  focalX: number;
  focalY: number;
}

/**
 * Image analysis is behind this interface so a vision model can be added, swapped or removed
 * without touching the selection algorithm or the video engine.
 */
export interface ImageAnalyzer {
  readonly name: string;
  analyze(input: AnalyzerInput): Promise<ImageAnalysis>;
}

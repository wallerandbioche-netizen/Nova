import type { AspectRatio, DurationPreset, VideoStyle } from '@prisma/client';

/** A normalised rectangle inside the source image: 0..1 on both axes. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnimationName =
  | 'slowZoomIn'
  | 'slowZoomOut'
  | 'panLeft'
  | 'panRight'
  | 'panUp'
  | 'panDown'
  | 'subtlePush'
  | 'subtlePull';

export type TransitionName = 'crossfade' | 'dissolve' | 'fade' | 'softSlide';

export interface StoryboardScene {
  index: number;
  imageId: string;
  /** Resolved at render time only; the stored storyboard holds ids, not URLs. */
  src?: string;
  startSeconds: number;
  durationSeconds: number;
  animation: AnimationName;
  transitionIn: TransitionName;
  transitionDurationSeconds: number;
  /** Framing at the first and last frame of the scene; interpolated in between. */
  startRect: CropRect;
  endRect: CropRect;
}

export interface Storyboard {
  version: 1;
  style: VideoStyle;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  durationSeconds: number;
  scenes: StoryboardScene[];
}

export interface StoryboardImage {
  id: string;
  width: number;
  height: number;
  focalX: number;
  focalY: number;
  quality: number;
}

export interface StoryboardInput {
  images: StoryboardImage[];
  style: VideoStyle;
  aspectRatio: AspectRatio;
  duration: DurationPreset;
  fps?: number;
  /** Same seed + same input = same storyboard, frame for frame. */
  seed: number;
}

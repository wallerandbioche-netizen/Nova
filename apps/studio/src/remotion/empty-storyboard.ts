import type { Storyboard } from '../lib/video/types';

/** Placeholder metadata for the Remotion studio; every real render overrides all of it. */
export const EMPTY_STORYBOARD: Storyboard = {
  version: 1,
  style: 'CINEMATIC',
  aspectRatio: 'VERTICAL',
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 30,
  durationSeconds: 1,
  scenes: [],
};

import type { VideoStyle } from '@prisma/client';
import type { AnimationName, TransitionName } from './types';

/**
 * A style only changes rhythm, shot length, movement amplitude and transitions.
 * No style adds text, sound, graphics or colour grading — the photos stay the owner's photos.
 */
export interface StylePreset {
  id: VideoStyle;
  label: string;
  description: string;
  /** Target seconds per shot, before the natural variation applied per scene. */
  baseShotSeconds: number;
  /**
   * The shortest a shot may ever get. Below this a property photo reads as a flash rather than
   * a shot, so a short duration drops photos instead of speeding everything up.
   */
  minShotSeconds: number;
  /** Random ± fraction applied to each shot so the rhythm never feels mechanical. */
  shotVariation: number;
  /** Zoom travelled during a shot, as a fraction of the frame (0.06 = 6 %). */
  zoomAmplitude: number;
  /** Pan travelled during a shot, as a fraction of the available slack. */
  panAmplitude: number;
  transitionSeconds: number;
  transitions: TransitionName[];
  animations: AnimationName[];
  /** Establishing and closing shots hold slightly longer than the rest. */
  bookendMultiplier: number;
}

export const STYLES: Record<VideoStyle, StylePreset> = {
  CINEMATIC: {
    id: 'CINEMATIC',
    label: 'Cinematic',
    description: 'Mouvements lents, zooms subtils, transitions fluides. La référence immobilière.',
    baseShotSeconds: 2.9,
    minShotSeconds: 1.8,
    shotVariation: 0.16,
    zoomAmplitude: 0.075,
    panAmplitude: 0.35,
    transitionSeconds: 0.7,
    transitions: ['crossfade', 'dissolve'],
    animations: ['slowZoomIn', 'slowZoomOut', 'panLeft', 'panRight', 'subtlePush'],
    bookendMultiplier: 1.2,
  },
  MODERN: {
    id: 'MODERN',
    label: 'Modern',
    description: 'Un peu plus vif, mouvements plus courts, transitions nettes.',
    baseShotSeconds: 2.2,
    minShotSeconds: 1.4,
    shotVariation: 0.2,
    zoomAmplitude: 0.09,
    panAmplitude: 0.45,
    transitionSeconds: 0.45,
    transitions: ['crossfade', 'softSlide'],
    animations: ['slowZoomIn', 'panLeft', 'panRight', 'panUp', 'subtlePush', 'subtlePull'],
    bookendMultiplier: 1.12,
  },
  LUXURY: {
    id: 'LUXURY',
    label: 'Luxury',
    description: 'Plans longs, mouvements très subtils, transitions élégantes.',
    baseShotSeconds: 3.6,
    minShotSeconds: 2.2,
    shotVariation: 0.1,
    zoomAmplitude: 0.05,
    panAmplitude: 0.25,
    transitionSeconds: 0.9,
    transitions: ['dissolve', 'fade'],
    animations: ['slowZoomIn', 'slowZoomOut', 'subtlePush', 'subtlePull'],
    bookendMultiplier: 1.3,
  },
  DYNAMIC: {
    id: 'DYNAMIC',
    label: 'Dynamic',
    description: 'Rythme plus rapide, mouvements plus marqués, coupes plus fréquentes.',
    baseShotSeconds: 1.6,
    minShotSeconds: 1.3,
    shotVariation: 0.22,
    zoomAmplitude: 0.12,
    panAmplitude: 0.6,
    transitionSeconds: 0.32,
    transitions: ['crossfade', 'softSlide'],
    animations: ['slowZoomIn', 'slowZoomOut', 'panLeft', 'panRight', 'panUp', 'panDown', 'subtlePush'],
    bookendMultiplier: 1.05,
  },
};

export const STYLE_LIST = Object.values(STYLES);

export function getStyle(style: VideoStyle): StylePreset {
  return STYLES[style];
}

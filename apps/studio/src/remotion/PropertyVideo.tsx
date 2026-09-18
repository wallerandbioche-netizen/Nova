import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolateRect, rectToImageBox } from '../lib/video/framing';
import type { Storyboard, StoryboardScene } from '../lib/video/types';

/**
 * The composition.
 *
 * It draws photographs and nothing else: no text, no titles, no watermark, no overlay of
 * any kind, and no audio track. Every frame is a crop of one of the owner's photos, or a blend of two of them during
 * a transition.
 */
export const PropertyVideo: React.FC<{ storyboard: Storyboard }> = ({ storyboard }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {storyboard.scenes.map((scene) => (
        <Scene key={`${scene.index}-${scene.imageId}`} scene={scene} />
      ))}
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ scene: StoryboardScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = Math.round(scene.startSeconds * fps);
  const durationFrames = Math.max(1, Math.round(scene.durationSeconds * fps));
  const localFrame = frame - startFrame;

  // Frames outside this shot are not drawn at all: transitions overlap, everything else does not.
  if (localFrame < -1 || localFrame > durationFrames) return null;

  const progress = durationFrames <= 1 ? 1 : localFrame / durationFrames;
  // Ease-in-out: a camera move that starts and stops abruptly is what makes a slideshow feel like
  // a slideshow. The eased progress drives the geometry, the geometry stays linear.
  const eased = easeInOutCubic(clamp01(progress));
  const rect = interpolateRect(scene.startRect, scene.endRect, eased);
  const box = rectToImageBox(rect);

  const opacity = sceneOpacity(scene, localFrame, durationFrames, fps);
  const slide = scene.transitionIn === 'softSlide' ? softSlideOffset(scene, localFrame, fps) : 0;

  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateX(${slide}%)` }}>
        <Img
          src={scene.src ?? ''}
          style={{
            position: 'absolute',
            width: `${box.width}%`,
            height: `${box.height}%`,
            left: `${box.left}%`,
            top: `${box.top}%`,
            // The crop already carries the output ratio, so this never distorts the photo.
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Transitions are built from opacity alone (plus a few percent of travel for softSlide).
 * Nothing rotates, nothing flashes, nothing glitches: this has to be credible for real estate.
 */
function sceneOpacity(
  scene: StoryboardScene,
  localFrame: number,
  _durationFrames: number,
  fps: number,
): number {
  const transitionFrames = Math.max(1, Math.round(scene.transitionDurationSeconds * fps));
  // The outgoing shot is never faded out — the incoming one fades in on top of it. That is a
  // true crossfade, and it avoids the black flash a symmetric fade produces.
  return clamp01(
    interpolate(localFrame, [0, transitionFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
}

function softSlideOffset(scene: StoryboardScene, localFrame: number, fps: number): number {
  const transitionFrames = Math.max(1, Math.round(scene.transitionDurationSeconds * fps));
  return interpolate(localFrame, [0, transitionFrames], [2.2, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

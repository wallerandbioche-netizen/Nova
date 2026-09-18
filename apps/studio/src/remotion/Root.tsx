import React from 'react';
import { Composition } from 'remotion';
import { PropertyVideo } from './PropertyVideo';
import type { Storyboard } from '../lib/video/types';
import { EMPTY_STORYBOARD } from './empty-storyboard';

/**
 * A single composition whose every parameter — size, fps, length, scenes — comes from the
 * storyboard passed in as props. The renderer overrides them per render.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PropertyVideo"
      component={PropertyVideo as React.FC<Record<string, unknown>>}
      durationInFrames={EMPTY_STORYBOARD.durationInFrames}
      fps={EMPTY_STORYBOARD.fps}
      width={EMPTY_STORYBOARD.width}
      height={EMPTY_STORYBOARD.height}
      defaultProps={{ storyboard: EMPTY_STORYBOARD as Storyboard } as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const storyboard = (props as { storyboard: Storyboard }).storyboard;
        return {
          durationInFrames: storyboard.durationInFrames,
          fps: storyboard.fps,
          width: storyboard.width,
          height: storyboard.height,
        };
      }}
    />
  );
};

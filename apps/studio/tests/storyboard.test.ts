import { describe, expect, it } from 'vitest';
import { buildStoryboard, MIN_IMAGES } from '@/lib/video/storyboard';
import { automaticDuration, distributeShotDurations, resolveTargetDuration } from '@/lib/video/duration';
import { getStyle, STYLE_LIST } from '@/lib/video/styles';
import { getFormat } from '@/lib/video/formats';
import { createRng } from '@/lib/utils';
import { AppError } from '@/lib/errors';
import type { StoryboardImage } from '@/lib/video/types';

function images(count: number, overrides: Partial<StoryboardImage> = {}): StoryboardImage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `img-${index}`,
    width: 1920,
    height: 1280,
    focalX: 0.5,
    focalY: 0.5,
    quality: 0.7,
    ...overrides,
  }));
}

describe('buildStoryboard', () => {
  it('refuses to build a video from fewer than three photos', () => {
    expect(() => buildStoryboard({ images: images(MIN_IMAGES - 1), style: 'CINEMATIC', aspectRatio: 'VERTICAL', duration: 'AUTO', seed: 1 })).toThrow(AppError);
  });

  it('is deterministic for the same seed', () => {
    const input = { images: images(10), style: 'CINEMATIC' as const, aspectRatio: 'VERTICAL' as const, duration: 'S30' as const, seed: 7 };
    expect(JSON.stringify(buildStoryboard(input))).toBe(JSON.stringify(buildStoryboard(input)));
  });

  it('produces a different edit for a different seed', () => {
    const base = { images: images(10), style: 'CINEMATIC' as const, aspectRatio: 'VERTICAL' as const, duration: 'S30' as const };
    expect(JSON.stringify(buildStoryboard({ ...base, seed: 1 }))).not.toBe(
      JSON.stringify(buildStoryboard({ ...base, seed: 2 })),
    );
  });

  it('lands close to the requested duration', () => {
    for (const target of [15, 30, 45] as const) {
      const storyboard = buildStoryboard({
        images: images(14),
        style: 'CINEMATIC',
        aspectRatio: 'VERTICAL',
        duration: `S${target}` as 'S15' | 'S30' | 'S45',
        seed: 3,
      });
      // The requested duration is the duration of the finished video, transitions included.
      expect(storyboard.durationSeconds).toBeGreaterThanOrEqual(target * 0.9);
      expect(storyboard.durationSeconds).toBeLessThanOrEqual(target + 1);
    }
  });

  it('lays scenes out on a continuous timeline with overlapping transitions', () => {
    const storyboard = buildStoryboard({ images: images(8), style: 'MODERN', aspectRatio: 'SQUARE', duration: 'AUTO', seed: 5 });

    expect(storyboard.scenes[0]?.startSeconds).toBe(0);
    for (let index = 1; index < storyboard.scenes.length; index += 1) {
      const previous = storyboard.scenes[index - 1]!;
      const current = storyboard.scenes[index]!;
      const previousEnd = previous.startSeconds + previous.durationSeconds;
      // Each shot starts before the previous one ends: that overlap is the crossfade.
      expect(current.startSeconds).toBeLessThan(previousEnd);
      expect(current.startSeconds).toBeGreaterThan(previous.startSeconds);
      expect(previousEnd - current.startSeconds).toBeCloseTo(current.transitionDurationSeconds, 3);
    }
  });

  it('opens on a fade and never uses a flashy transition', () => {
    const storyboard = buildStoryboard({ images: images(12), style: 'DYNAMIC', aspectRatio: 'VERTICAL', duration: 'AUTO', seed: 11 });
    expect(storyboard.scenes[0]?.transitionIn).toBe('fade');
    for (const scene of storyboard.scenes) {
      expect(['crossfade', 'dissolve', 'fade', 'softSlide']).toContain(scene.transitionIn);
    }
  });

  it('never repeats the same movement twice in a row', () => {
    const storyboard = buildStoryboard({ images: images(16), style: 'CINEMATIC', aspectRatio: 'VERTICAL', duration: 'S45', seed: 21 });
    for (let index = 1; index < storyboard.scenes.length; index += 1) {
      expect(storyboard.scenes[index]?.animation).not.toBe(storyboard.scenes[index - 1]?.animation);
    }
  });

  it('does not pan a portrait photo sideways, nor a landscape photo vertically', () => {
    const portrait = buildStoryboard({ images: images(8, { width: 1080, height: 1620 }), style: 'DYNAMIC', aspectRatio: 'VERTICAL', duration: 'AUTO', seed: 4 });
    for (const scene of portrait.scenes) {
      expect(['panLeft', 'panRight']).not.toContain(scene.animation);
    }

    const landscape = buildStoryboard({ images: images(8, { width: 1920, height: 1080 }), style: 'DYNAMIC', aspectRatio: 'HORIZONTAL', duration: 'AUTO', seed: 4 });
    for (const scene of landscape.scenes) {
      expect(['panUp', 'panDown']).not.toContain(scene.animation);
    }
  });

  it('matches the requested output format exactly', () => {
    for (const aspectRatio of ['VERTICAL', 'HORIZONTAL', 'SQUARE'] as const) {
      const storyboard = buildStoryboard({ images: images(6), style: 'LUXURY', aspectRatio, duration: 'AUTO', seed: 9 });
      const format = getFormat(aspectRatio);
      expect([storyboard.width, storyboard.height]).toEqual([format.width, format.height]);
      expect(storyboard.durationInFrames).toBe(Math.round(storyboard.durationSeconds * storyboard.fps));
    }
  });

  it('drops the weakest photos rather than flashing 20 shots into 15 seconds', () => {
    const storyboard = buildStoryboard({ images: images(24), style: 'LUXURY', aspectRatio: 'VERTICAL', duration: 'S15', seed: 2 });
    expect(storyboard.scenes.length).toBeLessThan(24);
    for (const scene of storyboard.scenes) {
      expect(scene.durationSeconds).toBeGreaterThanOrEqual(1.1);
    }
  });

  it('keeps every style inside sane shot lengths', () => {
    for (const style of STYLE_LIST) {
      const storyboard = buildStoryboard({ images: images(12), style: style.id, aspectRatio: 'VERTICAL', duration: 'AUTO', seed: 6 });
      for (const scene of storyboard.scenes) {
        expect(scene.durationSeconds).toBeGreaterThanOrEqual(1.1);
        expect(scene.durationSeconds).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('duration model', () => {
  it('follows the two-seconds-per-photo rule on the default style', () => {
    const style = getStyle('CINEMATIC');
    expect(automaticDuration(10, style)).toBeCloseTo(22, 0);
    expect(automaticDuration(15, style)).toBeCloseTo(32, 0);
    expect(automaticDuration(20, style)).toBeCloseTo(42, 0);
  });

  it('stays inside the window a property video should live in', () => {
    for (const style of STYLE_LIST) {
      expect(automaticDuration(2, style)).toBeGreaterThanOrEqual(14);
      expect(automaticDuration(60, style)).toBeLessThanOrEqual(48);
    }
  });

  it('gives a faster style a shorter video for the same photos', () => {
    expect(automaticDuration(12, getStyle('DYNAMIC'))).toBeLessThan(
      automaticDuration(12, getStyle('LUXURY')),
    );
  });

  it('never cuts faster than the style allows', () => {
    for (const style of STYLE_LIST) {
      const durations = distributeShotDurations(20, 15, style, createRng(1));
      for (const duration of durations) {
        expect(duration).toBeGreaterThanOrEqual(style.minShotSeconds * 0.8 - 1e-9);
      }
    }
  });

  it('honours an explicit preset', () => {
    const style = getStyle('MODERN');
    expect(resolveTargetDuration('S15', 30, style)).toBe(15);
    expect(resolveTargetDuration('S45', 4, style)).toBe(45);
  });

  it('hits the target and varies the shot lengths', () => {
    const style = getStyle('CINEMATIC');
    const durations = distributeShotDurations(10, 30, style, createRng(1));
    const total = durations.reduce((sum, value) => sum + value, 0);

    expect(total).toBeGreaterThan(28);
    expect(total).toBeLessThan(32);
    expect(new Set(durations).size).toBeGreaterThan(5);
  });

  it('holds the first and last shot longer', () => {
    const style = getStyle('LUXURY');
    const durations = distributeShotDurations(8, 40, style, createRng(3));
    const middleAverage = durations.slice(1, -1).reduce((sum, value) => sum + value, 0) / 6;
    expect(durations[0]).toBeGreaterThan(middleAverage * 0.95);
    expect(durations.at(-1)).toBeGreaterThan(middleAverage * 0.95);
  });
});

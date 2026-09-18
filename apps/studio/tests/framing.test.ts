import { describe, expect, it } from 'vitest';
import {
  buildMove,
  coverage,
  interpolateRect,
  maxCoverRect,
  rectAtZoom,
  rectToImageBox,
} from '@/lib/video/framing';
import type { AnimationName, CropRect } from '@/lib/video/types';

const VERTICAL = 1080 / 1920;
const HORIZONTAL = 1920 / 1080;

const LANDSCAPE = { imageWidth: 3000, imageHeight: 2000, focalX: 0.5, focalY: 0.5 };
const PORTRAIT = { imageWidth: 2000, imageHeight: 3000, focalX: 0.5, focalY: 0.5 };

function assertInsideImage(rect: CropRect) {
  expect(rect.x).toBeGreaterThanOrEqual(-1e-9);
  expect(rect.y).toBeGreaterThanOrEqual(-1e-9);
  expect(rect.x + rect.width).toBeLessThanOrEqual(1 + 1e-9);
  expect(rect.y + rect.height).toBeLessThanOrEqual(1 + 1e-9);
}

/** The crop must carry the output ratio exactly, or the photo would be stretched on screen. */
function assertAspect(rect: CropRect, input: { imageWidth: number; imageHeight: number }, ratio: number) {
  const actual = (rect.width * input.imageWidth) / (rect.height * input.imageHeight);
  expect(actual).toBeCloseTo(ratio, 6);
}

describe('cover framing', () => {
  it('fills the frame without leaving bars', () => {
    expect(maxCoverRect({ ...LANDSCAPE, outputRatio: VERTICAL })).toEqual({
      width: VERTICAL / (3000 / 2000),
      height: 1,
    });
    expect(maxCoverRect({ ...PORTRAIT, outputRatio: HORIZONTAL }).width).toBe(1);
  });

  it('reports how much of a photo survives a hard crop', () => {
    expect(coverage({ ...LANDSCAPE, outputRatio: VERTICAL })).toBeLessThan(0.45);
    expect(coverage({ ...LANDSCAPE, outputRatio: HORIZONTAL })).toBeGreaterThan(0.8);
  });

  it('keeps the output ratio at every zoom level', () => {
    for (const zoom of [1, 1.05, 1.2, 2]) {
      const rect = rectAtZoom({ ...LANDSCAPE, outputRatio: VERTICAL }, zoom);
      assertAspect(rect, LANDSCAPE, VERTICAL);
      assertInsideImage(rect);
    }
  });

  it('never leaves the image, even with an extreme focal point', () => {
    const rect = rectAtZoom({ ...LANDSCAPE, focalX: 0.99, focalY: 0.01, outputRatio: VERTICAL }, 1.1);
    assertInsideImage(rect);
  });
});

const ANIMATIONS: AnimationName[] = [
  'slowZoomIn',
  'slowZoomOut',
  'panLeft',
  'panRight',
  'panUp',
  'panDown',
  'subtlePush',
  'subtlePull',
];

describe('camera moves', () => {
  it.each(ANIMATIONS)('%s stays inside the photo and keeps the ratio', (animation) => {
    for (const [source, ratio] of [
      [LANDSCAPE, VERTICAL],
      [LANDSCAPE, HORIZONTAL],
      [PORTRAIT, VERTICAL],
      [PORTRAIT, HORIZONTAL],
    ] as const) {
      const { startRect, endRect } = buildMove({
        ...source,
        outputRatio: ratio,
        animation,
        zoomAmplitude: 0.08,
        panAmplitude: 0.4,
      });

      for (const rect of [startRect, endRect, interpolateRect(startRect, endRect, 0.5)]) {
        assertInsideImage(rect);
        assertAspect(rect, source, ratio);
      }
    }
  });

  it('actually moves the frame', () => {
    const { startRect, endRect } = buildMove({
      ...LANDSCAPE,
      outputRatio: HORIZONTAL,
      animation: 'slowZoomIn',
      zoomAmplitude: 0.08,
      panAmplitude: 0.4,
    });
    expect(endRect.width).toBeLessThan(startRect.width);
  });

  it('pans along the axis it is named after', () => {
    const { startRect, endRect } = buildMove({
      ...LANDSCAPE,
      outputRatio: VERTICAL,
      animation: 'panRight',
      zoomAmplitude: 0.08,
      panAmplitude: 0.5,
    });
    expect(Math.abs(endRect.x - startRect.x)).toBeGreaterThan(0.01);
    expect(endRect.y).toBeCloseTo(startRect.y, 6);
  });

  it('still produces a valid move when the photo matches the frame exactly', () => {
    // A 9:16 photo in a 9:16 frame has almost no slack: the move must stay legal anyway.
    const source = { imageWidth: 1080, imageHeight: 1920, focalX: 0.5, focalY: 0.5 };
    const { startRect, endRect } = buildMove({
      ...source,
      outputRatio: VERTICAL,
      animation: 'panLeft',
      zoomAmplitude: 0.08,
      panAmplitude: 0.5,
    });

    assertInsideImage(startRect);
    assertInsideImage(endRect);
    assertAspect(startRect, source, VERTICAL);

    const moved =
      Math.abs(endRect.x - startRect.x) > 1e-6 ||
      Math.abs(endRect.y - startRect.y) > 1e-6 ||
      Math.abs(endRect.width - startRect.width) > 1e-6;
    expect(moved).toBe(true);
  });
});

describe('rectToImageBox', () => {
  it('maps the crop onto the frame', () => {
    expect(rectToImageBox({ x: 0, y: 0, width: 1, height: 1 })).toEqual({
      width: 100,
      height: 100,
      left: 0,
      top: 0,
    });
  });

  it('scales and offsets a partial crop', () => {
    const box = rectToImageBox({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(box.width).toBe(200);
    expect(box.left).toBe(-50);
  });
});

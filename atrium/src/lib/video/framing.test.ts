import { describe, expect, it } from 'vitest';
import { MOTION_TYPES, type MotionType } from '@/types/domain';
import { computeFraming, unionBox } from './framing';

const SOURCES = [
  { name: 'paysage', sourceWidth: 1600, sourceHeight: 1067 },
  { name: 'portrait', sourceWidth: 1067, sourceHeight: 1600 },
  { name: 'carré', sourceWidth: 1200, sourceHeight: 1200 },
  { name: 'très large', sourceWidth: 1920, sourceHeight: 820 },
];

const TARGETS = [
  { name: '9:16', targetWidth: 1080, targetHeight: 1920 },
  { name: '16:9', targetWidth: 1920, targetHeight: 1080 },
  { name: '4:5', targetWidth: 1080, targetHeight: 1350 },
];

const FOCUS_POINTS = [
  { x: 0.5, y: 0.5 },
  { x: 0.08, y: 0.12 },
  { x: 0.95, y: 0.88 },
  { x: 0.62, y: 0.48 },
];

describe('computeFraming', () => {
  it('produit des cadres au format de sortie, dans les limites de la photo', () => {
    for (const source of SOURCES) {
      for (const target of TARGETS) {
        for (const focusPoint of FOCUS_POINTS) {
          for (const motion of MOTION_TYPES) {
            const framing = computeFraming({ ...source, ...target, focusPoint, motion });

            for (const rect of [framing.startRect, framing.endRect]) {
              const label = `${source.name}/${target.name}/${motion}`;
              expect(rect.x, label).toBeGreaterThanOrEqual(-1e-9);
              expect(rect.y, label).toBeGreaterThanOrEqual(-1e-9);
              expect(rect.x + rect.width, label).toBeLessThanOrEqual(1 + 1e-9);
              expect(rect.y + rect.height, label).toBeLessThanOrEqual(1 + 1e-9);

              const pixelAspect =
                (rect.width * source.sourceWidth) / (rect.height * source.sourceHeight);
              expect(pixelAspect, label).toBeCloseTo(target.targetWidth / target.targetHeight, 5);
            }
          }
        }
      }
    }
  });

  it('garde le sujet dans le cadre, du début à la fin', () => {
    for (const source of SOURCES) {
      for (const target of TARGETS) {
        for (const focusPoint of FOCUS_POINTS) {
          for (const motion of MOTION_TYPES) {
            const framing = computeFraming({ ...source, ...target, focusPoint, motion });
            for (const rect of [framing.startRect, framing.endRect]) {
              // Le point focal peut être hors champ seulement s'il est lui-même
              // collé au bord de la photo et que le cadre touche déjà ce bord.
              const insideX =
                focusPoint.x >= rect.x - 1e-6 && focusPoint.x <= rect.x + rect.width + 1e-6;
              const insideY =
                focusPoint.y >= rect.y - 1e-6 && focusPoint.y <= rect.y + rect.height + 1e-6;
              expect(insideX && insideY, `${source.name}/${target.name}/${motion}`).toBe(true);
            }
          }
        }
      }
    }
  });

  it('remplace un panoramique impossible par un travelling', () => {
    // Une photo paysage recadrée en 9:16 n'offre aucune course verticale
    // au facteur de zoom demandé.
    const framing = computeFraming({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetWidth: 1080,
      targetHeight: 1920,
      focusPoint: { x: 0.5, y: 0.5 },
      motion: 'pan_up',
    });
    expect(framing.motion).not.toBe('pan_up');
  });

  it('déplace réellement la caméra vers la droite sur un panoramique droite', () => {
    const framing = computeFraming({
      sourceWidth: 1600,
      sourceHeight: 1067,
      targetWidth: 1080,
      targetHeight: 1920,
      focusPoint: { x: 0.5, y: 0.5 },
      motion: 'pan_right',
    });
    expect(framing.motion).toBe('pan_right');
    expect(framing.endRect.x).toBeGreaterThan(framing.startRect.x + 0.01);
  });

  it('resserre le cadre sur un travelling avant', () => {
    const framing = computeFraming({
      sourceWidth: 1600,
      sourceHeight: 1067,
      targetWidth: 1920,
      targetHeight: 1080,
      focusPoint: { x: 0.62, y: 0.48 },
      motion: 'slow_push_in',
    });
    expect(framing.endRect.width).toBeLessThan(framing.startRect.width);
  });
});

describe('unionBox', () => {
  it('contient les deux cadres et reste dans la photo', () => {
    for (const source of SOURCES) {
      for (const motion of MOTION_TYPES as readonly MotionType[]) {
        const target = { targetWidth: 1080, targetHeight: 1920 };
        const framing = computeFraming({
          ...source,
          ...target,
          focusPoint: { x: 0.3, y: 0.7 },
          motion,
        });
        const box = unionBox(
          framing.startRect,
          framing.endRect,
          source.sourceWidth,
          source.sourceHeight,
        );

        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(source.sourceWidth);
        expect(box.y + box.height).toBeLessThanOrEqual(source.sourceHeight);

        for (const rect of [framing.startRect, framing.endRect]) {
          expect(rect.x * source.sourceWidth).toBeGreaterThanOrEqual(box.x - 1e-6);
          expect(rect.y * source.sourceHeight).toBeGreaterThanOrEqual(box.y - 1e-6);
          expect((rect.x + rect.width) * source.sourceWidth).toBeLessThanOrEqual(
            box.x + box.width + 1e-6,
          );
          expect((rect.y + rect.height) * source.sourceHeight).toBeLessThanOrEqual(
            box.y + box.height + 1e-6,
          );
        }
      }
    }
  });
});

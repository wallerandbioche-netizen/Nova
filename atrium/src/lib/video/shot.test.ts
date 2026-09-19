import { describe, expect, it } from 'vitest';
import { MOTION_TYPES } from '@/types/domain';
import { computeFraming } from './framing';
import { buildShotFilter, planShot } from './shot';

const SOURCES = [
  { sourceWidth: 1600, sourceHeight: 1067 },
  { sourceWidth: 1067, sourceHeight: 1600 },
  { sourceWidth: 1200, sourceHeight: 1200 },
  { sourceWidth: 1920, sourceHeight: 820 },
  { sourceWidth: 640, sourceHeight: 480 },
];

const TARGETS = [
  { outputWidth: 1080, outputHeight: 1920 },
  { outputWidth: 1920, outputHeight: 1080 },
  { outputWidth: 1080, outputHeight: 1350 },
];

describe('planShot', () => {
  it('produit une géométrie valide pour toutes les combinaisons', () => {
    for (const source of SOURCES) {
      for (const target of TARGETS) {
        for (const motion of MOTION_TYPES) {
          const framing = computeFraming({
            ...source,
            targetWidth: target.outputWidth,
            targetHeight: target.outputHeight,
            focusPoint: { x: 0.7, y: 0.35 },
            motion,
          });
          const plan = planShot({
            ...source,
            ...target,
            startRect: framing.startRect,
            endRect: framing.endRect,
            duration: 3,
            fps: 30,
          });
          const label = `${source.sourceWidth}x${source.sourceHeight}/${motion}`;

          // L'extraction reste dans la photo.
          expect(plan.extract.left + plan.extract.width, label).toBeLessThanOrEqual(
            source.sourceWidth,
          );
          expect(plan.extract.top + plan.extract.height, label).toBeLessThanOrEqual(
            source.sourceHeight,
          );

          // La fenêtre tient dans l'image de travail, aux deux extrémités.
          expect(plan.crop.width, label).toBeLessThanOrEqual(plan.work.width);
          expect(plan.crop.height, label).toBeLessThanOrEqual(plan.work.height);
          for (const position of [plan.cropStart, plan.cropEnd]) {
            expect(position.x, label).toBeGreaterThanOrEqual(0);
            expect(position.y, label).toBeGreaterThanOrEqual(0);
            expect(position.x + plan.crop.width, label).toBeLessThanOrEqual(plan.work.width);
            expect(position.y + plan.crop.height, label).toBeLessThanOrEqual(plan.work.height);
          }

          // Le cadre visible tient dans la fenêtre : le zoom reste ≥ 1.
          for (const inset of [plan.insetStart, plan.insetEnd]) {
            expect(inset.x, label).toBeGreaterThanOrEqual(0);
            expect(inset.width, label).toBeLessThanOrEqual(plan.crop.width + 1e-6);
            expect(inset.x + inset.width, label).toBeLessThanOrEqual(plan.crop.width + 1e-6);
          }

          // La fenêtre respecte le format de sortie à un pixel près.
          const ratio = plan.crop.width / plan.crop.height;
          expect(ratio, label).toBeCloseTo(target.outputWidth / target.outputHeight, 1);

          expect(plan.work.width, label).toBeLessThanOrEqual(4600);
          expect(plan.work.height, label).toBeLessThanOrEqual(4600);
        }
      }
    }
  });

  it('cale la durée sur un nombre entier d\'images', () => {
    const plan = planShot({
      sourceWidth: 1600,
      sourceHeight: 1067,
      startRect: { x: 0, y: 0, width: 0.5, height: 1 },
      endRect: { x: 0.1, y: 0, width: 0.5, height: 1 },
      outputWidth: 1080,
      outputHeight: 1920,
      duration: 2.77,
      fps: 30,
    });
    expect(plan.frames).toBe(83);
    expect(plan.duration).toBeCloseTo(83 / 30, 6);
  });
});

describe('buildShotFilter', () => {
  it('assemble une chaîne crop → zoompan bornée', () => {
    const plan = planShot({
      sourceWidth: 1600,
      sourceHeight: 1067,
      startRect: { x: 0.02, y: 0, width: 0.36, height: 1 },
      endRect: { x: 0.12, y: 0, width: 0.34, height: 0.95 },
      outputWidth: 1080,
      outputHeight: 1920,
      duration: 3,
      fps: 30,
    });
    const filter = buildShotFilter(plan, 1080, 1920, 30);
    expect(filter).toMatch(/^crop=w=\d+:h=\d+/);
    expect(filter).toContain('zoompan=');
    expect(filter).toContain('s=1080x1920');
    expect(filter).toContain('format=yuv420p');
    // Toutes les expressions de position sont bornées.
    expect(filter.match(/max\(0,min\(/g)?.length).toBe(4);
  });
});

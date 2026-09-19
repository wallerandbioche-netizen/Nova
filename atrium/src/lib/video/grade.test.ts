import { describe, expect, it } from 'vitest';
import { exposurePlan } from './grade';

describe('exposurePlan', () => {
  it('ne touche pas à une série homogène, même très claire', () => {
    // Un logement clair doit rester clair : il n'y a aucun écart à rattraper.
    expect(exposurePlan([0.78, 0.8, 0.82, 0.79])).toEqual([1, 1, 1, 1]);
    expect(exposurePlan([0.3, 0.32, 0.31])).toEqual([1, 1, 1]);
  });

  it('rapproche les plans dispersés de la médiane', () => {
    const factors = exposurePlan([0.3, 0.5, 0.7]);
    expect(factors[0]).toBeGreaterThan(1); // le plan sombre s'éclaircit
    expect(factors[1]).toBe(1); // le plan médian ne bouge pas
    expect(factors[2]).toBeLessThan(1); // le plan clair s'assombrit
  });

  it('ne corrige que partiellement', () => {
    // Rattraper tout l'écart donnerait ×1.67 ; on reste loin en deçà.
    const [factor] = exposurePlan([0.3, 0.5, 0.5, 0.5, 0.5]);
    expect(factor).toBeLessThan(1.3);
  });

  it('reste dans une amplitude modérée quel que soit l\'écart', () => {
    for (const factor of exposurePlan([0.03, 0.1, 0.5, 0.9, 0.99])) {
      expect(factor).toBeGreaterThanOrEqual(0.92);
      expect(factor).toBeLessThanOrEqual(1.08);
    }
  });

  it('ne se déclenche pas sur une seule photo aberrante', () => {
    // Neuf plans homogènes et un plan sombre : les déciles absorbent l'écart.
    const series = [0.5, 0.5, 0.51, 0.49, 0.5, 0.52, 0.48, 0.5, 0.5, 0.12];
    expect(exposurePlan(series).every((factor) => factor === 1)).toBe(true);
  });

  it('laisse intacts les plans illisibles et les séries trop courtes', () => {
    expect(exposurePlan([0.01, 0.9, 0.2, 0.9])[0]).toBe(1);
    expect(exposurePlan([0.9])).toEqual([1]);
    expect(exposurePlan([])).toEqual([]);
  });

  it('renvoie autant de facteurs que de plans, dans le même ordre', () => {
    expect(exposurePlan([0.2, 0.5, 0.8, Number.NaN])).toHaveLength(4);
    expect(exposurePlan([0.2, 0.5, 0.8, Number.NaN])[3]).toBe(1);
  });
});

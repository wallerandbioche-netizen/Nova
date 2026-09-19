import { describe, expect, it } from 'vitest';
import { ease, lerpExpression } from './easing';

describe('ease', () => {
  it('va de 0 à 1 sans dépassement', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    for (let i = 0; i <= 20; i += 1) {
      const value = ease(i / 20);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('est monotone', () => {
    let previous = -1;
    for (let i = 0; i <= 40; i += 1) {
      const value = ease(i / 40);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it('ne s\'immobilise jamais complètement aux extrémités', () => {
    expect(ease(0.02)).toBeGreaterThan(0.004);
    expect(1 - ease(0.98)).toBeGreaterThan(0.004);
  });
});

describe('lerpExpression', () => {
  it('réduit une valeur constante à un littéral', () => {
    expect(lerpExpression(12, 12, 'n', 90)).toBe('12.0000');
  });

  it('produit une expression bornée exploitable par ffmpeg', () => {
    const expression = lerpExpression(0, 100, 'n', 90);
    expect(expression).toContain('min(1,n/89)');
    expect(expression.startsWith('(0.0000+(100.0000)*')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { entitlementsFor, getPlan, hasEntitlement, PLANS } from './plans.js';
import { CATEGORY_BASE_IMPORTANCE, IMPORTANCE_WEIGHTS, RELEVANCE_WEIGHTS } from './scoring.js';

describe('plan catalogue', () => {
  it('keeps prices out of the client by exposing them as configuration', () => {
    expect(PLANS.premium.priceAmount).toBeGreaterThan(0);
    expect(PLANS.premium.priceCurrency).toBe('EUR');
    expect(PLANS.free.priceAmount).toBe(0);
  });

  it('grants no premium entitlement on the free plan', () => {
    expect(entitlementsFor('free')).toEqual([]);
    expect(hasEntitlement('free', 'market_radar')).toBe(false);
    expect(hasEntitlement('premium', 'market_radar')).toBe(true);
  });

  it('falls back to the free plan for an unknown key', () => {
    expect(getPlan('unknown' as 'free').key).toBe('free');
  });

  it('limits free AI usage but not premium', () => {
    expect(PLANS.free.limits.aiQuestionsPerDay).toBeGreaterThan(0);
    expect(PLANS.premium.limits.aiQuestionsPerDay).toBeNull();
  });
});

describe('scoring configuration', () => {
  it('keeps importance weights normalised', () => {
    const total = Object.values(IMPORTANCE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('keeps relevance weights normalised', () => {
    const total = Object.values(RELEVANCE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('keeps every category baseline inside 0-100', () => {
    for (const value of Object.values(CATEGORY_BASE_IMPORTANCE)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

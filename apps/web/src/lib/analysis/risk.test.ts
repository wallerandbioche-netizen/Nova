import { describe, expect, it } from 'vitest';
import { computePositionSize, riskRewardRatio, RISK_PROFILES, zoneMid } from './risk';

describe('riskRewardRatio', () => {
  it('measures the reward against the stop distance for a long', () => {
    expect(riskRewardRatio(100, 95, 115, 'long')).toBe(3);
  });

  it('measures the reward against the stop distance for a short', () => {
    expect(riskRewardRatio(100, 105, 90, 'short')).toBe(2);
  });

  it('returns 0 when the stop sits on the wrong side of the entry', () => {
    expect(riskRewardRatio(100, 105, 115, 'long')).toBe(0);
    expect(riskRewardRatio(100, 95, 90, 'short')).toBe(0);
  });

  it('returns 0 when the target is behind the entry', () => {
    expect(riskRewardRatio(100, 95, 99, 'long')).toBe(0);
  });

  it('returns 0 without a direction', () => {
    expect(riskRewardRatio(100, 95, 110, 'none')).toBe(0);
  });
});

describe('computePositionSize', () => {
  it('sizes the position from the risk budget and the stop distance', () => {
    const result = computePositionSize({
      accountSize: 10_000,
      riskPercent: 1,
      entry: 100,
      stopLoss: 95,
      takeProfit: 110,
      direction: 'long',
    });

    expect(result.maximumRisk).toBe(100);
    expect(result.positionSize).toBe(20);
    expect(result.notional).toBe(2_000);
    expect(result.stopDistance).toBe(5);
    expect(result.stopDistancePercent).toBeCloseTo(5, 5);
    expect(result.potentialLoss).toBe(100);
    expect(result.riskReward).toBe(2);
    expect(result.potentialProfit).toBe(200);
    expect(result.warnings).toHaveLength(0);
  });

  it('never silently increases the requested risk', () => {
    const result = computePositionSize({
      accountSize: 50_000,
      riskPercent: 0.5,
      entry: 200,
      stopLoss: 190,
      direction: 'long',
    });

    expect(result.maximumRisk).toBe(250);
    expect(result.positionSize * result.stopDistance).toBeCloseTo(250, 6);
  });

  it('warns above two percent of the account', () => {
    const result = computePositionSize({
      accountSize: 10_000,
      riskPercent: 5,
      entry: 100,
      stopLoss: 95,
      direction: 'long',
    });

    expect(result.warnings.some((warning) => warning.includes('2 %'))).toBe(true);
  });

  it('refuses to size a position when entry and stop are identical', () => {
    const result = computePositionSize({
      accountSize: 10_000,
      riskPercent: 1,
      entry: 100,
      stopLoss: 100,
      direction: 'long',
    });

    expect(result.positionSize).toBe(0);
    expect(result.warnings.join(' ')).toContain('incalculable');
  });

  it('flags a stop placed on the wrong side of the entry', () => {
    const result = computePositionSize({
      accountSize: 10_000,
      riskPercent: 1,
      entry: 100,
      stopLoss: 110,
      direction: 'long',
    });

    expect(result.warnings.join(' ')).toContain('mauvais côté');
  });
});

describe('risk profiles', () => {
  it('tightens every gate as the profile gets more conservative', () => {
    expect(RISK_PROFILES.prudent.minConfluence).toBeGreaterThan(RISK_PROFILES.modere.minConfluence);
    expect(RISK_PROFILES.modere.minConfluence).toBeGreaterThan(
      RISK_PROFILES.agressif.minConfluence,
    );
    expect(RISK_PROFILES.prudent.minRiskReward).toBeGreaterThan(
      RISK_PROFILES.agressif.minRiskReward,
    );
    expect(RISK_PROFILES.prudent.maxRiskPercent).toBeLessThan(
      RISK_PROFILES.agressif.maxRiskPercent,
    );
  });
});

describe('zoneMid', () => {
  it('returns the middle of an entry zone', () => {
    expect(zoneMid({ low: 100, high: 110 })).toBe(105);
  });
});

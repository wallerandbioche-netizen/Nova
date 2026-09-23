import { describe, expect, it } from 'vitest';
import { RISK_PROFILES } from '@/lib/analysis/risk';
import { ASSETS } from '@/lib/market-data';
import {
  DEFAULT_ANSWERS,
  SUGGESTED_PROFILE,
  normalizeAccountSize,
  settingsPatchFor,
} from '@/lib/onboarding/questions';

describe('onboarding answers', () => {
  it('marks the questionnaire as answered', () => {
    expect(settingsPatchFor(DEFAULT_ANSWERS).onboarded).toBe(true);
  });

  it('takes the risk share from the chosen profile, not from a constant', () => {
    for (const riskProfile of ['prudent', 'modere', 'agressif'] as const) {
      const patch = settingsPatchFor({ ...DEFAULT_ANSWERS, riskProfile });
      expect(patch.riskProfile).toBe(riskProfile);
      expect(patch.riskPercent).toBe(RISK_PROFILES[riskProfile].defaultRiskPercent);
    }
  });

  it('suggests the cautious profile to a beginner', () => {
    expect(SUGGESTED_PROFILE.debutant).toBe('prudent');
  });

  it('pre-selects an instrument the catalogue really has', () => {
    for (const playground of ['actions', 'crypto', 'forex', 'indices'] as const) {
      const patch = settingsPatchFor({ ...DEFAULT_ANSWERS, playground });
      expect(ASSETS.some((asset) => asset.id === patch.defaultAssetId)).toBe(true);
    }
  });

  it('keeps the calibration answers verbatim', () => {
    const patch = settingsPatchFor({
      ...DEFAULT_ANSWERS,
      experience: 'confirme',
      playground: 'crypto',
      objective: 'performer',
    });
    expect(patch.calibration).toEqual({
      experience: 'confirme',
      playground: 'crypto',
      objective: 'performer',
    });
  });

  describe('account size', () => {
    it('falls back to the default on an empty or negative amount', () => {
      expect(normalizeAccountSize(Number.NaN)).toBe(DEFAULT_ANSWERS.accountSize);
      expect(normalizeAccountSize(0)).toBe(DEFAULT_ANSWERS.accountSize);
      expect(normalizeAccountSize(-500)).toBe(DEFAULT_ANSWERS.accountSize);
    });

    it('rounds and caps an absurd amount', () => {
      expect(normalizeAccountSize(12_345.6)).toBe(12_346);
      expect(normalizeAccountSize(1e12)).toBe(100_000_000);
    });
  });
});

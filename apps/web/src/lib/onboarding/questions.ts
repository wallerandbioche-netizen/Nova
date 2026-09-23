import type { RiskProfile } from '@/types/analysis';
import { RISK_PROFILES } from '@/lib/analysis/risk';
import type { Settings } from '@/lib/storage/settings';

export type Experience = Settings['calibration']['experience'];
export type Playground = Settings['calibration']['playground'];
export type Objective = Settings['calibration']['objective'];

/** What the first-visit questionnaire collects, before it becomes settings. */
export interface OnboardingAnswers {
  experience: Experience;
  playground: Playground;
  objective: Objective;
  riskProfile: RiskProfile;
  accountSize: number;
}

export const DEFAULT_ANSWERS: OnboardingAnswers = {
  experience: 'debutant',
  playground: 'indices',
  objective: 'comprendre',
  riskProfile: 'prudent',
  accountSize: 10_000,
};

/**
 * Instrument pre-selected for the demonstration analysis. The catalogue has no
 * single stocks, so an equity answer lands on the index that tracks them.
 */
const DEFAULT_ASSET: Record<Playground, string> = {
  actions: 'SPX500',
  crypto: 'BTCUSDT',
  forex: 'EURUSD',
  indices: 'NAS100',
};

/**
 * Risk profile put forward once the experience is known. It is a suggestion
 * the questionnaire pre-selects, never a choice made for the user.
 */
export const SUGGESTED_PROFILE: Record<Experience, RiskProfile> = {
  debutant: 'prudent',
  intermediaire: 'modere',
  confirme: 'modere',
};

export const CAPITAL_PRESETS = [1_000, 5_000, 10_000, 50_000] as const;

/** Guards against an empty or absurd amount typed in the capital step. */
export function normalizeAccountSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_ANSWERS.accountSize;
  return Math.min(Math.round(value), 100_000_000);
}

/**
 * Turns the answers into the settings they configure. Everything here has a
 * visible effect: the risk profile drives the engine's gates, the capital and
 * the risk share drive the position calculator.
 */
export function settingsPatchFor(answers: OnboardingAnswers): Partial<Settings> {
  return {
    onboarded: true,
    riskProfile: answers.riskProfile,
    accountSize: normalizeAccountSize(answers.accountSize),
    riskPercent: RISK_PROFILES[answers.riskProfile].defaultRiskPercent,
    defaultAssetId: DEFAULT_ASSET[answers.playground],
    calibration: {
      experience: answers.experience,
      playground: answers.playground,
      objective: answers.objective,
    },
  };
}

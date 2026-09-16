import {
  EXPERIENCE_LABELS,
  INVESTMENT_GOAL_LABELS,
  INVESTMENT_HORIZON_LABELS,
  RISK_TOLERANCE_LABELS,
  ASSET_TYPE_LABELS,
} from '@nova/config';
import type { Option } from '@nova/ui';

/**
 * Onboarding copy.
 *
 * The risk step presents a concrete scenario rather than an abstract slider, as specified, and
 * the screen states explicitly that this questionnaire is not, on its own, a regulatory
 * suitability assessment.
 */
export const GOAL_OPTIONS: Option[] = Object.entries(INVESTMENT_GOAL_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export const HORIZON_OPTIONS: Option[] = Object.entries(INVESTMENT_HORIZON_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const EXPERIENCE_OPTIONS: Option[] = [
  {
    value: 'beginner',
    label: EXPERIENCE_LABELS.beginner,
    description: 'Je débute ou j’ai investi ponctuellement.',
  },
  {
    value: 'intermediate',
    label: EXPERIENCE_LABELS.intermediate,
    description: 'J’investis régulièrement et je comprends les bases.',
  },
  {
    value: 'advanced',
    label: EXPERIENCE_LABELS.advanced,
    description: 'Je suis à l’aise avec les mécanismes de marché.',
  },
];

export const RISK_SCENARIO =
  'Votre portefeuille perd temporairement 20 %. Quelle réaction vous correspond le mieux ?';

export const RISK_OPTIONS: Option[] = [
  { value: 'very_cautious', label: RISK_TOLERANCE_LABELS.very_cautious },
  { value: 'cautious', label: RISK_TOLERANCE_LABELS.cautious },
  { value: 'balanced', label: RISK_TOLERANCE_LABELS.balanced },
  { value: 'opportunistic', label: RISK_TOLERANCE_LABELS.opportunistic },
];

export const ASSET_TYPE_OPTIONS: Option[] = Object.entries(ASSET_TYPE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export const ONBOARDING_STEPS = [
  'goal',
  'horizon',
  'experience',
  'risk',
  'assets',
  'portfolio',
  'ready',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function stepProgress(step: OnboardingStep): { index: number; total: number } {
  return { index: ONBOARDING_STEPS.indexOf(step) + 1, total: ONBOARDING_STEPS.length };
}

import type { SubscriptionPlan, SubscriptionStatus } from './enums.js';
import type { Iso8601 } from './common.js';

export const PREMIUM_FEATURES = [
  'ai_coach_unlimited',
  'market_radar',
  'advanced_portfolio_analysis',
  'brief_history',
  'advanced_journal',
  'custom_alerts',
] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

export interface PlanDefinition {
  key: SubscriptionPlan;
  name: string;
  description: string;
  /** Price in minor units; never hardcoded in the mobile app. */
  priceAmount: number;
  priceCurrency: string;
  interval: 'month' | 'year' | null;
  features: string[];
  includedFeatureKeys: PremiumFeature[];
  limits: {
    aiQuestionsPerDay: number | null;
    briefHistoryDays: number | null;
    portfolios: number;
  };
}

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Iso8601 | null;
  cancelAtPeriodEnd: boolean;
  /** Feature keys the user can access right now, resolved server-side. */
  entitlements: PremiumFeature[];
  provider: string;
}

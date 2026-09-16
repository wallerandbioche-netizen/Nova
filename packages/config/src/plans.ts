import type { PlanDefinition, PremiumFeature, SubscriptionPlan } from '@nova/types';

/**
 * Plan catalogue. Prices live here (and can be overridden by environment) instead of being
 * hardcoded in the mobile app, so pricing can be tested without shipping a new build.
 *
 * 9,99 €/mois is the initial hypothesis from the product brief, not a validated price point.
 */
export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'NOVA',
    description: 'Comprendre vos investissements au quotidien.',
    priceAmount: 0,
    priceCurrency: 'EUR',
    interval: null,
    features: [
      'Briefing quotidien (3 actualités)',
      'Actualités financières expliquées',
      'Portefeuille manuel',
      'Leçons essentielles',
      'Journal d’investissement',
    ],
    includedFeatureKeys: [],
    limits: {
      aiQuestionsPerDay: 5,
      briefHistoryDays: 7,
      portfolios: 1,
    },
  },
  premium: {
    key: 'premium',
    name: 'NOVA Premium',
    description: 'L’analyse personnalisée complète de votre portefeuille.',
    priceAmount: 999,
    priceCurrency: 'EUR',
    interval: 'month',
    features: [
      'Briefing quotidien complet',
      'AI Coach sans limite quotidienne',
      'Analyse de portefeuille avancée',
      'Market Radar',
      'Alertes personnalisées',
      'Journal avancé et historique complet',
    ],
    includedFeatureKeys: [
      'ai_coach_unlimited',
      'market_radar',
      'advanced_portfolio_analysis',
      'brief_history',
      'advanced_journal',
      'custom_alerts',
    ],
    limits: {
      aiQuestionsPerDay: null,
      briefHistoryDays: null,
      portfolios: 5,
    },
  },
};

export const DEFAULT_PLAN: SubscriptionPlan = 'free';

export function getPlan(plan: SubscriptionPlan): PlanDefinition {
  return PLANS[plan] ?? PLANS[DEFAULT_PLAN];
}

export function entitlementsFor(plan: SubscriptionPlan): PremiumFeature[] {
  return getPlan(plan).includedFeatureKeys;
}

export function hasEntitlement(plan: SubscriptionPlan, feature: PremiumFeature): boolean {
  return entitlementsFor(plan).includes(feature);
}

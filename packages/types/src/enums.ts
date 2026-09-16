/**
 * Domain enumerations shared by the API, the mobile app and the validation schemas.
 *
 * They are declared as frozen const objects (and not TS `enum`) so that the exact same
 * values can be reused at runtime by Zod, by Prisma seeds and by the UI copy tables.
 */

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const INVESTMENT_GOALS = [
  'build_wealth',
  'prepare_retirement',
  'long_term_investing',
  'generate_income',
  'fund_a_project',
  'other',
] as const;
export type InvestmentGoal = (typeof INVESTMENT_GOALS)[number];

export const INVESTMENT_HORIZONS = [
  'under_2_years',
  '2_to_5_years',
  '5_to_10_years',
  '10_to_20_years',
  'over_20_years',
] as const;
export type InvestmentHorizon = (typeof INVESTMENT_HORIZONS)[number];

/**
 * Behavioural risk tolerance, derived from the onboarding scenario (a 20% temporary drawdown)
 * rather than from an abstract slider. This is *not* a regulatory suitability assessment.
 */
export const RISK_TOLERANCES = ['very_cautious', 'cautious', 'balanced', 'opportunistic'] as const;
export type RiskTolerance = (typeof RISK_TOLERANCES)[number];

export const ASSET_TYPES = [
  'stock',
  'etf',
  'bond',
  'fund',
  'crypto',
  'commodity',
  'cash',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const REGIONS = ['north_america', 'europe', 'asia', 'emerging', 'global', 'other'] as const;
export type Region = (typeof REGIONS)[number];

export const NEWS_CATEGORIES = [
  'macro',
  'central_banks',
  'company',
  'sector',
  'geopolitics',
  'regulation',
  'commodities',
  'currencies',
  'markets',
] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const TIME_HORIZONS = ['short_term', 'medium_term', 'long_term'] as const;
export type TimeHorizon = (typeof TIME_HORIZONS)[number];

export const MARKET_THEMES = [
  'rates',
  'inflation',
  'technology',
  'energy',
  'banks',
  'bonds',
  'currencies',
  'commodities',
  'geopolitics',
] as const;
export type MarketThemeKey = (typeof MARKET_THEMES)[number];

export const JOURNAL_ACTIONS = ['buy', 'sell', 'hold', 'watch', 'note'] as const;
export type JournalAction = (typeof JOURNAL_ACTIONS)[number];

export const CONVICTION_LEVELS = ['low', 'medium', 'high'] as const;
export type ConvictionLevel = (typeof CONVICTION_LEVELS)[number];

export const LESSON_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type LessonDifficulty = (typeof LESSON_DIFFICULTIES)[number];

export const LESSON_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'daily_brief',
  'important_news',
  'learning',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const SUBSCRIPTION_PLANS = ['free', 'premium'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const CONTENT_DEPTHS = ['simple', 'detailed'] as const;
export type ContentDepth = (typeof CONTENT_DEPTHS)[number];

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Epistemic status of a piece of information. NOVA never renders a hypothesis as a fact,
 * so the distinction is carried by the type system all the way to the UI.
 */
export const EPISTEMIC_KINDS = [
  'fact',
  'data',
  'analysis',
  'hypothesis',
  'uncertainty',
  'opinion',
] as const;
export type EpistemicKind = (typeof EPISTEMIC_KINDS)[number];

export const PRICE_RANGES = ['1W', '1M', '3M', '1Y'] as const;
export type PriceRange = (typeof PRICE_RANGES)[number];

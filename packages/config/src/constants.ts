/** Product-wide constants that both the API and the mobile app rely on. */

export const APP_NAME = 'NOVA';
export const APP_TAGLINE = 'Votre copilote personnel pour comprendre vos investissements.';
export const DEFAULT_TIMEZONE = 'Europe/Paris';
export const DEFAULT_LOCALE = 'fr';
export const DEFAULT_CURRENCY = 'EUR';

/** Hour (in DEFAULT_TIMEZONE) at which the daily brief pipeline runs. */
export const DAILY_BRIEF_HOUR = 6;

export const MAX_BRIEF_ITEMS = 5;
export const DASHBOARD_NEWS_COUNT = 5;

/** Label displayed anywhere demo data is shown. Absolute rule #58. */
export const DEMO_DATA_LABEL = 'DEMO DATA';
export const DEMO_DATA_EXPLANATION =
  'Ces données sont des données de démonstration, fournies pour illustrer le fonctionnement de NOVA. Elles ne reflètent pas les marchés en temps réel.';

/** Shown under every AI answer and every analysis. */
export const AI_DISCLAIMER =
  'NOVA fournit une information pédagogique et contextuelle. Ce contenu ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures.';

export const RISK_QUESTIONNAIRE_DISCLAIMER =
  'Ce questionnaire aide NOVA à adapter ses explications. Il ne constitue pas à lui seul une évaluation réglementaire complète de votre profil d’investisseur.';

export const NO_DATA_ANSWER = 'Je n’ai pas suffisamment de données pour répondre précisément.';

/** Cache time-to-live in seconds, per resource family. */
export const CACHE_TTL = {
  marketOverview: 300,
  priceSeries: 900,
  newsFeed: 120,
  newsAnalysis: 3600,
  dashboard: 60,
  portfolioAnalytics: 60,
  marketRadar: 600,
  lessons: 3600,
} as const;

/** Analytics events. Never carries an amount, a holding or an identity. */
export const ANALYTICS_EVENTS = [
  'signup_completed',
  'onboarding_completed',
  'portfolio_created',
  'position_added',
  'brief_opened',
  'news_opened',
  'news_explanation_opened',
  'ai_question_sent',
  'lesson_started',
  'lesson_completed',
  'journal_entry_created',
  'subscription_started',
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

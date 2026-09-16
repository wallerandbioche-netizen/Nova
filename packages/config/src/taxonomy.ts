import type { AssetType, MarketThemeKey, NewsCategory, Region } from '@nova/types';

/** Canonical sector list (GICS-inspired, simplified for retail readability). */
export const SECTORS = [
  { key: 'technology', label: 'Technologie' },
  { key: 'financials', label: 'Finance' },
  { key: 'healthcare', label: 'Santé' },
  { key: 'industrials', label: 'Industrie' },
  { key: 'energy', label: 'Énergie' },
  { key: 'consumer_discretionary', label: 'Consommation discrétionnaire' },
  { key: 'consumer_staples', label: 'Consommation de base' },
  { key: 'materials', label: 'Matériaux' },
  { key: 'utilities', label: 'Services aux collectivités' },
  { key: 'real_estate', label: 'Immobilier' },
  { key: 'communication', label: 'Communication' },
  { key: 'transport', label: 'Transport' },
  { key: 'defense', label: 'Défense' },
  { key: 'diversified', label: 'Diversifié' },
] as const;

export type SectorKey = (typeof SECTORS)[number]['key'];

export const SECTOR_LABELS: Record<string, string> = Object.fromEntries(
  SECTORS.map((sector) => [sector.key, sector.label]),
);

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'Actions',
  etf: 'ETF',
  bond: 'Obligations',
  fund: 'Fonds',
  crypto: 'Crypto',
  commodity: 'Matières premières',
  cash: 'Liquidités',
};

export const REGION_LABELS: Record<Region, string> = {
  north_america: 'Amérique du Nord',
  europe: 'Europe',
  asia: 'Asie',
  emerging: 'Marchés émergents',
  global: 'International',
  other: 'Autres',
};

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  macro: 'Macroéconomie',
  central_banks: 'Banques centrales',
  company: 'Entreprise',
  sector: 'Secteur',
  geopolitics: 'Géopolitique',
  regulation: 'Réglementation',
  commodities: 'Matières premières',
  currencies: 'Devises',
  markets: 'Marchés',
};

export const THEME_LABELS: Record<MarketThemeKey, string> = {
  rates: 'Taux',
  inflation: 'Inflation',
  technology: 'Technologie',
  energy: 'Énergie',
  banks: 'Banques',
  bonds: 'Obligations',
  currencies: 'Devises',
  commodities: 'Matières premières',
  geopolitics: 'Géopolitique',
};

/** Market indices shown on the dashboard, in display order. */
export const MARKET_INDICES = [
  { key: 'cac40', label: 'CAC 40', currency: 'EUR', region: 'europe' },
  { key: 'sp500', label: 'S&P 500', currency: 'USD', region: 'north_america' },
  { key: 'nasdaq', label: 'Nasdaq 100', currency: 'USD', region: 'north_america' },
  { key: 'eurostoxx50', label: 'Euro Stoxx 50', currency: 'EUR', region: 'europe' },
  { key: 'gold', label: 'Or', currency: 'USD', region: 'global' },
  { key: 'oil', label: 'Pétrole (Brent)', currency: 'USD', region: 'global' },
  { key: 'bitcoin', label: 'Bitcoin', currency: 'USD', region: 'global' },
] as const;

export const INVESTMENT_GOAL_LABELS = {
  build_wealth: 'Construire mon patrimoine',
  prepare_retirement: 'Préparer ma retraite',
  long_term_investing: 'Investir à long terme',
  generate_income: 'Générer des revenus',
  fund_a_project: 'Préparer un projet',
  other: 'Autre',
} as const;

export const INVESTMENT_HORIZON_LABELS = {
  under_2_years: 'Moins de 2 ans',
  '2_to_5_years': '2 à 5 ans',
  '5_to_10_years': '5 à 10 ans',
  '10_to_20_years': '10 à 20 ans',
  over_20_years: 'Plus de 20 ans',
} as const;

export const EXPERIENCE_LABELS = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
} as const;

export const RISK_TOLERANCE_LABELS = {
  very_cautious: 'Je serais très inquiet',
  cautious: 'Je chercherais à comprendre',
  balanced: 'Je resterais probablement investi',
  opportunistic: 'Je pourrais envisager d’investir davantage',
} as const;

export const JOURNAL_ACTION_LABELS = {
  buy: 'Achat',
  sell: 'Vente',
  hold: 'Conservation',
  watch: 'Surveillance',
  note: 'Note',
} as const;

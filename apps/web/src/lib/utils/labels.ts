import type {
  Direction,
  MarketBias,
  MarketRegime,
  NoTradeCode,
  RiskProfile,
  SetupKind,
  Strength,
  VolatilityRegime,
} from '@/types/analysis';

export const BIAS_LABEL: Record<MarketBias, string> = {
  bullish: 'Haussier',
  bearish: 'Baissier',
  neutral: 'Neutre',
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  long: 'Achat',
  short: 'Vente',
  none: 'Aucun trade',
};

export const REGIME_LABEL: Record<MarketRegime, string> = {
  strong_bullish: 'Tendance haussière forte',
  bullish: 'Tendance haussière',
  range: 'Range',
  bearish: 'Tendance baissière',
  strong_bearish: 'Tendance baissière forte',
};

export const STRENGTH_LABEL: Record<Strength, string> = {
  weak: 'Faible',
  medium: 'Moyen',
  strong: 'Fort',
};

export const VOLATILITY_LABEL: Record<VolatilityRegime, string> = {
  low: 'Volatilité faible',
  normal: 'Volatilité normale',
  high: 'Volatilité élevée',
};

export const SETUP_LABEL: Record<SetupKind, string> = {
  trend_continuation: 'Continuation de tendance',
  breakout_retest: 'Cassure + retest',
  support_rejection: 'Rejet sur support',
  resistance_rejection: 'Rejet sur résistance',
  liquidity_sweep: 'Balayage de liquidité',
  range_breakout: 'Sortie de range',
  mean_reversion: 'Retour à la moyenne',
  momentum_breakout: 'Cassure en momentum',
};

export const RISK_PROFILE_LABEL: Record<RiskProfile, string> = {
  prudent: 'Prudent',
  modere: 'Modéré',
  agressif: 'Agressif',
};

export const NO_TRADE_LABEL: Record<NoTradeCode, string> = {
  low_confluence: 'Confluence insuffisante',
  conflicting_structure: 'Structure contradictoire',
  insufficient_risk_reward: 'Rapport risque / rendement insuffisant',
  excessive_volatility: 'Volatilité excessive',
  no_setup: 'Aucun setup identifié',
  conflicting_timeframes: 'Unités de temps contradictoires',
  insufficient_data: 'Données insuffisantes',
  levels_too_close: 'Niveaux trop proches',
  invalidation_too_wide: 'Invalidation trop large',
};

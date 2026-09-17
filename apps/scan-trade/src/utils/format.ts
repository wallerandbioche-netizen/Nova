import type {
  AnalysisStatus,
  ConfidenceLevel,
  MarketBias,
  MarketType,
  TradingStyle,
} from '@prisma/client';

/** Display helpers. Everything user-facing is French; nothing here invents data. */

export const UNKNOWN = 'Non identifié';

/**
 * Formats a price with a precision that suits its magnitude.
 * A EUR/USD quote needs five decimals; an index needs two.
 */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return UNKNOWN;
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 8;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return UNKNOWN;
  if (min == null || max == null) return formatPrice(min ?? max);
  if (min === max) return formatPrice(min);
  return `${formatPrice(min)} — ${formatPrice(max)}`;
}

export function formatRiskReward(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return UNKNOWN;
  return `1:${value.toFixed(2).replace(/\.?0+$/, '')}`;
}

export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export const BIAS_LABEL: Record<MarketBias, string> = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  NEUTRAL: 'NEUTRAL',
};

export const STATUS_LABEL: Record<AnalysisStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'Analyse en cours',
  COMPLETED: 'Analyse disponible',
  NO_TRADE: 'No trade',
  INSUFFICIENT_DATA: 'Données insuffisantes',
  FAILED: 'Analyse indisponible',
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  LOW: 'Faible',
  MEDIUM: 'Modérée',
  HIGH: 'Élevée',
};

export const MARKET_LABEL: Record<MarketType, string> = {
  CRYPTO: 'Crypto',
  FOREX: 'Forex',
  INDICES: 'Indices',
  STOCKS: 'Actions',
  COMMODITIES: 'Matières premières',
  OTHER: 'Autre',
};

export const STYLE_LABEL: Record<TradingStyle, string> = {
  SCALPING: 'Scalping',
  DAY_TRADING: 'Day trading',
  SWING_TRADING: 'Swing trading',
  OTHER: 'Autre',
};

/** The market bias shown at the top of an analysis, including the "no setup" case. */
export function displayBias(status: AnalysisStatus, bias: MarketBias | null): string {
  if (status === 'COMPLETED' && bias) return BIAS_LABEL[bias];
  if (status === 'NO_TRADE') return 'NO TRADE';
  if (status === 'INSUFFICIENT_DATA') return 'DONNÉES INSUFFISANTES';
  if (status === 'FAILED') return 'INDISPONIBLE';
  return 'EN ATTENTE';
}

export function orUnknown(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : UNKNOWN;
}

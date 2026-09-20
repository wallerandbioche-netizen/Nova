import type { Asset } from '@/types/market';
import type { Direction, RiskProfile } from '@/types/analysis';

export interface RiskProfileConfig {
  /** Minimum confluence score (0–10) required before a setup is proposed. */
  minConfluence: number;
  /** Minimum risk/reward measured on the main objective. */
  minRiskReward: number;
  /** Stop distance expressed in ATR multiples. */
  stopAtrMultiple: number;
  /** Width of the entry zone in ATR multiples. */
  entryAtrMultiple: number;
  /** Default share of the account risked per trade, in percent. */
  defaultRiskPercent: number;
  /** Maximum share of the account the calculator will accept. */
  maxRiskPercent: number;
}

export const RISK_PROFILES: Record<RiskProfile, RiskProfileConfig> = {
  prudent: {
    minConfluence: 6.5,
    minRiskReward: 2,
    stopAtrMultiple: 1.6,
    entryAtrMultiple: 0.45,
    defaultRiskPercent: 0.5,
    maxRiskPercent: 1,
  },
  modere: {
    minConfluence: 5.5,
    minRiskReward: 1.8,
    stopAtrMultiple: 1.25,
    entryAtrMultiple: 0.35,
    defaultRiskPercent: 1,
    maxRiskPercent: 2,
  },
  agressif: {
    minConfluence: 4.5,
    minRiskReward: 1.5,
    stopAtrMultiple: 1,
    entryAtrMultiple: 0.3,
    defaultRiskPercent: 1.5,
    maxRiskPercent: 3,
  },
};

/**
 * Reward multiple of a target, measured against the distance to the stop.
 * Returns 0 when the stop is on the wrong side of the entry.
 */
export function riskRewardRatio(
  entry: number,
  stopLoss: number,
  target: number,
  direction: Direction,
): number {
  if (direction === 'none') return 0;
  const risk = direction === 'long' ? entry - stopLoss : stopLoss - entry;
  const reward = direction === 'long' ? target - entry : entry - target;
  if (risk <= 0 || reward <= 0) return 0;
  return reward / risk;
}

export interface PositionSizeInput {
  accountSize: number;
  riskPercent: number;
  entry: number;
  stopLoss: number;
  takeProfit?: number;
  direction: Direction;
  asset?: Pick<Asset, 'pipSize'>;
}

export interface PositionSizeResult {
  /** Currency amount at risk if the stop is hit. */
  maximumRisk: number;
  /** Number of units / contracts. */
  positionSize: number;
  /** Notional exposure at entry. */
  notional: number;
  stopDistance: number;
  stopDistancePercent: number;
  potentialLoss: number;
  potentialProfit: number | null;
  riskReward: number | null;
  warnings: string[];
}

/**
 * Position sizing from the account size and the risk budget. The helper never
 * increases the requested risk and warns when the inputs are inconsistent.
 */
export function computePositionSize(input: PositionSizeInput): PositionSizeResult {
  const warnings: string[] = [];
  const { accountSize, entry, stopLoss, direction } = input;
  const riskPercent = Math.max(0, input.riskPercent);

  if (riskPercent > 2) {
    warnings.push(
      'Risquer plus de 2 % du capital sur une position expose fortement le compte à une série de pertes.',
    );
  }

  const stopDistance = Math.abs(entry - stopLoss);
  if (stopDistance <= 0) {
    return {
      maximumRisk: 0,
      positionSize: 0,
      notional: 0,
      stopDistance: 0,
      stopDistancePercent: 0,
      potentialLoss: 0,
      potentialProfit: null,
      riskReward: null,
      warnings: [
        ...warnings,
        "Le stop et l'entrée sont identiques : taille de position incalculable.",
      ],
    };
  }

  const wrongSide =
    (direction === 'long' && stopLoss >= entry) || (direction === 'short' && stopLoss <= entry);
  if (wrongSide) {
    warnings.push("Le stop est du mauvais côté de l'entrée pour cette direction.");
  }

  const maximumRisk = (accountSize * riskPercent) / 100;
  const positionSize = maximumRisk / stopDistance;
  const notional = positionSize * entry;
  const riskReward =
    input.takeProfit != null ? riskRewardRatio(entry, stopLoss, input.takeProfit, direction) : null;

  return {
    maximumRisk,
    positionSize,
    notional,
    stopDistance,
    stopDistancePercent: (stopDistance / entry) * 100,
    potentialLoss: maximumRisk,
    potentialProfit: riskReward != null ? maximumRisk * riskReward : null,
    riskReward,
    warnings,
  };
}

/** Mid price of an entry zone, used whenever a single number is required. */
export function zoneMid(zone: { low: number; high: number }): number {
  return (zone.low + zone.high) / 2;
}

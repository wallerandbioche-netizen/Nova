import type { ConvictionLevel, InvestmentHorizon, JournalAction } from './enums.js';
import type { Iso8601 } from './common.js';
import type { Asset } from './portfolio.js';

export interface JournalEntry {
  id: string;
  portfolioId: string | null;
  asset: Asset | null;
  action: JournalAction;
  quantity: number | null;
  price: number | null;
  currency: string | null;
  reason: string;
  horizon: InvestmentHorizon | null;
  conviction: ConvictionLevel | null;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

/**
 * A past entry surfaced again later. NOVA shows what the user thought at the time and
 * deliberately does not grade the decision.
 */
export interface JournalLookback {
  entry: JournalEntry;
  monthsElapsed: number;
  prompt: string;
  /** Present only when the asset still has a known price; purely factual, no judgement. */
  priceThen: number | null;
  priceNow: number | null;
  priceChangePercent: number | null;
  priceAsOf: Iso8601 | null;
}

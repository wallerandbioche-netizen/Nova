import type { Candle } from '@/types/market';
import type { Direction, TradeSetup } from '@/types/analysis';

export interface BacktestTrade {
  direction: Direction;
  entry: number;
  stopLoss: number;
  target: number;
  /** Result in R multiples: +2 means twice the risk taken. */
  r: number;
  outcome: 'win' | 'loss' | 'open';
  barsHeld: number;
}

export interface BacktestReport {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  averageR: number;
  expectancy: number;
  profitFactor: number;
  maxDrawdown: number;
  /** Cumulative R curve, one point per closed trade. */
  equityCurve: number[];
  disclaimer: string;
}

const DISCLAIMER =
  'Les performances passées, simulées ou réelles, ne préjugent pas des performances futures.';

/**
 * Walk a setup forward through the candles that follow it and record whether
 * the stop or the target was reached first. Intrabar sequencing is unknown, so
 * a candle touching both levels is counted as a loss (worst case).
 */
export function simulateSetup(
  setup: Pick<TradeSetup, 'direction' | 'entryZone' | 'stopLoss' | 'takeProfits'>,
  forwardCandles: Candle[],
): BacktestTrade {
  const entry = (setup.entryZone.low + setup.entryZone.high) / 2;
  const target = setup.takeProfits[1]?.price ?? setup.takeProfits[0]?.price ?? entry;
  const risk = Math.abs(entry - setup.stopLoss);
  const base: BacktestTrade = {
    direction: setup.direction,
    entry,
    stopLoss: setup.stopLoss,
    target,
    r: 0,
    outcome: 'open',
    barsHeld: forwardCandles.length,
  };
  if (risk <= 0) return base;

  for (let index = 0; index < forwardCandles.length; index += 1) {
    const candle = forwardCandles[index];
    if (!candle) continue;
    const hitStop =
      setup.direction === 'long' ? candle.low <= setup.stopLoss : candle.high >= setup.stopLoss;
    const hitTarget = setup.direction === 'long' ? candle.high >= target : candle.low <= target;

    if (hitStop) return { ...base, r: -1, outcome: 'loss', barsHeld: index + 1 };
    if (hitTarget) {
      return {
        ...base,
        r: Math.abs(target - entry) / risk,
        outcome: 'win',
        barsHeld: index + 1,
      };
    }
  }

  const last = forwardCandles[forwardCandles.length - 1];
  if (!last) return base;
  const openR = (setup.direction === 'long' ? last.close - entry : entry - last.close) / risk;
  return { ...base, r: openR, outcome: 'open' };
}

export function buildReport(trades: BacktestTrade[]): BacktestReport {
  const closed = trades.filter((trade) => trade.outcome !== 'open');
  const wins = closed.filter((trade) => trade.r > 0);
  const losses = closed.filter((trade) => trade.r <= 0);

  const grossProfit = wins.reduce((total, trade) => total + trade.r, 0);
  const grossLoss = Math.abs(losses.reduce((total, trade) => total + trade.r, 0));
  const averageR = closed.length ? (grossProfit - grossLoss) / closed.length : 0;
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve = closed.map((trade) => {
    cumulative += trade.r;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    return Math.round(cumulative * 100) / 100;
  });

  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    averageR,
    expectancy: (winRate / 100) * averageWin - (1 - winRate / 100) * averageLoss,
    profitFactor:
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0,
    maxDrawdown,
    equityCurve,
    disclaimer: DISCLAIMER,
  };
}

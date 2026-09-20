import type { Candle } from '@/types/market';
import type { LiquidityEvent, SwingPoint } from '@/types/analysis';

/**
 * Liquidity reads are hypotheses derived from the candles: equal extremes,
 * sweeps and reclaims. Each event carries its own confidence and nothing is
 * emitted when the pattern is not present in the data.
 */
export function detectLiquidity(
  candles: Candle[],
  swings: SwingPoint[],
  atrValue: number | null,
): LiquidityEvent[] {
  const lastCandle = candles[candles.length - 1];
  if (!lastCandle || candles.length < 30) return [];

  const price = lastCandle.close;
  const tolerance = Math.max(atrValue ?? price * 0.003, price * 0.0008) * 0.4;
  const events: LiquidityEvent[] = [];

  const highs = swings.filter((swing) => swing.kind === 'high').slice(-6);
  const lows = swings.filter((swing) => swing.kind === 'low').slice(-6);

  for (let index = 1; index < highs.length; index += 1) {
    const current = highs[index];
    const previous = highs[index - 1];
    if (!current || !previous) continue;
    if (Math.abs(current.price - previous.price) <= tolerance) {
      events.push({
        kind: 'equal_highs',
        price: Math.max(current.price, previous.price),
        time: current.time,
        direction: 'bullish',
        description: `Sommets équivalents vers ${current.price} : liquidité probable juste au-dessus.`,
        confidence: 'medium',
      });
    }
  }

  for (let index = 1; index < lows.length; index += 1) {
    const current = lows[index];
    const previous = lows[index - 1];
    if (!current || !previous) continue;
    if (Math.abs(current.price - previous.price) <= tolerance) {
      events.push({
        kind: 'equal_lows',
        price: Math.min(current.price, previous.price),
        time: current.time,
        direction: 'bearish',
        description: `Creux équivalents vers ${current.price} : liquidité probable juste en dessous.`,
        confidence: 'medium',
      });
    }
  }

  // Sweep: price trades beyond a prior swing then closes back inside.
  const recent = candles.slice(-12);
  const priorHigh = highs[highs.length - 2]?.price ?? null;
  const priorLow = lows[lows.length - 2]?.price ?? null;

  recent.forEach((candle) => {
    if (priorHigh != null && candle.high > priorHigh && candle.close < priorHigh) {
      events.push({
        kind: 'liquidity_sweep_high',
        price: candle.high,
        time: candle.time,
        direction: 'bearish',
        description: `Mèche au-dessus de ${priorHigh} puis clôture en dessous : balayage de liquidité haute.`,
        confidence: 'strong',
      });
    }
    if (priorLow != null && candle.low < priorLow && candle.close > priorLow) {
      events.push({
        kind: 'liquidity_sweep_low',
        price: candle.low,
        time: candle.time,
        direction: 'bullish',
        description: `Mèche sous ${priorLow} puis clôture au-dessus : balayage de liquidité basse.`,
        confidence: 'strong',
      });
    }
  });

  // Failed breakout / reclaim on the trailing window.
  const window = candles.slice(-40, -5);
  if (window.length > 10) {
    const windowHigh = Math.max(...window.map((candle) => candle.high));
    const windowLow = Math.min(...window.map((candle) => candle.low));
    const closing = candles.slice(-5);
    const brokeAbove = closing.some((candle) => candle.high > windowHigh);
    const backInside = lastCandle.close < windowHigh;
    if (brokeAbove && backInside) {
      events.push({
        kind: 'failed_breakout',
        price: windowHigh,
        time: lastCandle.time,
        direction: 'bearish',
        description: `Cassure de ${windowHigh} non tenue : faux départ haussier.`,
        confidence: 'medium',
      });
    }
    const brokeBelow = closing.some((candle) => candle.low < windowLow);
    if (brokeBelow && lastCandle.close > windowLow) {
      events.push({
        kind: 'reclaim',
        price: windowLow,
        time: lastCandle.time,
        direction: 'bullish',
        description: `Retour au-dessus de ${windowLow} après cassure : niveau repris.`,
        confidence: 'medium',
      });
    }
  }

  return dedupe(events).slice(-5);
}

function dedupe(events: LiquidityEvent[]): LiquidityEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.kind}:${event.price.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

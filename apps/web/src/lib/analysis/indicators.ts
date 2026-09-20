import type { Candle } from '@/types/market';
import type { IndicatorSeries, IndicatorSnapshot } from '@/types/analysis';

/** Simple moving average; `null` until enough samples are available. */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index] ?? 0;
    if (index >= period) sum -= values[index - period] ?? 0;
    out.push(index >= period - 1 ? sum / period : null);
  }
  return out;
}

/** Exponential moving average seeded with the SMA of the first `period` values. */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  const multiplier = 2 / (period + 1);
  let previous = 0;
  for (let index = 0; index < period; index += 1) previous += values[index] ?? 0;
  previous /= period;
  out[period - 1] = previous;

  for (let index = period; index < values.length; index += 1) {
    const value = values[index] ?? previous;
    previous = (value - previous) * multiplier + previous;
    out[index] = previous;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = (values[index] ?? 0) - (values[index - 1] ?? 0);
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  out[period] = toRsi(averageGain, averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = (values[index] ?? 0) - (values[index - 1] ?? 0);
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    out[index] = toRsi(averageGain, averageLoss);
  }
  return out;
}

function toRsi(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0) return 100;
  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdPoint[] {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine: number[] = [];
  const macdIndex: number[] = [];

  values.forEach((_value, index) => {
    const fastValue = fastEma[index];
    const slowValue = slowEma[index];
    if (fastValue != null && slowValue != null) {
      macdLine.push(fastValue - slowValue);
      macdIndex.push(index);
    }
  });

  const signalLine = ema(macdLine, signalPeriod);
  const out: MacdPoint[] = values.map(() => ({ macd: null, signal: null, histogram: null }));

  macdIndex.forEach((originalIndex, position) => {
    const macdValue = macdLine[position] ?? null;
    const signalValue = signalLine[position] ?? null;
    out[originalIndex] = {
      macd: macdValue,
      signal: signalValue,
      histogram: macdValue != null && signalValue != null ? macdValue - signalValue : null,
    };
  });

  return out;
}

/** Average True Range (Wilder). */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  const trueRanges: number[] = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1]?.close ?? candle.close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });

  let previous = 0;
  for (let index = 1; index <= period; index += 1) previous += trueRanges[index] ?? 0;
  previous /= period;
  out[period] = previous;

  for (let index = period + 1; index < candles.length; index += 1) {
    previous = (previous * (period - 1) + (trueRanges[index] ?? previous)) / period;
    out[index] = previous;
  }
  return out;
}

/**
 * Rolling VWAP. A true session VWAP needs session boundaries the simulated feed
 * does not carry, so the engine uses an explicit rolling window and says so.
 */
export function vwap(candles: Candle[], window = 48): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let cumulativePv = 0;
  let cumulativeVolume = 0;
  const pvQueue: number[] = [];
  const volumeQueue: number[] = [];

  candles.forEach((candle, index) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    const pv = typical * candle.volume;
    pvQueue.push(pv);
    volumeQueue.push(candle.volume);
    cumulativePv += pv;
    cumulativeVolume += candle.volume;

    if (pvQueue.length > window) {
      cumulativePv -= pvQueue.shift() ?? 0;
      cumulativeVolume -= volumeQueue.shift() ?? 0;
    }
    out[index] = cumulativeVolume > 0 ? cumulativePv / cumulativeVolume : null;
  });

  return out;
}

export function computeIndicatorSeries(candles: Candle[]): IndicatorSeries {
  const closes = candles.map((candle) => candle.close);
  return {
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    ema200: ema(closes, 200),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    atr14: atr(candles, 14),
    vwap: vwap(candles),
  };
}

export function lastIndicatorSnapshot(
  candles: Candle[],
  series: IndicatorSeries,
): IndicatorSnapshot {
  const last = candles.length - 1;
  const volumes = candles.slice(-20).map((candle) => candle.volume);
  const averageVolume = volumes.length
    ? volumes.reduce((total, value) => total + value, 0) / volumes.length
    : 0;
  const lastVolume = candles[last]?.volume ?? 0;
  const macdPoint = series.macd[last];

  return {
    ema20: series.ema20[last] ?? null,
    ema50: series.ema50[last] ?? null,
    ema200: series.ema200[last] ?? null,
    rsi14: series.rsi14[last] ?? null,
    macd:
      macdPoint && macdPoint.macd != null && macdPoint.signal != null && macdPoint.histogram != null
        ? { macd: macdPoint.macd, signal: macdPoint.signal, histogram: macdPoint.histogram }
        : null,
    atr14: series.atr14[last] ?? null,
    vwap: series.vwap[last] ?? null,
    volume: averageVolume
      ? { last: lastVolume, average: averageVolume, ratio: lastVolume / averageVolume }
      : null,
  };
}

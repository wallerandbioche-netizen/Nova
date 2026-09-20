import type { Candle } from '@/types/market';
import type {
  IndicatorSeries,
  IndicatorSnapshot,
  MarketBias,
  MarketRegime,
  MomentumRead,
  VolatilityRead,
  VolumeRead,
} from '@/types/analysis';
import { rangeBounds } from './market-structure';

/**
 * Regime classification combines the moving average stack, the slope of the
 * fast average and how much of the recent range price has actually travelled.
 */
export function classifyRegime(
  candles: Candle[],
  series: IndicatorSeries,
  snapshot: IndicatorSnapshot,
): MarketRegime {
  const last = candles[candles.length - 1];
  if (!last || candles.length < 60) return 'range';

  const price = last.close;
  const { ema20, ema50, ema200 } = snapshot;
  const bounds = rangeBounds(candles, 40);

  let score = 0;
  if (ema20 != null && ema50 != null) score += ema20 > ema50 ? 1 : -1;
  if (ema50 != null && ema200 != null) score += ema50 > ema200 ? 1 : -1;
  if (ema20 != null) score += price > ema20 ? 1 : -1;

  const slopeWindow = 10;
  const previousEma20 = series.ema20[series.ema20.length - 1 - slopeWindow] ?? null;
  const slope =
    ema20 != null && previousEma20 != null ? (ema20 - previousEma20) / previousEma20 : 0;
  const atrPercent = snapshot.atr14 != null ? (snapshot.atr14 / price) * 100 : 0;
  const normalisedSlope = atrPercent > 0 ? (slope * 100) / atrPercent : slope * 100;

  // A narrow travel range relative to ATR means the market is rotating.
  const travel =
    bounds && snapshot.atr14 ? (bounds.high - bounds.low) / Math.max(snapshot.atr14, 1e-9) : 0;
  const rotating = travel > 0 && travel < 4.5;

  if (rotating && Math.abs(score) < 3) return 'range';
  if (score === 3 && normalisedSlope > 0.6) return 'strong_bullish';
  if (score >= 2) return 'bullish';
  if (score === -3 && normalisedSlope < -0.6) return 'strong_bearish';
  if (score <= -2) return 'bearish';
  return 'range';
}

export function biasFromRegime(regime: MarketRegime): MarketBias {
  if (regime === 'strong_bullish' || regime === 'bullish') return 'bullish';
  if (regime === 'strong_bearish' || regime === 'bearish') return 'bearish';
  return 'neutral';
}

export function readMomentum(snapshot: IndicatorSnapshot, series: IndicatorSeries): MomentumRead {
  const { rsi14, macd } = snapshot;
  if (rsi14 == null || !macd) {
    return {
      bias: 'neutral',
      strength: 'weak',
      rsi: rsi14,
      macdHistogram: macd?.histogram ?? null,
      description: 'Données insuffisantes pour qualifier le momentum.',
    };
  }

  const previousHistogram = series.macd[series.macd.length - 4]?.histogram ?? null;
  const expanding =
    previousHistogram != null && Math.abs(macd.histogram) > Math.abs(previousHistogram);

  let bias: MarketBias = 'neutral';
  if (macd.histogram > 0 && rsi14 > 50) bias = 'bullish';
  else if (macd.histogram < 0 && rsi14 < 50) bias = 'bearish';

  const strength = bias === 'neutral' ? 'weak' : expanding ? 'strong' : 'medium';
  const stretched =
    rsi14 > 70
      ? " Le RSI est en zone haute : cela mesure l'extension, pas un signal de vente isolé."
      : rsi14 < 30
        ? " Le RSI est en zone basse : cela mesure l'extension, pas un signal d'achat isolé."
        : '';

  return {
    bias,
    strength,
    rsi: rsi14,
    macdHistogram: macd.histogram,
    description: `RSI à ${rsi14.toFixed(1)}, histogramme MACD ${macd.histogram >= 0 ? 'positif' : 'négatif'} et ${
      expanding ? 'en expansion' : 'en contraction'
    }.${stretched}`,
  };
}

export function readVolume(candles: Candle[], snapshot: IndicatorSnapshot): VolumeRead {
  const volume = snapshot.volume;
  const last = candles[candles.length - 1];
  if (!volume || !last) {
    return {
      bias: 'neutral',
      strength: 'weak',
      ratio: null,
      description: 'Volume indisponible sur cette série.',
    };
  }

  const directional =
    last.close > last.open ? 'bullish' : last.close < last.open ? 'bearish' : 'neutral';
  const ratio = volume.ratio;

  if (ratio < 0.8) {
    return {
      bias: 'neutral',
      strength: 'weak',
      ratio,
      description: `Volume à ${(ratio * 100).toFixed(0)} % de sa moyenne 20 : participation faible, les cassures sont moins fiables.`,
    };
  }

  return {
    bias: ratio > 1.25 ? (directional as MarketBias) : 'neutral',
    strength: ratio > 1.6 ? 'strong' : ratio > 1.25 ? 'medium' : 'weak',
    ratio,
    description: `Volume à ${(ratio * 100).toFixed(0)} % de sa moyenne 20 sur une bougie ${
      directional === 'bullish' ? 'haussière' : directional === 'bearish' ? 'baissière' : 'neutre'
    }.`,
  };
}

export function readVolatility(candles: Candle[], snapshot: IndicatorSnapshot): VolatilityRead {
  const last = candles[candles.length - 1];
  const atrValue = snapshot.atr14;
  if (!last || atrValue == null) {
    return { regime: 'normal', atr: null, atrPercent: null, description: 'ATR indisponible.' };
  }

  const atrPercent = (atrValue / last.close) * 100;
  // Compare with the median ATR of the visible window to stay instrument-agnostic.
  const reference = medianAtrPercent(candles, atrValue);
  const ratio = reference > 0 ? atrPercent / reference : 1;

  const regime = ratio > 1.5 ? 'high' : ratio < 0.7 ? 'low' : 'normal';
  const description =
    regime === 'high'
      ? `ATR à ${atrPercent.toFixed(2)} % du prix, soit ${ratio.toFixed(1)}× la normale : élargir les stops ou réduire la taille.`
      : regime === 'low'
        ? `ATR à ${atrPercent.toFixed(2)} % du prix : compression, les objectifs doivent être resserrés.`
        : `ATR à ${atrPercent.toFixed(2)} % du prix : volatilité dans sa zone habituelle.`;

  return { regime, atr: atrValue, atrPercent, description };
}

function medianAtrPercent(candles: Candle[], currentAtr: number): number {
  const window = candles.slice(-60);
  if (window.length < 20) return (currentAtr / (candles[candles.length - 1]?.close ?? 1)) * 100;
  const ranges = window
    .map((candle) => ((candle.high - candle.low) / candle.close) * 100)
    .sort((a, b) => a - b);
  const middle = Math.floor(ranges.length / 2);
  return ranges[middle] ?? 0;
}

import { describe, expect, it } from 'vitest';
import { TIMEFRAME_MINUTES } from './assets';
import { generateCandles } from './generator';

describe('generateCandles', () => {
  it('is deterministic for the same request', () => {
    const first = generateCandles({ assetId: 'BTCUSDT', timeframe: '15m', count: 120 });
    const second = generateCandles({ assetId: 'BTCUSDT', timeframe: '15m', count: 120 });
    expect(first).toEqual(second);
  });

  it('returns the tail of the same series when fewer candles are requested', () => {
    const long = generateCandles({ assetId: 'ETHUSDT', timeframe: '1H', count: 300 });
    const short = generateCandles({ assetId: 'ETHUSDT', timeframe: '1H', count: 60 });
    expect(short).toEqual(long.slice(long.length - 60));
  });

  it('keeps the OHLC relationship valid on every candle', () => {
    const candles = generateCandles({ assetId: 'XAUUSD', timeframe: '5m', count: 320 });
    candles.forEach((candle) => {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      expect(candle.volume).toBeGreaterThan(0);
    });
  });

  it('spaces candles by the duration of the timeframe', () => {
    const candles = generateCandles({ assetId: 'SOLUSDT', timeframe: '4H', count: 50 });
    const [first, second] = candles;
    expect(second!.time - first!.time).toBe(TIMEFRAME_MINUTES['4H'] * 60);
  });

  it('produces different markets for different instruments', () => {
    const gold = generateCandles({ assetId: 'XAUUSD', timeframe: '1H', count: 80 });
    const nasdaq = generateCandles({ assetId: 'NAS100', timeframe: '1H', count: 80 });
    expect(gold[0]?.close).not.toBe(nasdaq[0]?.close);
  });
});

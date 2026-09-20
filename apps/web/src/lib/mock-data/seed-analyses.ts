import type { MarketAnalysis, RiskProfile } from '@/types/analysis';
import { runAnalysis } from '@/lib/analysis/engine';
import { generateCandles, getAsset, timeframeLadder } from '@/lib/market-data';
import type { Timeframe } from '@/types/market';

interface SeedSpec {
  assetId: string;
  timeframe: Timeframe;
  riskProfile: RiskProfile;
  /** Offset in bars used to place the analysis in the past. */
  agoBars: number;
  variant?: string;
}

const SEEDS: SeedSpec[] = [
  // A deliberate mix: configurations that pass every gate, and refusals with
  // different causes, so both outcomes are visible from the first launch.
  { assetId: 'XAUUSD', timeframe: '5m', riskProfile: 'modere', agoBars: 0 },
  { assetId: 'SPX500', timeframe: '1D', riskProfile: 'modere', agoBars: 14 },
  { assetId: 'EURUSD', timeframe: '1D', riskProfile: 'modere', agoBars: 30 },
  { assetId: 'SOLUSDT', timeframe: '1D', riskProfile: 'agressif', agoBars: 52 },
  { assetId: 'BTCUSDT', timeframe: '15m', riskProfile: 'modere', agoBars: 76 },
  { assetId: 'ETHUSDT', timeframe: '1H', riskProfile: 'prudent', agoBars: 104 },
  { assetId: 'NAS100', timeframe: '4H', riskProfile: 'modere', agoBars: 150 },
  { assetId: 'XAUUSD', timeframe: '15m', riskProfile: 'modere', agoBars: 192 },
];

/**
 * Deterministic demo analyses so the dashboard and the journal are populated on
 * a fresh install. They run through the real engine — nothing is hand-written —
 * and stay flagged as simulated data.
 */
export function buildSeedAnalyses(asOf = Date.UTC(2026, 8, 20, 12, 0, 0)): MarketAnalysis[] {
  return SEEDS.map((seed, index) => {
    const ladder = timeframeLadder(seed.timeframe);
    const shared = {
      assetId: seed.assetId,
      asOf,
      ...(seed.variant ? { variant: seed.variant } : {}),
    };
    const candles = generateCandles({ ...shared, timeframe: seed.timeframe, count: 320 });
    const intermediate = generateCandles({ ...shared, timeframe: ladder.intermediate, count: 240 });
    const higher = generateCandles({ ...shared, timeframe: ladder.higher, count: 200 });

    const createdAt = new Date(asOf - seed.agoBars * 15 * 60_000).toISOString();

    return runAnalysis(
      {
        asset: getAsset(seed.assetId),
        timeframe: seed.timeframe,
        candles,
        riskProfile: seed.riskProfile,
        higherTimeframeCandles: [
          { timeframe: ladder.higher, candles: higher },
          { timeframe: ladder.intermediate, candles: intermediate },
        ],
      },
      {
        id: `demo_${seed.assetId}_${seed.timeframe}_${index}`,
        createdAt,
        origin: 'market_data',
        dataSource: {
          source: 'mock',
          label: 'Données simulées — analyse de démonstration',
          candles: candles.length,
        },
        notes: ['Analyse de démonstration générée par le moteur sur des données simulées.'],
      },
    );
  });
}

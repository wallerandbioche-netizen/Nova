import type { RiskProfile } from '@/types/analysis';
import type { Timeframe } from '@/types/market';
import { generateCandles, getAsset, timeframeLadder } from '@/lib/market-data';
import { analyzeChart, type AnalyzeChartResult } from './analyze-chart';

export interface LocalAnalysisRequest {
  assetId: string;
  timeframe: Timeframe;
  riskProfile: RiskProfile;
  context?: string;
  asOf?: number;
}

/**
 * Runs the full pipeline on simulated market data. Used by the API route and,
 * when no route is reachable (static deployment, offline), directly by the
 * browser — the engine has no server dependency of its own.
 */
export function runLocalAnalysis(request: LocalAnalysisRequest): Promise<AnalyzeChartResult> {
  const { assetId, timeframe, riskProfile, context, asOf } = request;
  const ladder = timeframeLadder(timeframe);
  const shared = { assetId, ...(asOf ? { asOf } : {}) };

  const candles = generateCandles({ ...shared, timeframe, count: 320 });
  const intermediate = generateCandles({ ...shared, timeframe: ladder.intermediate, count: 240 });
  const higher = generateCandles({ ...shared, timeframe: ladder.higher, count: 200 });

  return analyzeChart(
    {
      asset: getAsset(assetId),
      timeframe,
      candles,
      riskProfile,
      ...(context ? { context } : {}),
      higherTimeframeCandles: [
        { timeframe: ladder.higher, candles: higher },
        { timeframe: ladder.intermediate, candles: intermediate },
      ],
    },
    {
      origin: 'market_data',
      dataSource: {
        source: 'mock',
        label: 'Données simulées — pas un flux de marché en direct',
        candles: candles.length,
      },
    },
  );
}

/** Candles the analysis was run on, regenerated deterministically. */
export function candlesFor(assetId: string, timeframe: Timeframe, asOf?: number) {
  return generateCandles({ assetId, timeframe, count: 320, ...(asOf ? { asOf } : {}) });
}

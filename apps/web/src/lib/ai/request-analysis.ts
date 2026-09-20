'use client';

import type { MarketAnalysis, RiskProfile } from '@/types/analysis';
import type { Candle, Timeframe } from '@/types/market';
import { candlesFor, runLocalAnalysis } from './local-analysis';

export interface AnalysisRequest {
  assetId: string;
  timeframe: Timeframe;
  riskProfile: RiskProfile;
  context?: string;
}

export interface AnalysisResponse {
  analysis: MarketAnalysis;
  reasoning: { headline: string };
  candles: Candle[];
}

/**
 * Asks the API route first — that is where model credentials live — and runs
 * the same pipeline locally when no route answers, so a static deployment
 * still produces a complete analysis instead of an error.
 */
export async function requestAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as AnalysisResponse;
      }
    }
  } catch {
    // No route reachable: fall through to the local engine.
  }

  const { analysis, reasoning } = await runLocalAnalysis(request);
  return {
    analysis,
    reasoning,
    candles: candlesFor(request.assetId, request.timeframe),
  };
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TIMEFRAMES } from '@/types/market';
import { analyzeChart } from '@/lib/ai/analyze-chart';
import { registerReasoningProvider } from '@/lib/ai/register';
import { ASSETS, generateCandles, getAsset, timeframeLadder } from '@/lib/market-data';

export const runtime = 'nodejs';

const requestSchema = z.object({
  assetId: z.string().refine((value) => ASSETS.some((asset) => asset.id === value), {
    message: 'Actif inconnu',
  }),
  timeframe: z.enum(TIMEFRAMES),
  riskProfile: z.enum(['prudent', 'modere', 'agressif']),
  context: z.string().max(500).optional(),
  asOf: z.number().int().positive().optional(),
});

/** Runs the analysis server-side so model credentials stay out of the browser. */
export async function POST(request: Request): Promise<Response> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Requête invalide', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  registerReasoningProvider();

  const { assetId, timeframe, riskProfile, context, asOf } = parsed.data;
  const ladder = timeframeLadder(timeframe);
  const shared = { assetId, ...(asOf ? { asOf } : {}) };

  const candles = generateCandles({ ...shared, timeframe, count: 320 });
  const intermediate = generateCandles({ ...shared, timeframe: ladder.intermediate, count: 240 });
  const higher = generateCandles({ ...shared, timeframe: ladder.higher, count: 200 });

  const { analysis, reasoning } = await analyzeChart(
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

  return NextResponse.json({ analysis, reasoning, candles });
}

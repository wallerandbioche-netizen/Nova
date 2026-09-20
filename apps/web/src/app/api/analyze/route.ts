import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TIMEFRAMES } from '@/types/market';
import { registerReasoningProvider } from '@/lib/ai/register';
import { candlesFor, runLocalAnalysis } from '@/lib/ai/local-analysis';
import { ASSETS } from '@/lib/market-data';

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

  const { assetId, timeframe, asOf } = parsed.data;
  const { analysis, reasoning } = await runLocalAnalysis(parsed.data);

  return NextResponse.json({
    analysis,
    reasoning,
    candles: candlesFor(assetId, timeframe, asOf),
  });
}

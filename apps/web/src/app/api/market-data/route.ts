import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TIMEFRAMES } from '@/types/market';
import { getMarketData, getQuotes } from '@/lib/market-data';

export const runtime = 'nodejs';

const querySchema = z.object({
  assetId: z.string().optional(),
  timeframe: z.enum(TIMEFRAMES).optional(),
  limit: z.coerce.number().int().min(50).max(1_000).optional(),
});

/** OHLC series or the quote board, depending on the parameters. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const { assetId, timeframe, limit } = parsed.data;
  if (!assetId || !timeframe) {
    return NextResponse.json({ quotes: await getQuotes() });
  }

  const series = await getMarketData({ assetId, timeframe, ...(limit ? { limit } : {}) });
  return NextResponse.json({ series });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TIMEFRAMES, type Candle } from '@/types/market';
import { analyzeChart } from '@/lib/ai/analyze-chart';
import { registerReasoningProvider } from '@/lib/ai/register';
import { extractFromScreenshot } from '@/lib/ai/providers/anthropic';
import { findAssetBySymbol, getAsset } from '@/lib/market-data';
import { MIN_CANDLES } from '@/lib/analysis/engine';

export const runtime = 'nodejs';

const MAX_BYTES = 6 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

const metadataSchema = z.object({
  riskProfile: z.enum(['prudent', 'modere', 'agressif']).default('modere'),
  context: z.string().max(500).optional(),
  assetId: z.string().optional(),
  timeframe: z.enum(TIMEFRAMES).optional(),
});

/**
 * Screenshot analysis. The engine only runs on candles a vision model could
 * actually read. When the image cannot be read, the route says so — it never
 * falls back to invented data.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');

  if (!form || !(file instanceof File)) {
    return NextResponse.json({ error: 'Aucune image reçue.' }, { status: 400 });
  }
  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: 'Format non supporté. Utilisez PNG, JPG ou WEBP.' },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image trop lourde (6 Mo maximum).' }, { status: 413 });
  }

  const metadata = metadataSchema.safeParse({
    riskProfile: form.get('riskProfile') ?? undefined,
    context: form.get('context') ?? undefined,
    assetId: form.get('assetId') ?? undefined,
    timeframe: form.get('timeframe') ?? undefined,
  });
  if (!metadata.success) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extraction = await extractFromScreenshot(buffer.toString('base64'), file.type);

  const candles: Candle[] = extraction.candles.map((candle, index) => ({
    time: Math.floor(Date.now() / 1000) - (extraction.candles.length - index) * 60,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume ?? 0,
  }));

  if (!extraction.readable || candles.length < MIN_CANDLES) {
    return NextResponse.json({
      readable: false,
      message: 'Données visuelles insuffisantes pour une analyse fiable.',
      missing: extraction.missing.length
        ? extraction.missing
        : [
            `Seules ${candles.length} bougies ont pu être lues sur l’image (minimum ${MIN_CANDLES}).`,
          ],
      observations: extraction.observations,
      detected: { symbol: extraction.symbol, timeframe: extraction.timeframe },
    });
  }

  registerReasoningProvider();

  const asset =
    (extraction.symbol ? findAssetBySymbol(extraction.symbol) : undefined) ??
    getAsset(metadata.data.assetId ?? 'XAUUSD');
  const timeframe = metadata.data.timeframe ?? '15m';

  const { analysis, reasoning } = await analyzeChart(
    {
      asset,
      timeframe,
      candles,
      riskProfile: metadata.data.riskProfile,
      ...(metadata.data.context ? { context: metadata.data.context } : {}),
    },
    {
      origin: 'screenshot',
      dataSource: {
        source: 'live',
        label: 'Valeurs lues sur la capture fournie',
        candles: candles.length,
      },
      notes: [
        'Les valeurs proviennent de la lecture de l’image : leur précision dépend de la qualité de la capture.',
        ...extraction.observations,
      ],
    },
  );

  return NextResponse.json({ readable: true, analysis, reasoning, candles });
}

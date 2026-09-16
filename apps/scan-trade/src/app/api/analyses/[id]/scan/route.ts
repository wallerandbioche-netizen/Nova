import { RATE_LIMITS } from '@/lib/rate-limit';
import { getAnalysisService } from '@/server/services';
import { requireViewer } from '@/server/session';
import { assertCanScan } from '@/server/usage';
import { enforceRateLimit, jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';
/** Vision analysis of a full-resolution screenshot can legitimately take a while. */
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

/** POST /api/analyses/:id/scan — runs the AI analysis and returns the result. */
export const POST = route('analyses.scan', async (_request: Request, context: Context) => {
  const viewer = await requireViewer();
  await enforceRateLimit(RATE_LIMITS.scan, `user:${viewer.id}`);
  await assertCanScan(viewer);

  const { id } = await context.params;

  const analysis = await getAnalysisService().scan(viewer.id, id, {
    tradingStyle: viewer.tradingStyle ?? undefined,
  });

  return jsonOk({ analysis });
});

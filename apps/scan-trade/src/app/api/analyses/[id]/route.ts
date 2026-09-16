import { getAnalysisService } from '@/server/services';
import { requireViewer } from '@/server/session';
import { jsonOk, noContent, route } from '@/server/http';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

/** GET /api/analyses/:id — always scoped to the caller. */
export const GET = route('analyses.get', async (_request: Request, context: Context) => {
  const viewer = await requireViewer();
  const { id } = await context.params;
  const analysis = await getAnalysisService().get(viewer.id, id);
  return jsonOk({ analysis });
});

/** DELETE /api/analyses/:id — removes the row and its stored screenshot. */
export const DELETE = route('analyses.delete', async (_request: Request, context: Context) => {
  const viewer = await requireViewer();
  const { id } = await context.params;
  await getAnalysisService().remove(viewer.id, id);
  return noContent();
});

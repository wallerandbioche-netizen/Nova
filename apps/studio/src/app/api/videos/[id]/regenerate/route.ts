import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { clientKey, ok, readOptionalJson, route } from '@/lib/http';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { requireUser } from '@/lib/auth/session';
import { updateVideoSchema } from '@/lib/validation';
import { updateVideo } from '@/server/videos';
import { enqueueRender } from '@/server/render-service';
import { getQueue } from '@/lib/jobs/queue';
import { serialiseJob, serialiseVideo } from '@/server/serializers';

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/videos/:id/regenerate
 *
 * Also the route used for the first render. Optional settings in the body are applied first, so
 * "change the style and regenerate" is a single call — and the photos, already imported and
 * analysed, are never fetched or analysed again.
 */
export const POST = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  rateLimit(clientKey(request, `render:${user.id}`), RATE_LIMITS.render);

  // Settings are optional: "just render it again" and "change the style and render" are the
  // same call, with or without a body.
  const input = await readOptionalJson(request, updateVideoSchema);
  if (input && Object.keys(input).length > 0) {
    await updateVideo(user.id, id, input);
  }

  const { job, creditsSpent, balance } = await enqueueRender(user.id, id);
  await getQueue().enqueue({ jobId: job.id, videoId: id });

  const video = await prisma.video.findFirst({
    where: { id, userId: user.id },
    include: { jobs: { orderBy: { queuedAt: 'desc' }, take: 1 } },
  });
  if (!video) throw new AppError('NOT_FOUND');

  return ok(
    {
      video: await serialiseVideo(video),
      job: serialiseJob(job),
      credits: { spent: creditsSpent, balance },
    },
    202,
  );
});

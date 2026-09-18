import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { ok, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { serialiseJob, serialiseVideo } from '@/server/serializers';

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/videos/:id/status — what the progress screen polls.
 * Percentages come from the renderer itself; there is no simulated progress anywhere.
 */
export const GET = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const video = await prisma.video.findFirst({
    where: { id, userId: user.id },
    include: { jobs: { orderBy: { queuedAt: 'desc' }, take: 1 } },
  });
  if (!video) throw new AppError('NOT_FOUND');

  const job = video.jobs[0];
  return ok({
    status: video.status,
    job: job ? serialiseJob(job) : null,
    video: video.status === 'COMPLETED' ? await serialiseVideo(video) : null,
    error: video.errorCode ? { code: video.errorCode, message: video.errorMessage } : null,
  });
});

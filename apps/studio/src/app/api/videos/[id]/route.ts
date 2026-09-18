import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { ok, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { updateVideoSchema } from '@/lib/validation';
import { deleteVideo, updateVideo } from '@/server/videos';
import { serialiseVideo } from '@/server/serializers';

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/videos/:id
 * Ownership is part of the query, not an afterthought: another user's id simply does not match.
 */
export const GET = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const video = await prisma.video.findFirst({
    where: { id, userId: user.id },
    include: {
      listing: { select: { title: true } },
      jobs: { orderBy: { queuedAt: 'desc' }, take: 1 },
    },
  });
  if (!video) throw new AppError('NOT_FOUND');
  return ok({ video: await serialiseVideo(video) });
});

export const PATCH = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const input = await readJson(request, updateVideoSchema);
  const video = await updateVideo(user.id, id, input);
  return ok({ video: await serialiseVideo(video) });
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await deleteVideo(user.id, id);
  return ok({ ok: true });
});

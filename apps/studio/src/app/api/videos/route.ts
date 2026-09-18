import type { NextRequest } from 'next/server';
import { ok, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { createVideoSchema } from '@/lib/validation';
import { createVideo, listVideos } from '@/server/videos';
import { serialiseVideo } from '@/server/serializers';

/** GET /api/videos — the caller's own videos, newest first. */
export const GET = route(async () => {
  const user = await requireUser();
  const videos = await listVideos(user.id);
  return ok({ videos: await Promise.all(videos.map(serialiseVideo)) });
});

/** POST /api/videos — creates a project. Rendering is started separately. */
export const POST = route(async (request: NextRequest) => {
  const user = await requireUser();
  const input = await readJson(request, createVideoSchema);
  const video = await createVideo({ userId: user.id, ...input });
  return ok({ video: await serialiseVideo(video) }, 201);
});

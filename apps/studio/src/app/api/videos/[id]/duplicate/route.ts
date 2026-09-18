import { ok, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { duplicateVideo } from '@/server/videos';
import { serialiseVideo } from '@/server/serializers';

interface Context {
  params: Promise<{ id: string }>;
}

export const POST = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const video = await duplicateVideo(user.id, id);
  return ok({ video: await serialiseVideo(video) }, 201);
});

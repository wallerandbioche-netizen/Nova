import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listLessonsQuerySchema, uuidSchema } from '@nova/validation';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';

const completeSchema = z.object({
  // Answers are graded server-side; the client only sends its choices.
  answers: z.record(z.string().max(64), z.string().max(64)).default({}),
});

export async function learningRoutes(app: FastifyInstance): Promise<void> {
  const { learning, analytics } = app.nova;

  app.addHook('onRequest', app.authenticate);

  app.get('/learning', async (request) => {
    const user = requireUser(request);
    const query = parseInput(listLessonsQuerySchema, request.query, 'query');
    return { items: await learning.list(user.id, query) };
  });

  app.get('/learning/progress', async (request) => {
    const user = requireUser(request);
    return learning.getProgress(user.id);
  });

  app.get('/learning/daily', async (request) => {
    const user = requireUser(request);
    const suggestion = await learning.suggestLesson(user.id);
    return { lesson: suggestion };
  });

  app.get('/learning/:id', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const lesson = await learning.getById(id, user.id);
    await analytics.track({
      event: 'lesson_started',
      userRef: user.id,
      properties: { lessonSlug: lesson.slug, difficulty: lesson.difficulty },
    });
    return lesson;
  });

  app.post('/learning/:id/complete', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const input = parseInput(completeSchema, request.body ?? {});
    const result = await learning.complete(id, user.id, input.answers);
    await analytics.track({ event: 'lesson_completed', userRef: user.id });
    return result;
  });
}

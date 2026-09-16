import type { FastifyInstance } from 'fastify';
import { briefHistoryQuerySchema, uuidSchema } from '@nova/validation';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';

export async function dailyBriefRoutes(app: FastifyInstance): Promise<void> {
  const { dailyBriefs, subscriptions, analytics } = app.nova;

  app.addHook('onRequest', app.authenticate);

  app.get('/brief/today', async (request) => {
    const user = requireUser(request);
    let brief = await dailyBriefs.getToday(user.id);

    // No brief at all yet (new account, or the 06:00 job has not run for them): generate one
    // now so the first morning is not empty. Subsequent days come from the job.
    if (!brief) {
      const plan = await subscriptions.getEffectivePlan(user.id);
      brief = await dailyBriefs.generateForUser(user.id, { plan });
    }

    await analytics.track({
      event: 'brief_opened',
      userRef: user.id,
      properties: { isDemo: brief.meta.isDemo },
    });
    return brief;
  });

  app.get('/brief/history', async (request) => {
    const user = requireUser(request);
    const query = parseInput(briefHistoryQuerySchema, request.query, 'query');
    const plan = await subscriptions.getEffectivePlan(user.id);
    return dailyBriefs.history(user.id, { ...query, plan });
  });

  app.get('/brief/:id', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    return dailyBriefs.getById(id, user.id);
  });
}

import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../http/plugins/authenticate.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const { dashboard } = app.nova;

  /**
   * Everything the morning screen needs, in one request: brief, portfolio summary, markets,
   * the five items that matter, the personalised insight and the lesson of the day.
   */
  app.get('/dashboard', { onRequest: app.authenticate }, async (request) => {
    const user = requireUser(request);
    return dashboard.get(user.id);
  });
}

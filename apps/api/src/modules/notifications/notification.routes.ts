import type { FastifyInstance } from 'fastify';
import { listNotificationsQuerySchema, registerDeviceSchema, uuidSchema } from '@nova/validation';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  const { notifications } = app.nova;

  app.addHook('onRequest', app.authenticate);

  app.get('/notifications', async (request) => {
    const user = requireUser(request);
    const query = parseInput(listNotificationsQuerySchema, request.query, 'query');
    const page = await notifications.list(user.id, query);
    return { ...page, unreadCount: await notifications.countUnread(user.id) };
  });

  app.patch('/notifications/:id/read', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    return notifications.markRead(id, user.id);
  });

  app.post('/notifications/read-all', async (request) => {
    const user = requireUser(request);
    return { updated: await notifications.markAllRead(user.id) };
  });

  app.post('/notifications/devices', async (request, reply) => {
    const user = requireUser(request);
    const input = parseInput(registerDeviceSchema, request.body);
    await notifications.registerDevice(user.id, input.token, input.platform);
    return reply.status(204).send();
  });
}

import type { FastifyInstance } from 'fastify';
import { deleteAccountSchema } from '@nova/validation';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';
import { hashIp } from '../auth/tokens.js';

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  const { account, env } = app.nova;

  app.addHook('onRequest', app.authenticate);

  /** RGPD export: the user's own data, in full, as JSON. */
  app.get('/account/export', async (request, reply) => {
    const user = requireUser(request);
    const payload = await account.exportData(user.id);
    return reply
      .header('content-type', 'application/json; charset=utf-8')
      .header(
        'content-disposition',
        `attachment; filename="nova-export-${new Date().toISOString().slice(0, 10)}.json"`,
      )
      .send(payload);
  });

  app.delete('/account', async (request, reply) => {
    const user = requireUser(request);
    const input = parseInput(deleteAccountSchema, request.body);
    await account.deleteAccount(user.id, input.password, hashIp(request.ip, env.JWT_SECRET));
    return reply.status(204).send();
  });
}

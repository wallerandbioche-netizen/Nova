import type { FastifyInstance } from 'fastify';
import {
  createJournalEntrySchema,
  paginationSchema,
  updateJournalEntrySchema,
  uuidSchema,
} from '@nova/validation';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';

export async function journalRoutes(app: FastifyInstance): Promise<void> {
  const { journal, analytics } = app.nova;

  app.addHook('onRequest', app.authenticate);

  app.get('/journal', async (request) => {
    const user = requireUser(request);
    const query = parseInput(paginationSchema, request.query, 'query');
    return journal.list(user.id, query);
  });

  /** Entries old enough to be worth revisiting — "voici ce que vous pensiez". */
  app.get('/journal/lookbacks', async (request) => {
    const user = requireUser(request);
    return { items: await journal.listLookbacks(user.id) };
  });

  app.post('/journal', async (request, reply) => {
    const user = requireUser(request);
    const input = parseInput(createJournalEntrySchema, request.body);
    const entry = await journal.create(user.id, input);
    await analytics.track({
      event: 'journal_entry_created',
      userRef: user.id,
      properties: { category: input.action },
    });
    return reply.status(201).send(entry);
  });

  app.get('/journal/:id', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    return journal.getById(id, user.id);
  });

  app.patch('/journal/:id', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const input = parseInput(updateJournalEntrySchema, request.body);
    return journal.update(id, user.id, input);
  });

  app.delete('/journal/:id', async (request, reply) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    await journal.remove(id, user.id);
    return reply.status(204).send();
  });
}

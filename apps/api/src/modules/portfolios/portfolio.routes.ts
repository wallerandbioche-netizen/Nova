import type { FastifyInstance } from 'fastify';
import {
  createPortfolioSchema,
  createPositionSchema,
  updatePortfolioSchema,
  updatePositionSchema,
  uuidSchema,
} from '@nova/validation';
import { getPlan } from '@nova/config';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';

export async function portfolioRoutes(app: FastifyInstance): Promise<void> {
  const { portfolios, subscriptions, analytics } = app.nova;

  app.addHook('onRequest', app.authenticate);

  app.get('/portfolios', async (request) => {
    const user = requireUser(request);
    return { items: await portfolios.list(user.id) };
  });

  app.post('/portfolios', async (request, reply) => {
    const user = requireUser(request);
    const input = parseInput(createPortfolioSchema, request.body);
    const plan = await subscriptions.getEffectivePlan(user.id);
    const portfolio = await portfolios.create(user.id, input, getPlan(plan).limits.portfolios);
    await analytics.track({ event: 'portfolio_created', userRef: user.id, properties: { plan } });
    return reply.status(201).send(portfolio);
  });

  app.get('/portfolios/:id', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const [portfolio, analyticsPayload, positions] = await Promise.all([
      portfolios.getOwned(id, user.id),
      portfolios.getAnalytics(id, user.id),
      portfolios.getValuedPositions(id, user.id),
    ]);
    return {
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency,
        createdAt: portfolio.createdAt.toISOString(),
        updatedAt: portfolio.updatedAt.toISOString(),
      },
      analytics: analyticsPayload,
      positions,
    };
  });

  app.patch('/portfolios/:id', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const input = parseInput(updatePortfolioSchema, request.body);
    return portfolios.update(id, user.id, input);
  });

  app.delete('/portfolios/:id', async (request, reply) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    await portfolios.remove(id, user.id);
    return reply.status(204).send();
  });

  app.get('/portfolios/:id/positions', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    return { items: await portfolios.getValuedPositions(id, user.id) };
  });

  app.post('/portfolios/:id/positions', async (request, reply) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const input = parseInput(createPositionSchema, request.body);
    await portfolios.assertPositionLimit(id);
    const position = await portfolios.addPosition(id, user.id, input);
    await analytics.track({ event: 'position_added', userRef: user.id });
    return reply.status(201).send(position);
  });

  app.patch('/positions/:id', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const input = parseInput(updatePositionSchema, request.body);
    return portfolios.updatePosition(id, user.id, input);
  });

  app.delete('/positions/:id', async (request, reply) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    await portfolios.removePosition(id, user.id);
    return reply.status(204).send();
  });

  app.get('/portfolios/:id/exposure', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    return portfolios.getExposure(id, user.id);
  });
}

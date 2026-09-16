import type { FastifyInstance } from 'fastify';
import { listAssetsQuerySchema, priceSeriesQuerySchema, uuidSchema } from '@nova/validation';
import { featureNotAvailable } from '../../http/errors.js';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';

export async function marketRoutes(app: FastifyInstance): Promise<void> {
  const { marketData, assets, portfolios, marketRadar, subscriptions } = app.nova;

  // The market overview is readable without an account: it carries no personal data.
  app.get('/markets/overview', async () => marketData.getOverview());

  // Market Radar is a premium feature; the gate is enforced server-side, from the stored
  // subscription, never from anything the client claims.
  app.get('/markets/radar', { onRequest: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const plan = await subscriptions.getEffectivePlan(user.id);
    if (plan !== 'premium') {
      throw featureNotAvailable(
        'Le Market Radar fait partie de NOVA Premium. Vous pouvez découvrir les thèmes du jour dans votre briefing.',
      );
    }
    return marketRadar.get(user.id);
  });

  app.get('/assets', { onRequest: app.optionalAuthenticate }, async (request) => {
    const query = parseInput(listAssetsQuerySchema, request.query, 'query');
    return assets.search(query);
  });

  app.get('/assets/:id', { onRequest: app.optionalAuthenticate }, async (request) => {
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const asset = await assets.getById(id);

    // When signed in, tell the user whether this asset is already in their portfolio.
    let position: { quantity: number; averagePrice: number } | null = null;
    if (request.user) {
      const portfolio = await portfolios.getDefault(request.user.id);
      if (portfolio) {
        const positions = await portfolios.getValuedPositions(portfolio.id, request.user.id);
        const found = positions.find((candidate) => candidate.asset.id === id);
        position = found ? { quantity: found.quantity, averagePrice: found.averagePrice } : null;
      }
    }
    return { asset, position };
  });

  app.get('/assets/:id/prices', async (request) => {
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const { range } = parseInput(priceSeriesQuerySchema, request.query, 'query');
    return marketData.getPriceSeries(id, range);
  });
}

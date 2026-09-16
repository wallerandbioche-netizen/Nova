import type { FastifyInstance } from 'fastify';
import { contentDepthSchema, listNewsQuerySchema, uuidSchema } from '@nova/validation';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';
import { NewsService } from '../../services/news/news.service.js';

export async function newsRoutes(app: FastifyInstance): Promise<void> {
  const { news, personalization, ai, analytics } = app.nova;

  app.get('/news', { onRequest: app.optionalAuthenticate }, async (request) => {
    const query = parseInput(listNewsQuerySchema, request.query, 'query');

    const page = await news.list({
      limit: query.limit,
      cursor: query.cursor,
      category: query.category,
    });

    // Anonymous or non-personalised: importance order only.
    if (!request.user || !query.personalized) {
      return { ...page, personalized: false };
    }

    const exposure = await personalization.getExposure(request.user.id);
    const themes = await news.withThemes(page.items);
    const ranked = personalization.rank(
      page.items.map((item) => ({
        ...news.toScored(item),
        themeKeys: themes.get(item.id) ?? [],
      })),
      exposure,
    );

    const byId = new Map(page.items.map((item) => [item.id, item]));
    const items = ranked
      .map((scored) => {
        const item = byId.get(scored.id);
        return item
          ? news.personalize(item, {
              score: scored.relevance.score,
              reason: scored.relevance.reason,
              exposurePercent: scored.relevance.exposurePercent,
            })
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      ...page,
      items,
      personalized: true,
      exposureSignature: NewsService.exposureSignature(exposure),
    };
  });

  app.get('/news/:id', { onRequest: app.optionalAuthenticate }, async (request) => {
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const item = await news.getById(id);
    if (request.user) {
      await analytics.track({
        event: 'news_opened',
        userRef: request.user.id,
        properties: { category: item.category, isDemo: item.isDemo },
      });
    }
    return item;
  });

  /** "Pourquoi cela vous concerne ?" — the product's central screen. */
  app.get('/news/:id/analysis', { onRequest: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    const depth = parseInput(
      contentDepthSchema.default('simple'),
      (request.query as { depth?: string }).depth ?? 'simple',
      'query',
    );

    const exposure = await personalization.getExposure(user.id);
    const analysis = await ai.explainNews({ userId: user.id, newsId: id, depth, exposure });

    await analytics.track({
      event: 'news_explanation_opened',
      userRef: user.id,
      properties: { depth, hasPortfolio: exposure !== null },
    });
    return analysis;
  });
}

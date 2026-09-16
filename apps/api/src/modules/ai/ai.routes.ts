import type { FastifyInstance } from 'fastify';
import {
  aiChatSchema,
  explainNewsSchema,
  explainPortfolioSchema,
  uuidSchema,
} from '@nova/validation';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';
import { rateLimitConfig } from '../../http/plugins/rate-limit.js';

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  const { ai, personalization, subscriptions, analytics, env } = app.nova;

  app.addHook('onRequest', app.authenticate);

  app.post('/ai/chat', { config: rateLimitConfig(env, 'ai') }, async (request) => {
    const user = requireUser(request);
    const input = parseInput(aiChatSchema, request.body);
    const plan = await subscriptions.getEffectivePlan(user.id);

    const result = await ai.chat({
      userId: user.id,
      message: input.message,
      conversationId: input.conversationId,
      depth: input.depth,
      plan,
      newsId: input.context?.newsId,
    });

    await analytics.track({
      event: 'ai_question_sent',
      userRef: user.id,
      properties: { depth: input.depth, plan },
    });
    return result;
  });

  app.post('/ai/explain-news', { config: rateLimitConfig(env, 'ai') }, async (request) => {
    const user = requireUser(request);
    const input = parseInput(explainNewsSchema, request.body);
    const exposure = await personalization.getExposure(user.id);
    return ai.explainNews({
      userId: user.id,
      newsId: input.newsId,
      depth: input.depth,
      exposure,
    });
  });

  app.post('/ai/explain-portfolio', { config: rateLimitConfig(env, 'ai') }, async (request) => {
    const user = requireUser(request);
    const input = parseInput(explainPortfolioSchema, request.body);
    return ai.explainPortfolio({
      userId: user.id,
      portfolioId: input.portfolioId,
      question: input.question,
      depth: input.depth,
    });
  });

  app.get('/ai/conversations', async (request) => {
    const user = requireUser(request);
    return { items: await ai.listConversations(user.id) };
  });

  app.get('/ai/conversations/:id', async (request) => {
    const user = requireUser(request);
    const id = parseInput(uuidSchema, (request.params as { id: string }).id, 'params');
    return ai.getConversation(id, user.id);
  });
}

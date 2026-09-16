import type { FastifyInstance } from 'fastify';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { profileRoutes } from '../modules/users/user.routes.js';
import { portfolioRoutes } from '../modules/portfolios/portfolio.routes.js';
import { marketRoutes } from '../modules/markets/market.routes.js';
import { newsRoutes } from '../modules/news/news.routes.js';
import { dailyBriefRoutes } from '../modules/daily-briefs/daily-brief.routes.js';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes.js';
import { aiRoutes } from '../modules/ai/ai.routes.js';
import { learningRoutes } from '../modules/learning/learning.routes.js';
import { journalRoutes } from '../modules/journal/journal.routes.js';
import { notificationRoutes } from '../modules/notifications/notification.routes.js';
import { subscriptionRoutes } from '../modules/subscriptions/subscription.routes.js';
import { accountRoutes } from '../modules/account/account.routes.js';
import { healthRoutes } from '../modules/health/health.routes.js';

/**
 * Route registration.
 *
 * Each module is registered in its own Fastify scope, so an `onRequest` authentication hook
 * added by one module can never leak into another.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(profileRoutes);
      await api.register(portfolioRoutes);
      await api.register(marketRoutes);
      await api.register(newsRoutes);
      await api.register(dailyBriefRoutes);
      await api.register(dashboardRoutes);
      await api.register(aiRoutes);
      await api.register(learningRoutes);
      await api.register(journalRoutes);
      await api.register(notificationRoutes);
      await api.register(subscriptionRoutes);
      await api.register(accountRoutes);
    },
    { prefix: '/v1' },
  );
}

import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import type { Cache } from './infrastructure/cache/index.js';
import type { Database } from './infrastructure/database/prisma.js';
import { AuditLogService } from './modules/audit-logs/audit-log.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { UserService } from './modules/users/user.service.js';
import { AssetService } from './modules/assets/asset.service.js';
import { PortfolioService } from './modules/portfolios/portfolio.service.js';
import { MarketDataService } from './services/market-data/market-data.service.js';
import { NewsService } from './services/news/news.service.js';
import { ScoringService } from './services/news/scoring.service.js';
import { PersonalizationService } from './services/personalization/personalization.service.js';
import { AiService } from './services/ai/ai.service.js';
import { DailyBriefService } from './modules/daily-briefs/daily-brief.service.js';
import { DashboardService } from './modules/dashboard/dashboard.service.js';
import { LearningService } from './modules/learning/learning.service.js';
import { JournalService } from './modules/journal/journal.service.js';
import { NotificationService } from './services/notifications/notification.service.js';
import { SubscriptionService } from './modules/subscriptions/subscription.service.js';
import { AccountService } from './modules/account/account.service.js';
import { AnalyticsService } from './services/analytics/analytics.service.js';
import { createMarketDataProvider } from './services/market-data/providers/index.js';
import { createNewsProvider } from './services/news/providers/index.js';
import { createLlmProvider } from './services/ai/providers/index.js';
import { createNotificationProvider } from './services/notifications/providers/index.js';
import { createPaymentProvider } from './services/payments/providers/index.js';
import { createStorageProvider } from './services/storage/providers/index.js';

/**
 * Composition root.
 *
 * Every service receives its dependencies explicitly, so a test can build the whole graph
 * against a test database and fake providers without touching module-level singletons.
 */
export interface NovaContainer {
  env: Env;
  db: Database;
  cache: Cache;
  logger: Logger;
  auditLog: AuditLogService;
  auth: AuthService;
  users: UserService;
  assets: AssetService;
  portfolios: PortfolioService;
  marketData: MarketDataService;
  news: NewsService;
  scoring: ScoringService;
  personalization: PersonalizationService;
  ai: AiService;
  dailyBriefs: DailyBriefService;
  dashboard: DashboardService;
  learning: LearningService;
  journal: JournalService;
  notifications: NotificationService;
  subscriptions: SubscriptionService;
  account: AccountService;
  analytics: AnalyticsService;
}

export interface ContainerDeps {
  env: Env;
  db: Database;
  cache: Cache;
  logger: Logger;
}

export function buildContainer({ env, db, cache, logger }: ContainerDeps): NovaContainer {
  const auditLog = new AuditLogService(db, logger);
  const analytics = new AnalyticsService(env, logger);

  const marketDataProvider = createMarketDataProvider(env, logger);
  const newsProvider = createNewsProvider(env, logger);
  const llmProvider = createLlmProvider(env, logger);
  const notificationProvider = createNotificationProvider(env, logger);
  const paymentProvider = createPaymentProvider(env, logger);
  const storageProvider = createStorageProvider(env, logger);

  const auth = new AuthService(db, env, logger, auditLog);
  const users = new UserService(db, auditLog);
  const assets = new AssetService(db);
  const marketData = new MarketDataService(db, cache, marketDataProvider, logger);
  const portfolios = new PortfolioService(db, cache, marketData, assets, logger);
  const scoring = new ScoringService();
  const news = new NewsService(db, cache, newsProvider, scoring, assets, logger);
  const personalization = new PersonalizationService(db, portfolios, scoring, logger);
  const subscriptions = new SubscriptionService(db, env, paymentProvider, auditLog, logger);
  const ai = new AiService(db, env, llmProvider, personalization, portfolios, news, cache, logger);
  const learning = new LearningService(db, cache);
  const notifications = new NotificationService(db, notificationProvider, logger);
  const dailyBriefs = new DailyBriefService(
    db,
    cache,
    news,
    personalization,
    portfolios,
    marketData,
    ai,
    learning,
    logger,
  );
  const dashboard = new DashboardService(
    db,
    cache,
    dailyBriefs,
    marketData,
    news,
    personalization,
    portfolios,
    learning,
    logger,
  );
  const journal = new JournalService(db, marketData, assets);
  const account = new AccountService(db, auth, auditLog, storageProvider, logger);

  return {
    env,
    db,
    cache,
    logger,
    auditLog,
    auth,
    users,
    assets,
    portfolios,
    marketData,
    news,
    scoring,
    personalization,
    ai,
    dailyBriefs,
    dashboard,
    learning,
    journal,
    notifications,
    subscriptions,
    account,
    analytics,
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    nova: NovaContainer;
  }
}
